(async () => {
  let places = window.PLACES;
  let isDemo = true;
  if (window.pinboardDb.enabled) {
    try {
      const savedPlaces = await window.pinboardDb.loadPlaces();
      if (savedPlaces.length) {
        places = savedPlaces;
        isDemo = false;
        document.getElementById("mode-indicator").hidden = true;
      }
    } catch (error) {
      console.error("Could not load saved places:", error);
      const indicator = document.getElementById("mode-indicator");
      indicator.textContent = "SAVED CONTENT UNAVAILABLE — SHOWING DEMO";
      indicator.classList.add("is-error");
      document.getElementById("demo-note-title").textContent = "Showing the preview while saved places are unavailable.";
      document.getElementById("demo-note-text").textContent = "Check the Supabase project before presenting. The country pins below are sample content.";
    }
  }
  document.getElementById("place-total").textContent = `${places.length} ${places.length === 1 ? "place" : "places"} to explore`;
  if (!isDemo) document.querySelector(".demo-note").hidden = true;
  document.getElementById("photo-tag").textContent = isDemo ? "SAMPLE PHOTO" : "TRAVEL PHOTO";
  const list = document.getElementById("country-list");
  const albumPhoto = document.getElementById("album-photo");
  const albumTitle = document.getElementById("album-title");
  const albumRegion = document.getElementById("album-region");
  const albumDescription = document.getElementById("album-description");
  const photoCount = document.getElementById("photo-count");
  const photoTag = document.getElementById("photo-tag");
  const photoWrap = document.querySelector(".album-photo-wrap");

  let activePlace = null;
  let activePhotoIndex = 0;
  let map = null;
  const markers = new Map();

  function refreshMarkerSelection() {
    markers.forEach((marker, id) => marker.getElement()?.classList.toggle("is-active", id === activePlace?.id));
  }

  function renderPhoto() {
    if (!activePlace.photos.length) {
      albumPhoto.removeAttribute("src");
      albumPhoto.alt = "No photos have been added for this place yet";
      albumPhoto.hidden = true;
      photoTag.hidden = true;
      photoWrap.classList.add("is-empty");
      photoCount.textContent = "NO PHOTOS YET";
      photoWrap.querySelectorAll(".gallery-control").forEach((node) => node.remove());
      return;
    }
    const photo = activePlace.photos[activePhotoIndex];
    albumPhoto.hidden = false;
    photoTag.hidden = false;
    photoWrap.classList.remove("is-empty");
    albumPhoto.src = photo.src;
    albumPhoto.alt = photo.alt;
    photoCount.textContent = `${String(activePhotoIndex + 1).padStart(2, "0")} / ${String(activePlace.photos.length).padStart(2, "0")} ${activePlace.photos.length === 1 ? "PHOTO" : "PHOTOS"}`;

    photoWrap.querySelectorAll(".gallery-control").forEach((node) => node.remove());
    if (activePlace.photos.length > 1) {
      ["previous", "next"].forEach((direction) => {
        const button = document.createElement("button");
        button.className = `gallery-control gallery-${direction}`;
        button.type = "button";
        button.setAttribute("aria-label", `${direction === "previous" ? "Previous" : "Next"} photo of ${activePlace.name}`);
        button.textContent = direction === "previous" ? "‹" : "›";
        button.addEventListener("click", () => {
          const change = direction === "previous" ? -1 : 1;
          activePhotoIndex = (activePhotoIndex + change + activePlace.photos.length) % activePlace.photos.length;
          renderPhoto();
        });
        photoWrap.append(button);
      });
    }
  }

  function selectPlace(place, moveMap = true) {
    activePlace = place;
    activePhotoIndex = 0;
    albumTitle.textContent = place.name;
    albumRegion.textContent = place.region;
    albumDescription.textContent = place.description;
    renderPhoto();

    list.querySelectorAll("button").forEach((button) => {
      const isActive = button.dataset.place === place.id;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    refreshMarkerSelection();
    if (moveMap && map) map.flyTo(place.coordinates, place.zoom || 7, { duration: 1.1 });
  }

  places.forEach((place, index) => {
    const button = document.createElement("button");
    button.className = "country-button";
    button.type = "button";
    button.dataset.place = place.id;
    button.innerHTML = `<span class="country-number">${String(index + 1).padStart(2, "0")}</span><span class="country-name"></span><span class="country-arrow" aria-hidden="true">↗</span>`;
    button.querySelector(".country-name").textContent = place.name;
    button.addEventListener("click", () => selectPlace(place));
    list.append(button);
  });

  selectPlace(places[0], false);

  if (!window.L) {
    document.getElementById("map").innerHTML = '<p class="map-error">The map could not load. Check your internet connection, or choose a country below to see its photos.</p>';
    return;
  }

  map = L.map("map", { scrollWheelZoom: true, touchZoom: true, zoomControl: false, worldCopyJump: true }).setView([20, 30], 2);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  places.forEach((place) => {
    const icon = L.divIcon({
      className: "travel-marker-wrap",
      html: '<span class="travel-marker" aria-hidden="true"><span class="marker-center"></span></span>',
      iconSize: [42, 50],
      iconAnchor: [21, 48]
    });
    const marker = L.marker(place.coordinates, { icon, title: `Open ${place.name} photo album`, alt: place.name, keyboard: true }).addTo(map);
    marker.on("click", () => selectPlace(place, false));
    markers.set(place.id, marker);
  });

  // The demo's Italy and Switzerland pins overlap at world scale. A small
  // cluster lets visitors zoom in and then choose either country accurately.
  if (isDemo && markers.has("italy") && markers.has("switzerland")) {
    const cluster = L.marker([44.83, 10.5], {
      icon: L.divIcon({ className: "travel-cluster-wrap", html: '<span class="travel-cluster">2</span>', iconSize: [40, 40], iconAnchor: [20, 20] }),
      title: "Zoom in to Italy and Switzerland",
      keyboard: true
    });
    cluster.on("click", () => map.flyTo([44.83, 10.5], 5, { duration: 1 }));
    const updateCluster = () => {
      const grouped = map.getZoom() < 4;
      ["italy", "switzerland"].forEach((id) => {
        const marker = markers.get(id);
        if (grouped && map.hasLayer(marker)) map.removeLayer(marker);
        if (!grouped && !map.hasLayer(marker)) marker.addTo(map);
      });
      if (grouped && !map.hasLayer(cluster)) cluster.addTo(map);
      if (!grouped && map.hasLayer(cluster)) map.removeLayer(cluster);
      refreshMarkerSelection();
    };
    map.on("zoomend", updateCluster);
    updateCluster();
  }

  const bounds = L.latLngBounds(places.map((place) => place.coordinates));
  map.fitBounds(bounds, { padding: [36, 36], maxZoom: 3 });
  refreshMarkerSelection();
})();
