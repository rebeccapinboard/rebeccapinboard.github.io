(async () => {
  let places = window.PLACES || [];
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

  const byId = (id) => document.getElementById(id);
  const list = byId("country-list");
  const detail = byId("country-detail");
  const photoGrid = byId("photo-grid");
  let activePlace = null;
  let detailMap = null;
  let detailMarkers = null;
  const worldMarkers = new Map();

  byId("place-total").textContent = `${places.length} ${places.length === 1 ? "place" : "places"} to explore`;
  if (!isDemo) document.querySelector(".demo-note").hidden = true;

  function refreshSelection() {
    list.querySelectorAll("button").forEach((button) => {
      const selected = button.dataset.place === activePlace?.id;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    worldMarkers.forEach((marker, id) => {
      marker.getElement()?.classList.toggle("is-active", id === activePlace?.id);
    });
  }

  function renderPhotos(place) {
    photoGrid.replaceChildren();
    byId("detail-photo-count").textContent = `${place.photos.length} ${place.photos.length === 1 ? "photograph" : "photographs"}`;
    if (!place.photos.length) {
      const empty = document.createElement("p");
      empty.className = "photo-empty";
      empty.textContent = "Photographs coming soon.";
      photoGrid.append(empty);
      return;
    }

    place.photos.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      const media = document.createElement("div");
      media.className = "photo-card-media";
      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.alt || `Photograph ${index + 1} from ${place.name}`;
      img.loading = index < 2 ? "eager" : "lazy";
      media.append(img);

      if (photo.sample !== false && isDemo) {
        const tag = document.createElement("span");
        tag.className = "sample-tag";
        tag.textContent = "SAMPLE PHOTO";
        media.append(tag);
      }

      const notes = document.createElement("div");
      notes.className = "photo-notes";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.setAttribute("aria-label", `Photo description and techniques for ${photo.alt || place.name}`);
      trigger.setAttribute("aria-expanded", "false");
      trigger.title = "Photo description and techniques";
      trigger.textContent = "i";
      const panel = document.createElement("div");
      panel.className = "photo-notes-panel";
      panel.id = `photo-notes-${place.id}-${index}`;
      trigger.setAttribute("aria-controls", panel.id);
      const label = document.createElement("strong");
      label.textContent = "About this photograph";
      const body = document.createElement("p");
      body.textContent = photo.description || "Rebecca's description and photography techniques will go here.";
      panel.append(label, body);
      notes.append(trigger, panel);
      trigger.addEventListener("click", () => {
        const open = notes.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(open));
      });
      media.append(notes);

      const bodyWrap = document.createElement("div");
      bodyWrap.className = "photo-card-body";
      const location = document.createElement("button");
      location.className = "photo-location";
      location.type = "button";
      location.textContent = `⌖ ${photo.location || place.name}`;
      location.setAttribute("aria-label", `Show ${photo.location || place.name} on the map`);
      location.addEventListener("click", () => {
        if (detailMap) {
          detailMap.flyTo(photo.coordinates || place.coordinates, Math.max(place.zoom || 6, 7));
          byId("detail-map").scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      const title = document.createElement("h3");
      title.className = "photo-card-title";
      title.textContent = photo.title || `${place.name} · ${String(index + 1).padStart(2, "0")}`;
      bodyWrap.append(location, title);
      card.append(media, bodyWrap);
      photoGrid.append(card);
    });
  }

  function updateDetailMap(place) {
    if (!window.L) {
      byId("detail-map").innerHTML = '<p class="map-error">The map could not load. Photo locations are listed below.</p>';
      return;
    }
    if (!detailMap) {
      detailMap = L.map("detail-map", { scrollWheelZoom: true, touchZoom: true, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(detailMap);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(detailMap);
      detailMarkers = L.layerGroup().addTo(detailMap);
    }
    detailMarkers.clearLayers();
    const photosWithLocations = place.photos.filter((photo) => Array.isArray(photo.coordinates));
    if (photosWithLocations.length) {
      photosWithLocations.forEach((photo) => {
        const label = photo.location || place.name;
        const popup = document.createElement("span");
        popup.textContent = label;
        L.marker(photo.coordinates, { title: label, alt: label, keyboard: true })
          .bindPopup(popup).addTo(detailMarkers);
      });
      const bounds = L.latLngBounds(photosWithLocations.map((photo) => photo.coordinates));
      detailMap.fitBounds(bounds, { padding: [45, 45], maxZoom: place.zoom || 7 });
    } else {
      const popup = document.createElement("span");
      popup.textContent = place.name;
      L.marker(place.coordinates, { title: place.name, alt: place.name, keyboard: true })
        .bindPopup(popup).addTo(detailMarkers);
      detailMap.setView(place.coordinates, place.zoom || 6);
    }
    requestAnimationFrame(() => detailMap.invalidateSize());
  }

  function openPlace(place) {
    activePlace = place;
    byId("detail-title").textContent = place.name;
    byId("detail-region").textContent = place.region || "Travel photography";
    byId("detail-description").textContent = place.description || "Photographs and stories from this place.";
    renderPhotos(place);
    detail.hidden = false;
    refreshSelection();
    updateDetailMap(place);
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  places.forEach((place, index) => {
    const button = document.createElement("button");
    button.className = "country-button";
    button.type = "button";
    button.dataset.place = place.id;
    button.innerHTML = `<span class="country-number">${String(index + 1).padStart(2, "0")}</span><span class="country-name"></span><span class="country-arrow" aria-hidden="true">↗</span>`;
    button.querySelector(".country-name").textContent = place.name;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => openPlace(place));
    list.append(button);
  });

  if (!window.L) {
    byId("map").innerHTML = '<p class="map-error">The map could not load. Choose a country below to see its photos.</p>';
    return;
  }

  const worldMap = L.map("map", { scrollWheelZoom: true, touchZoom: true, zoomControl: false, worldCopyJump: true }).setView([20, 30], 2);
  L.control.zoom({ position: "bottomright" }).addTo(worldMap);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(worldMap);

  places.forEach((place) => {
    const icon = L.divIcon({
      className: "travel-marker-wrap",
      html: '<span class="travel-marker" aria-hidden="true"><span class="marker-center"></span></span>',
      iconSize: [42, 50],
      iconAnchor: [21, 48]
    });
    const marker = L.marker(place.coordinates, { icon, title: `Open ${place.name} photo gallery`, alt: place.name, keyboard: true }).addTo(worldMap);
    marker.on("click", () => openPlace(place));
    worldMarkers.set(place.id, marker);
  });

  // At world scale, the demo's Italy and Switzerland pins overlap.
  if (isDemo && worldMarkers.has("italy") && worldMarkers.has("switzerland")) {
    const cluster = L.marker([44.83, 10.5], {
      icon: L.divIcon({ className: "travel-cluster-wrap", html: '<span class="travel-cluster">2</span>', iconSize: [40, 40], iconAnchor: [20, 20] }),
      title: "Zoom in to Italy and Switzerland",
      keyboard: true
    });
    cluster.on("click", () => worldMap.flyTo([44.83, 10.5], 5, { duration: 1 }));
    const updateCluster = () => {
      const grouped = worldMap.getZoom() < 4;
      ["italy", "switzerland"].forEach((id) => {
        const marker = worldMarkers.get(id);
        if (grouped && worldMap.hasLayer(marker)) worldMap.removeLayer(marker);
        if (!grouped && !worldMap.hasLayer(marker)) marker.addTo(worldMap);
      });
      if (grouped && !worldMap.hasLayer(cluster)) cluster.addTo(worldMap);
      if (!grouped && worldMap.hasLayer(cluster)) worldMap.removeLayer(cluster);
      refreshSelection();
    };
    worldMap.on("zoomend", updateCluster);
    updateCluster();
  }

  if (places.length) {
    const bounds = L.latLngBounds(places.map((place) => place.coordinates));
    worldMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 3 });
  }
})();
