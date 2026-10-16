# Rebecca's Pinboard

An interactive travel map for GitHub Pages. It currently shows four clearly labeled demo pins: Italy, Switzerland, Australia, and China. The photos in `images/` were AI-generated for the preview and are not Rebecca's travel photos.

## Preview locally

From this folder, run:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. The map needs an internet connection for Leaflet and OpenStreetMap tiles. Stop the server with Ctrl+C.

## Replace the demo content without an editor

The sample pins live in `places.js`. Each place has a name, country or region, `[latitude, longitude]`, a caption, and a `photos` array. Put images in `images/` and add their paths to that array. You can add several photos to one pin; gallery arrows appear automatically.

## Enable the on-site editor

The public site can stay on GitHub Pages. Supabase supplies the database, image storage, and editor sign-in. The website works as a demo until this setup is complete.

1. Create a free Supabase project.
2. In its **SQL Editor**, run `supabase-setup.sql` once. This creates `places`, `photos`, `editors`, a public `travel-photos` bucket, and access policies.
3. Under **Authentication → Users**, add Rebecca's editor account with an email and password. Copy its user ID (UUID).
4. In the SQL Editor, run `insert into public.editors (user_id) values ('THE_AUTH_USER_UUID');` with that ID.
5. Under **Project Settings → API**, copy the **Project URL** and **publishable key** into `config.js`. Never put a secret key or `service_role` key in the website.
6. Open `/admin.html` and sign in. Add a pin by clicking the map or searching an address, then choose photos and press **Save pin**.

Once at least one pin is saved in Supabase, the public page loads those saved pins instead of the demo pins. To keep the four country pins, add Rebecca's real locations and photos for each through the editor. The editor also lets her update or remove pins and photos.

The editor resizes uploaded photos to WebP and removes embedded photo metadata. Photos on the public map are publicly accessible. The database and storage policies permit writes only by accounts listed in `editors`; the publishable key alone does not give write access.

Address search uses the public OpenStreetMap Nominatim service only when the editor submits a search. Clicking the map works without address search. The public OSM services have usage policies and need internet access.

Supabase's free plan may pause after low activity. Open and check the live map and editor a day or two before the presentation, and again on presentation day. The local demo assets remain in this repository as a preview fallback.

## Publish on GitHub Pages

After checking the site locally, commit and push the files to `rebeccapinboard/rebeccapinboard.github.io`. In the repository, open **Settings → Pages**, set **Source** to **Deploy from a branch**, select `main` and `/(root)`, then save. The site will use `https://rebeccapinboard.github.io/`; the editor will be at `https://rebeccapinboard.github.io/admin.html` after the Supabase setup.

`requirements.md` is ignored by Git and will not be uploaded.
