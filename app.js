(async () => {
  let places = window.PLACES || [];
  let isDemo = false;
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
  const lightbox = byId("photo-lightbox");
  const lightboxImage = byId("lightbox-image");
  const lightboxTitle = byId("lightbox-title");
  const lightboxLocation = byId("lightbox-location");
  const lightboxDescription = byId("lightbox-description");
  let activePlace = null;
  let detailMap = null;
  let detailMarkers = null;
  const worldMarkers = new Map();
  const intro = document.querySelector(".intro");
  const geometryCanvas = byId("hero-geometry");

  if (intro && geometryCanvas) {
    const context = geometryCanvas.getContext("2d");
    let pointer = null;

    const drawGeometry = () => {
      const bounds = intro.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (geometryCanvas.width !== pixelWidth || geometryCanvas.height !== pixelHeight) {
        geometryCanvas.width = pixelWidth;
        geometryCanvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const spacing = width < 700 ? 58 : 68;
      const points = [];
      for (let row = 0, y = 25; y < height + spacing; row += 1, y += spacing) {
        for (let column = 0, x = -20; x < width + spacing; column += 1, x += spacing) {
          const baseX = x + (row % 2) * spacing * .5 + Math.sin(row * 8 + column * 3) * 9;
          const baseY = y + Math.cos(column * 7 + row * 2) * 8;
          let pointX = baseX;
          let pointY = baseY;
          let influence = 0;
          if (pointer) {
            const deltaX = baseX - pointer.x;
            const deltaY = baseY - pointer.y;
            const distance = Math.hypot(deltaX, deltaY);
            influence = Math.max(0, 1 - distance / 175);
            if (distance > 0) {
              pointX += (deltaX / distance) * influence * 23;
              pointY += (deltaY / distance) * influence * 23;
            }
          }
          points.push({ x: pointX, y: pointY, influence });
        }
      }

      for (let first = 0; first < points.length; first += 1) {
        for (let second = first + 1; second < points.length; second += 1) {
          const a = points[first];
          const b = points[second];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > spacing * 1.22) continue;
          const strength = Math.max(a.influence, b.influence);
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.strokeStyle = `rgba(79, 120, 144, ${.065 + strength * .3})`;
          context.lineWidth = .7 + strength * .8;
          context.stroke();
        }
      }

      points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 1.25 + point.influence * 2.2, 0, Math.PI * 2);
        context.fillStyle = `rgba(49, 86, 109, ${.14 + point.influence * .62})`;
        context.fill();
      });

      if (pointer) {
        context.beginPath();
        context.arc(pointer.x, pointer.y, 34, 0, Math.PI * 2);
        context.strokeStyle = "rgba(79, 120, 144, .42)";
        context.lineWidth = 1;
        context.stroke();
        context.beginPath();
        context.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
        context.fillStyle = "rgba(49, 86, 109, .72)";
        context.fill();
      }
    };

    const canFollowPointer = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canFollowPointer) {
      intro.addEventListener("pointermove", (event) => {
        const bounds = intro.getBoundingClientRect();
        pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        drawGeometry();
      });
      intro.addEventListener("pointerleave", () => {
        pointer = null;
        drawGeometry();
      });
    }
    new ResizeObserver(drawGeometry).observe(intro);
    drawGeometry();
  }

  function openLightbox(photo, place) {
    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.alt || photo.title || `Photograph from ${place.name}`;
    lightboxTitle.textContent = photo.title || place.name;
    lightboxLocation.textContent = `⌖ ${photo.location || place.name}`;
    lightboxDescription.textContent = photo.description || "Rebecca's description and photography techniques will go here.";
    lightbox.showModal();
    byId("lightbox-close").focus();
  }

  byId("lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  byId("place-total").textContent = `${places.length} ${places.length === 1 ? "place" : "places"} to explore`;
  if (!isDemo) {
    document.querySelector(".demo-note").hidden = true;
    byId("mode-indicator").hidden = true;
  }

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
    const usesCollage = place.name === "China" || place.name === "Japan";
    photoGrid.classList.toggle("photo-grid--collage", usesCollage);
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
      if (usesCollage) card.classList.add("photo-card--collage");
      card.id = `photo-${place.id}-${index}`;
      const media = document.createElement("div");
      media.className = "photo-card-media";
      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.alt || `Photograph ${index + 1} from ${place.name}`;
      img.loading = index < 2 ? "eager" : "lazy";
      media.append(img);

      if (usesCollage) {
        const setCollageShape = () => {
          card.classList.toggle("is-portrait", img.naturalHeight > img.naturalWidth * 1.08);
        };
        if (img.complete) setCollageShape();
        else img.addEventListener("load", setCollageShape, { once: true });

        const open = document.createElement("button");
        open.type = "button";
        open.className = "collage-open";
        open.setAttribute("aria-label", `Open ${photo.title || `photograph ${index + 1}`} from ${place.name}`);
        open.addEventListener("click", () => openLightbox(photo, place));
        media.append(open);
      }

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "photo-info";
      trigger.textContent = "i";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-label", `Open description for ${photo.title || photo.alt || place.name}`);
      if (!usesCollage) media.append(trigger);

      if (photo.sample !== false && isDemo) {
        const tag = document.createElement("span");
        tag.className = "sample-tag";
        tag.textContent = "SAMPLE PHOTO";
        media.append(tag);
      }

      const panel = document.createElement("div");
      panel.className = "photo-description";
      panel.id = `photo-notes-${place.id}-${index}`;
      panel.hidden = true;
      trigger.setAttribute("aria-controls", panel.id);
      const label = document.createElement("strong");
      label.textContent = "About this photograph";
      const body = document.createElement("p");
      body.textContent = photo.description || "Rebecca's description and photography techniques will go here.";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "photo-description-close";
      close.textContent = "Close";
      panel.append(label, body, close);

      const setOpen = (open) => {
        card.classList.toggle("is-open", open);
        panel.hidden = !open;
        trigger.setAttribute("aria-expanded", String(open));
        trigger.setAttribute("aria-label", `${open ? "Close" : "Open"} description for ${photo.title || photo.alt || place.name}`);
      };
      trigger.addEventListener("click", () => setOpen(!card.classList.contains("is-open")));
      close.addEventListener("click", () => {
        setOpen(false);
        trigger.focus();
      });

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
      if (usesCollage) {
        card.append(media);
      } else {
        card.append(media, panel, bodyWrap);
      }
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
      const groups = new Map();
      photosWithLocations.forEach((photo) => {
        const key = photo.locationId || `${photo.coordinates[0]},${photo.coordinates[1]}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(photo);
      });
      groups.forEach((group) => {
        const photo = group[0];
        const label = photo.location || place.name;
        const count = group.length;
        const icon = L.divIcon({
          className: "detail-photo-marker-wrap",
          html: `<span class="detail-photo-marker"><span>${count}</span><small>${count === 1 ? "photo" : "photos"}</small></span>`,
          iconSize: [58, 58],
          iconAnchor: [29, 29]
        });
        const popup = document.createElement("button");
        popup.type = "button";
        popup.className = "map-photo-link";
        popup.textContent = `${label} · ${count} ${count === 1 ? "photo" : "photos"}`;
        popup.addEventListener("click", () => {
          if (place.name === "China" || place.name === "Japan") {
            openLightbox(photo, place);
          } else {
            const index = place.photos.indexOf(photo);
            document.getElementById(`photo-${place.id}-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
        L.marker(photo.coordinates, { icon, title: `${label}, ${count} photos`, alt: label, keyboard: true })
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

  function openPlace(place, { scroll = true } = {}) {
    activePlace = place;
    byId("detail-title").textContent = place.name;
    byId("detail-region").textContent = place.region || "Travel photography";
    byId("detail-description").textContent = place.description || "Photographs and stories from this place.";
    renderPhotos(place);
    detail.hidden = false;
    refreshSelection();
    updateDetailMap(place);
    if (scroll) detail.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const overview = byId("map");
  const worldBounds = [[-85.0511, -180], [85.0511, 180]];
  const minimumOverviewZoom = () => overview.clientWidth >= 800 ? 2 : 1;
  const worldMap = L.map("map", {
    scrollWheelZoom: true,
    touchZoom: true,
    zoomControl: false,
    zoomSnap: 0.25,
    minZoom: minimumOverviewZoom(),
    maxBounds: worldBounds,
    maxBoundsViscosity: 1
  }).setView([20, 30], 2);
  worldMap.on("resize", () => worldMap.setMinZoom(minimumOverviewZoom()));
  L.control.zoom({ position: "bottomright" }).addTo(worldMap);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    noWrap: true,
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
    worldMap.fitBounds(bounds, { padding: [45, 45], maxZoom: 3 });
    openPlace(places[0], { scroll: false });
  }
})();
