# QR Studio

A browser-based QR code generator. Turn text or a URL into a QR code, add an optional center image, and download a PNG. Processing happens on your device.

**Use the app:** https://shaztech.io/apps/qr/

## Local preview

From this directory, stage the app at its production path and start a local server:

```sh
mkdir -p .preview/apps/qr
cp index.html sw.js .preview/apps/qr/
python3 -m http.server 8000 --bind 127.0.0.1 --directory .preview
```

Open http://127.0.0.1:8000/apps/qr/. Repeat the copy after editing the app. The service worker registers only at `/apps/qr/` or `/apps/qr/index.html`.

The app has no build step or package dependencies. Its styles and QR generator are embedded in `index.html`.

## Tests

With Node.js 22 or newer, run:

```sh
node --test tests/qr-offline.test.cjs
```

The tests cover service worker installation, cache cleanup and refresh, offline fallback, failed precaching, and navigation scope.

## Offline access

After an initial online visit, `sw.js` caches the app for reopening offline in the same browser. Wait for “Available offline in this browser,” stop the preview server, and reload to check it locally. Production hosting requires HTTPS; localhost also works.

The worker uses the network first with a three-second timeout, then falls back to its cached copy. It handles only app navigations and never caches entered text or uploaded images. Clearing site data or browser storage eviction removes the offline copy. Bump the cache version when changing the caching strategy.

## Deployment

The shaztech.io website deploys `index.html` and `sw.js` from a pinned commit of this repository to `/apps/qr/`. Updating this repository alone does not update the live app. To release a change, run the tests, update the QR Studio checkout commit in the website’s `.github/workflows/pages.yml`, and deploy the website.

The app URL and service worker scope remain https://shaztech.io/apps/qr/.

## License

MIT. The embedded qrcode-generator is Copyright (c) 2009 Kazuhiko Arase and is also MIT licensed; its notice is preserved in `index.html`.
