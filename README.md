# Film Chronicles

A personal photo journal built for film photographers who want to track their work without sharing on social media.

I built this because I wanted a private space to organize photos I take on film, track the camera settings and film recipes I use, and actually improve my photography by reviewing the technical details — without posting everything publicly.

## What It Does

- **EXIF auto-parsing** — Upload a photo and it automatically extracts aperture, shutter speed, ISO, camera model, and capture time
- **Film recipe tracking** — Tag photos with the film simulation recipe used so you can see which recipes produce results you like
- **AI-powered organization** — Automatically categorize and tag photos using AI
- **Multiple view modes** — Grid, list, and dashboard views to browse your gallery
- **Sharing without social** — Generate share links for individual photos without needing a social media account
- **Bulk export** — Download all photos at once for backup or printing
- **Date and tag filtering** — Filter your gallery by date range, camera, recipe, shoot type, or custom tags

## Tech Stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Supabase (auth, database, storage), Tanstack Query

## Running Locally

```sh
git clone https://github.com/paige-millz/filmchronicles.git
cd filmchronicles
npm install
# Create a .env file with your Supabase credentials:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
npm run dev
```

## Why I Built This

Most photo sharing tools are designed around social engagement — likes, followers, algorithms. I wanted something focused entirely on the craft: what settings did I use, what recipe worked, how is my technique improving over time. This is a tool for me, not an audience.
