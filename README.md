# camera-kakaomap-gpt

Custom GPT action backend for this flow:

- full management number like `A1234` -> exact camera + Kakao Map link
- four digits like `1234` -> every camera whose management number ends with `1234`

## What is included

- `src/index.ts`: Hono API server
- `src/lib/camera-store.ts`: query logic for exact and four-digit suffix lookup
- `src/lib/data-go-kr.ts`: public data sync helper for `data.go.kr`
- `scripts/sync-cameras.ts`: downloads the dataset into `data/cameras.json`
- `openapi.yaml`: Custom GPT Action schema
- `gpt-instructions.md`: starter GPT instructions

## Quick start

```bash
npm install
copy .env.example .env
npm run check
npm run start
```

Open:

```text
http://localhost:3000/health
http://localhost:3000/camera-link?cameraCode=A1234
http://localhost:3000/camera-link?cameraCode=1234
```

## Public data sync

1. Issue a service key for the public dataset.
2. Put the encoded key in `.env` as `DATA_GO_KR_SERVICE_KEY`.
3. Run:

```bash
npm run sync
```

This writes `data/cameras.json`.

To serve the synced file:

```bash
set CAMERA_DATA_PATH=data/cameras.json
npm run start
```

## GPT Builder setup

1. Deploy this API over HTTPS.
2. Replace `https://YOUR_DOMAIN` in `openapi.yaml`.
3. Import `openapi.yaml` into the GPT Actions panel.
4. Paste `gpt-instructions.md` into the GPT instructions area.
5. If your API requires a key, configure Action authentication.

## Notes

- The query logic treats exactly four digits as suffix mode.
- Any other input is treated as a full management number lookup.
- Kakao Map links are returned as `https://map.kakao.com/link/map/...`.

## Simplest Vercel deploy

What you need to do:

1. Log in to Vercel
2. Run the production deploy
3. Register `DATA_GO_KR_SERVICE_KEY` in Vercel if you want future sync jobs there
4. Re-save the GPT Action after you get the permanent domain

Commands:

```bash
npm i -g vercel
vercel login
vercel --prod
```

This project is set up so Vercel can detect the Hono app from [src/index.ts](./src/index.ts).

## Before deploy

- Keep [data/cameras.json](./data/cameras.json) in the project so the deployed app can serve real data immediately.
- Run `npm run check` once before deploying.
