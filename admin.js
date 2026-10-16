(async () => {
  const $ = (selector) => document.querySelector(selector);
  const setupPanel = $("#setup-panel");
  const loginPanel = $("#login-panel");
  const editorPanel = $("#editor-panel");
  const form = $("#place-form");
  const status = $("#status");
  const list = $("#saved-list");
  const photoList = $("#existing-photos");
  let db;
  let places = [];
  let selectedId = null;
  let map;
  let locationMarker;

  function message(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("is-error", isError);
  }

  function setLocation(latitude, longitude, moveMap = true) {
    form.elements.latitude.value = Number(latitude).toFixed(6);
    form.elements.longitude.value = Number(longitude).toFixed(6);
    if (!map) return;
    const point = [latitude, longitude];
    if (!locationMarker) locationMarker = L.marker(point).addTo(map);
    else locationMarker.setLatLng(point);
    if (moveMap) map.setView(point, Math.max(map.getZoom(), 7));
  }

  function initializeMap() {
    if (map || !window.L) return;
    map = L.map("editor-map", { scrollWheelZoom: false }).setView([20, 30], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.on("click", (event) => setLocation(event.latlng.lat, event.latlng.lng, false));
    setTimeout(() => map.invalidateSize(), 0);
  }

  function resetForm() {
    selectedId = null;
    form.reset();
    photoList.replaceChildren();
    $("#form-title").textContent = "New pin";
    $("#delete-place").hidden = true;
    list.querySelectorAll(".saved-place").forEach((node) => node.classList.remove("is-active"));
    if (locationMarker) { map.removeLayer(locationMarker); locationMarker = null; }
    message("Click the map or search for a place to choose its position.");
  }

  function renderPhotos(place) {
    photoList.replaceChildren();
    place.photos.forEach((photo) => {
      const card = document.createElement("div");
      card.className = "existing-photo";
      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.alt;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove photo from ${place.name}`);
      remove.addEventListener("click", async () => {
        if (!confirm("Remove this photo from the pinboard?")) return;
        remove.disabled = true;
        try {
          const { error } = await db.from("photos").delete().eq("id", photo.id);
          if (error) throw error;
          const { error: storageError } = await db.storage.from("travel-photos").remove([photo.path]);
          if (storageError) console.warn("Photo file cleanup failed:", storageError);
          await refreshPlaces(place.id);
          message("Photo removed.");
        } catch (error) { message(error.message, true); remove.disabled = false; }
      });
      card.append(img, remove);
      photoList.append(card);
    });
  }

  function selectPlace(place) {
    selectedId = place.id;
    form.elements.name.value = place.name;
    form.elements.region.value = place.region === "Travel memory" ? "" : place.region;
    form.elements.description.value = place.description === "A memory from this place." ? "" : place.description;
    form.elements.photos.value = "";
    $("#form-title").textContent = `Edit ${place.name}`;
    $("#delete-place").hidden = false;
    setLocation(...place.coordinates);
    renderPhotos(place);
    list.querySelectorAll(".saved-place").forEach((node) => node.classList.toggle("is-active", node.dataset.id === place.id));
    message(`Editing ${place.name}.`);
  }

  function renderList() {
    list.replaceChildren();
    if (!places.length) {
      const empty = document.createElement("p");
      empty.className = "empty-list";
      empty.textContent = "No saved pins yet. Add the first one here.";
      list.append(empty);
      return;
    }
    places.forEach((place) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "saved-place";
      button.dataset.id = place.id;
      const name = document.createElement("strong");
      name.textContent = place.name;
      const count = document.createElement("small");
      count.textContent = `${place.photos.length} ${place.photos.length === 1 ? "photo" : "photos"} ↗`;
      button.append(name, count);
      button.addEventListener("click", () => selectPlace(place));
      list.append(button);
    });
  }

  async function refreshPlaces(preferredId) {
    places = await window.pinboardDb.loadPlaces();
    renderList();
    const selected = places.find((place) => place.id === preferredId);
    if (selected) selectPlace(selected);
    else resetForm();
  }

  async function showEditor(user) {
    const { data, error } = await db.from("editors").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      loginPanel.hidden = false;
      editorPanel.hidden = true;
      message("This account has not been added as an editor in Supabase.", true);
      return;
    }
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    $("#signed-in-as").textContent = user.email;
    initializeMap();
    await refreshPlaces();
  }

  async function compressPhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) throw new Error(`Could not prepare ${file.name} for upload.`);
    return blob;
  }

  if (!window.pinboardDb.enabled) { setupPanel.hidden = false; return; }
  try {
    db = await window.pinboardDb.client();
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (session?.user) await showEditor(session.user);
    else loginPanel.hidden = false;
  } catch (error) { setupPanel.hidden = false; message(error.message, true); return; }

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    message("Signing in…");
    const { data, error } = await db.auth.signInWithPassword({ email: fields.get("email"), password: fields.get("password") });
    if (error) { message(error.message, true); return; }
    try { await showEditor(data.user); message("Signed in. Choose a pin or add a new one."); }
    catch (showError) { message(showError.message, true); }
  });

  $("#sign-out").addEventListener("click", async () => {
    await db.auth.signOut();
    editorPanel.hidden = true;
    loginPanel.hidden = false;
    message("Signed out.");
  });
  $("#new-place").addEventListener("click", resetForm);

  $("#address-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = $("#address").value.trim();
    if (!query) return;
    message("Looking for that place…");
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", query);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Address search is unavailable. Click the map instead.");
      const results = await response.json();
      if (!results.length) throw new Error("No match found. Try a broader place name or click the map.");
      setLocation(Number(results[0].lat), Number(results[0].lon));
      message(`Location found: ${results[0].display_name}`);
    } catch (error) { message(error.message, true); }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveButton = $("#save-place");
    saveButton.disabled = true;
    message("Saving pin…");
    try {
      const fields = new FormData(form);
      const latitude = Number(fields.get("latitude"));
      const longitude = Number(fields.get("longitude"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error("Choose a valid point on the map.");
      }
      const place = {
        name: String(fields.get("name")).trim(),
        region: String(fields.get("region")).trim(),
        description: String(fields.get("description")).trim(),
        latitude, longitude,
        sort_order: selectedId ? places.find((item) => item.id === selectedId)?.sort_order || 0 : places.length
      };
      if (selectedId) place.id = selectedId;
      const { data, error } = await db.from("places").upsert(place).select("id").single();
      if (error) throw error;
      const files = [...$("#photo-files").files];
      const existingCount = places.find((item) => item.id === data.id)?.photos.length || 0;
      for (let i = 0; i < files.length; i += 1) {
        message(`Uploading photo ${i + 1} of ${files.length}…`);
        const image = await compressPhoto(files[i]);
        const path = `${data.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await db.storage.from("travel-photos").upload(path, image, { contentType: "image/webp", upsert: false });
        if (uploadError) throw uploadError;
        const { error: photoError } = await db.from("photos").insert({ place_id: data.id, storage_path: path, alt: `Photo from ${place.name}`, sort_order: existingCount + i });
        if (photoError) throw photoError;
      }
      await refreshPlaces(data.id);
      message("Saved! Open the public map to see the update.");
    } catch (error) { message(`Save was interrupted: ${error.message}`, true); }
    finally { saveButton.disabled = false; }
  });

  $("#delete-place").addEventListener("click", async () => {
    const place = places.find((item) => item.id === selectedId);
    if (!place || !confirm(`Delete ${place.name} and all of its photos?`)) return;
    try {
      const { error } = await db.from("places").delete().eq("id", place.id);
      if (error) throw error;
      if (place.photos.length) {
        const { error: storageError } = await db.storage.from("travel-photos").remove(place.photos.map((photo) => photo.path));
        if (storageError) console.warn("Photo file cleanup failed:", storageError);
      }
      await refreshPlaces();
      message("Pin deleted.");
    } catch (error) { message(error.message, true); }
  });
})();
