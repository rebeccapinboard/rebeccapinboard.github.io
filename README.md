# Rebecca's Pinboard

An interactive photography map for GitHub Pages. It currently shows five clearly labeled demo places: Italy, Switzerland, Australia, China, and Japan. The photos in `images/` were AI-generated for the preview and are not Rebecca's travel photos.

## Preview locally

From this folder, run:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. The map needs an internet connection for Leaflet and OpenStreetMap tiles. Stop the server with Ctrl+C.

## Replace the demo content without an editor

The sample places live in `places.js`. Each place has a name, region, `[latitude, longitude]`, an introduction, and a `photos` array. Put images in `images/` and add one entry per photo. Each photo can have `src`, `alt`, `title`, `location`, `coordinates`, and `description`. The description appears from the small **i** button on hover, click, or tap; use it for Rebecca's photography techniques and story. If a photo has coordinates, its pin appears on the country map. Without coordinates, the map shows the country's pin instead. Set `sample: false` on Rebecca's real photos so they do not carry a sample label.

For example:

```js
{ src: "images/italy-street.webp", alt: "A street in Rome", title: "Afternoon light", location: "Rome, Italy", coordinates: [41.9028, 12.4964], description: "Rebecca's notes about framing, perspective, and light.", sample: false }
```

Country cards scroll sideways to show all five places. Selecting one opens a focused map and its photographs below the world map. Photos added to this repository are public on GitHub Pages, so only use images Rebecca is comfortable sharing publicly.

## Enable the on-site editor

The public site can stay on GitHub Pages. Supabase supplies the database, image storage, and editor sign-in. The website works as a demo until this setup is complete.

1. Create a free Supabase project.
2. In its **SQL Editor**, run `supabase-setup.sql` once. This creates `places`, `photos`, `editors`, a public `travel-photos` bucket, and access policies.
3. Under **Authentication → Users**, add Rebecca's editor account with an email and password. Copy its user ID (UUID).
4. In the SQL Editor, run `insert into public.editors (user_id) values ('THE_AUTH_USER_UUID');` with that ID.
5. Under **Project Settings → API**, copy the **Project URL** and **publishable key** into `config.js`. Never put a secret key or `service_role` key in the website.
6. Open `/admin.html` and sign in. Add a pin by clicking the map or searching an address, then choose photos and press **Save pin**.

Once at least one pin is saved in Supabase, the public page loads those saved pins instead of the demo pins. To keep the five country pins, add Rebecca's real locations and photos for each through the editor. The editor also lets her update or remove pins and photos. The current editor does not yet collect individual photo descriptions or locations; use `places.js` for those fields when Rebecca sends you her pictures.

The editor resizes uploaded photos to WebP and removes embedded photo metadata. Photos on the public map are publicly accessible. The database and storage policies permit writes only by accounts listed in `editors`; the publishable key alone does not give write access.

Address search uses the public OpenStreetMap Nominatim service only when the editor submits a search. Clicking the map works without address search. The public OSM services have usage policies and need internet access.

Supabase's free plan may pause after low activity. Open and check the live map and editor a day or two before the presentation, and again on presentation day. The local demo assets remain in this repository as a preview fallback.

## Publish on GitHub Pages

After checking the site locally, commit and push the files to `rebeccapinboard/rebeccapinboard.github.io`. In the repository, open **Settings → Pages**, set **Source** to **Deploy from a branch**, select `main` and `/(root)`, then save. The site will use `https://rebeccapinboard.github.io/`; the editor will be at `https://rebeccapinboard.github.io/admin.html` after the Supabase setup.

`requirements.md` is ignored by Git and will not be uploaded.
