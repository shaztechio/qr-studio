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

Every push to `main` runs the offline tests. Once they pass, a separate job updates `qr-studio.version` in the shaztech.io website repository to that exact tested commit. That commit triggers GitHub Pages, which runs the tests again and deploys `index.html` and `sw.js` to https://shaztech.io/apps/qr/.

Pull requests run tests only. Failed tests prevent publication. Older runs skip publication when a newer commit is already on `main`. You can manually rerun the workflow on `main` to retry a release; selecting an already-published version is a no-op. If publication succeeded but the website deployment failed, rerun the website's Pages workflow.

The app URL and service worker scope remain unchanged. Publishing can take a few minutes after tests pass.

### Deployment credentials

The `SHAZTECH_IO_DEPLOY_KEY` Actions secret contains a dedicated SSH key with write access only to the shaztech.io repository. It is used only by the main-branch publishing job, after tests pass. The matching deploy key on the website repository is titled `QR Studio automatic deployment`.

To rotate it, add a replacement write-enabled deploy key to the website repository, update this repository's secret, verify a release, then remove the old key. To disable automatic publication, remove the secret and revoke the corresponding website deploy key.

For a rollback, commit a previous known-good SHA to the website's `qr-studio.version`. The next successful main-branch release will advance it again.

## License

MIT. The embedded qrcode-generator is Copyright (c) 2009 Kazuhiko Arase and is also MIT licensed; its notice is preserved in `index.html`.
