# Cloudflare Deployment

This project stores charts and MP3 files in Cloudflare R2.

## Architecture

```txt
Cloudflare Worker
  API and static app hosting

Cloudflare R2 bucket: rhythm-festa-assets
  charts/*.json
  music/*.mp3
```

No database is required for the current MVP.

## First Setup

Log in to Cloudflare:

```sh
npx wrangler login
```

Create the R2 bucket:

```sh
npm run cf:bucket:create
```

Optionally set an admin token. When set, save, upload, and delete APIs require the same token from the maker screen.

```sh
npx wrangler secret put ADMIN_TOKEN
```

For local Cloudflare preview, copy `.dev.vars.example` to `.dev.vars` and edit the token.

Seed the current demo assets into R2:

```sh
npm run cf:seed:chart
npm run cf:seed:music
```

Deploy:

```sh
npm run deploy
```

## Local Cloudflare Preview

```sh
npm run dev:cloudflare
```

The plain Vite dev server still works:

```sh
npm run dev
```

When the Worker API is not available, the app falls back to `public/charts/demo.json`.

## API

```txt
GET    /api/charts
GET    /api/charts/:id
PUT    /api/charts/:id
DELETE /api/charts/:id

GET    /api/music
POST   /api/music
DELETE /api/music/:filename

GET    /music/:filename
```

MP3 uploads are limited to 50 MB and are stored under `music/`.
