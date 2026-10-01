# Film Chronicles

A private photo journal for film photography. Sign in, upload a frame, and keep the camera settings and film recipe next to the picture. It is not a social feed.

There is no hosted demo. GitHub Pages is not enabled for this repository.

![Film Chronicles logo](src/assets/film-chronicles-logo.png)

The repo does not include a screenshot of the app. The image above is the logo.

## What it does

- **Upload** is limited to admin accounts. On upload, `exifr` reads aperture, shutter speed, ISO, camera model, capture time, and Fuji film mode when the file has it.
- **Edit** those fields, plus shoot type, after the photo is in.
- **Gallery** can be grid, list, or masonry.
- **Filters** cover camera, recipe, shoot type, tag, and a date range.
- **Share** a photo with another Film Chronicles account by email.
- **Export** the photos you select, or all of them.
- **AI organize** writes shoot type, recipe, and tags for the photos you pick. That path calls the `ai-organize` Supabase function, which needs its own API key configured.
- A photo page has comments and likes.

## Run it

```sh
git clone https://github.com/paige-millz/filmchronicles.git
cd filmchronicles
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

```sh
npm run dev
```

Vite serves the app at http://localhost:8080. Sign-in and upload need a Supabase project with the migrations in `supabase/migrations`.
