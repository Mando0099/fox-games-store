# Fox Games Market - Ready For Hosting

Dark gaming marketplace inspired by your screenshot.

## Local Run
Double click `START-WINDOWS.bat`, then open `http://localhost:9000`.

Manual:
```bash
npm install
npm start
```

## Kashier
Frontend calls `POST /api/kashier/create-payment`.
Backend creates signed Kashier checkout URL and redirects customer.

## Edit Products
Open `public/js/script.js` and edit the `products` array.

## Edit Design
Open `public/css/style.css`.

## Real Game Images
Included assets are original SVG placeholders. To use real PUBG/Fortnite/Steam/PSN/Xbox images, put licensed images in `public/assets/real-images/` and update paths in `public/js/script.js`.

## Hosting
Use Node.js hosting: Render, Railway, VPS, DigitalOcean, etc.
Set env vars: `KASHIER_MODE`, `KASHIER_BASE_URL`, `KASHIER_MERCHANT_ID`, `KASHIER_API_KEY`, `PUBLIC_BASE_URL`.
