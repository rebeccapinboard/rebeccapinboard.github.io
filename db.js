(() => {
  const config = window.PINBOARD_CONFIG || {};
  const enabled = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  let clientPromise;

  async function client() {
    if (!enabled) throw new Error("Add the Supabase project URL and publishable key in config.js first.");
    if (!clientPromise) {
      clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
        .then(({ createClient }) => createClient(config.supabaseUrl, config.supabasePublishableKey));
    }
    return clientPromise;
  }

  async function loadPlaces() {
    const db = await client();
    const { data, error } = await db.from("places")
      .select("id,name,region,latitude,longitude,description,sort_order,photos(id,storage_path,alt,sort_order)")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data.map((place) => ({
      id: place.id,
      name: place.name,
      region: place.region || "Travel memory",
      coordinates: [place.latitude, place.longitude],
      sort_order: place.sort_order,
      zoom: 7,
      description: place.description || "A memory from this place.",
      photos: (place.photos || []).sort((a, b) => a.sort_order - b.sort_order).map((photo) => ({
        id: photo.id,
        path: photo.storage_path,
        src: db.storage.from("travel-photos").getPublicUrl(photo.storage_path).data.publicUrl,
        alt: photo.alt || `Photo from ${place.name}`
      }))
    }));
  }

  window.pinboardDb = { enabled, client, loadPlaces };
})();
