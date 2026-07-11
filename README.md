# PocketScan

**PocketScan** is an offline-first Progressive Web App (PWA) that turns your phone camera
into a document scanner. Capture pages, clean them up, and export single- or multi-page
PDFs — all locally in your browser. Nothing is uploaded to any server, and there is no
account to create.

> 🔒 **Your scans remain on this device unless you explicitly download or share them.**

- 📷 Scan with the rear camera (with a photo-library / file-picker fallback)
- 📄 Combine multiple pages into one PDF, reorder, rotate, crop, retake, replace, delete
- 🎨 Crop + perspective correction, brightness/contrast, grayscale, black & white, sharpen
- 📁 Organize PDFs into folders; search, sort, favorite, move, duplicate, rename
- 🗑️ Trash with restore + permanent delete
- 💾 Everything stored locally in IndexedDB (Dexie); works fully offline
- ⚡ Installable PWA with a safe update strategy that never interrupts an active scan
- ♻️ Draft recovery: an interrupted scan can be resumed

Built with **React + TypeScript + Vite**, **Dexie.js** (IndexedDB), **pdf-lib**, a
Canvas-based image pipeline running in a **Web Worker**, and **vite-plugin-pwa** (Workbox).

---

## Quick start

Requirements: **Node.js 20+** and npm.

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
# open http://localhost:5173
```

### Run over HTTPS for phone-camera testing

Browsers only grant camera access in a **secure context**. To test the live camera on a
real phone, serve the app over HTTPS on your local network:

```bash
npm run dev:https
```

This starts Vite with a self-signed certificate (via `@vitejs/plugin-basic-ssl`) and binds
to all network interfaces. The terminal prints a `https://<your-lan-ip>:5173` URL.

### Test from another device on the local network

1. Ensure your phone and computer are on the **same Wi-Fi network**.
2. Run `npm run dev:https`.
3. On your phone, open the printed `https://<your-computer-ip>:5173` address.
4. Accept the self-signed certificate warning (Advanced → Proceed). This is expected for a
   local dev certificate.
5. Tap **New Scan** and allow camera access when prompted.

> If the camera still won't start, confirm you're using **https://** (not http) and that no
> other app is using the camera.

---

## Building for production

```bash
npm run build     # type-checks, then builds to dist/
npm run preview   # serves the production build locally on http://localhost:4173
```

The build output in `dist/` is a fully static bundle (HTML, JS, CSS, service worker,
manifest, icons).

### Deploy to a static host

PocketScan is a static SPA and can be hosted on any static host (Netlify, Vercel, GitHub
Pages, Cloudflare Pages, S3 + CloudFront, nginx, etc.). It uses **hash-based routing**
(`/#/route`) so **no server rewrite rules are required** and it works from a subpath.

- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, publish directory
  `dist`.
- **GitHub Pages:** run `npm run build` and publish the `dist/` folder (e.g. with the
  `gh-pages` branch or an action). Because routing is hash-based and asset paths are
  relative (`base: './'`), it works under `https://<user>.github.io/<repo>/`.
- **Any web server:** copy `dist/` to the web root. Serve over **HTTPS** so the camera,
  service worker, and installability work.

---

## Testing

```bash
npm run lint          # ESLint (flat config)
npm run typecheck     # tsc project references, no emit
npm run test          # Vitest unit tests (jsdom + fake-indexeddb)
npm run test:coverage # unit tests with coverage
npm run test:e2e      # Playwright end-to-end (builds + previews automatically)
```

- **Unit tests** cover repositories, folder/document/scan-session services, filename
  utilities, the image pipeline math (homography, pixel ops, edge detection), database
  migrations, and trash/restore.
- **End-to-end tests** (`tests/e2e`) drive the full mobile workflow in a real browser:
  import three pages → reorder → rotate → create a folder → save a PDF → open it → download
  → reload and verify persistence, plus an offline-shell render check.

The first local run of the e2e tests downloads a Chromium build:

```bash
npm run test:e2e:install   # npx playwright install chromium
```

---

## How offline storage works

All user data lives in the browser's **IndexedDB** via Dexie:

| Store          | Contents                                                        |
| -------------- | -------------------------------------------------------------- |
| `folders`      | Folder records (a default **Documents** folder always exists)  |
| `documents`    | PDF metadata **and** the PDF `Blob`, plus a first-page thumbnail |
| `scanSessions` | In-progress scan drafts (captured pages + edits) for recovery  |
| `preferences`  | User settings (default color mode, PDF options, sort, etc.)    |

- Large binary data (PDFs, page images) is stored as **Blobs in IndexedDB** — never in
  `localStorage`.
- The app requests **persistent storage** (`navigator.storage.persist()`) where supported
  so the browser won't evict your data under storage pressure. If it can't be guaranteed,
  Settings tells you so.
- **Storage usage** and low-space warnings are shown in the app; you can clear temporary
  scan drafts or delete all data from **Settings**.
- Abandoned scan drafts are pruned automatically after a 7-day retention window. **Saved
  PDFs are never deleted automatically.**

Because data is device-local, clearing your browser data or uninstalling the PWA removes
your documents. Use **Download** or **Share** to keep copies elsewhere.

---

## Known iOS limitations

Safari on iOS/iPadOS supports the core experience, but with some platform caveats — all of
which have in-app fallbacks:

- **Torch/flash and focus/exposure controls** are not exposed to web pages; the torch
  button is hidden when unsupported.
- **File sharing** via the Web Share API varies by version. When sharing files isn't
  supported, PocketScan falls back to **Download**.
- **Persistent storage** is best-effort; iOS may evict data from web apps that haven't been
  used for an extended period. Installing to the Home Screen improves retention.
- **Installation** is manual: use Safari's **Share → Add to Home Screen** (there is no
  `beforeinstallprompt` on iOS). Settings shows guidance.
- The camera requires **HTTPS** and a user gesture (tapping New Scan).

## Known camera limitations

- Live camera requires a secure context (HTTPS or `localhost`) and user permission. If
  permission is denied or no camera is available, PocketScan offers **Import Images** (file
  picker / photo library) as a full fallback — you can still build PDFs.
- Torch, continuous focus, and exposure depend on device/browser support and are detected
  at runtime; unsupported controls are hidden or disabled.
- Automatic edge detection is a lightweight heuristic. If it can't find a document, you can
  always crop manually with the four-corner editor — detection never blocks you.

---

## How to clear local application data

Any of the following removes PocketScan's local data:

- **In the app:** Settings → **Delete all app data** (or **Clear temporary scan data** to
  remove only drafts). Settings → **Trash** manages soft-deleted documents.
- **Browser:** Site settings → Clear storage / cookies and site data for the app's origin.
- **Installed PWA:** uninstalling the app clears its storage on most platforms.

---

## How to replace icons and branding

Placeholder icons are generated by a dependency-free script and live in `public/icons/`:

- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` — PWA icons (referenced by the
  manifest in `vite.config.ts`).
- `icon.svg` — favicon / Apple touch source.

To rebrand:

1. Replace the PNG/SVG files in `public/icons/` with your own (keep the same filenames and
   sizes), **or** edit `scripts/generate-icons.mjs` and run `npm run icons`.
2. Update the app name, colors, and description in the `manifest` block of
   `vite.config.ts` and the theme color in `index.html`.
3. Adjust the color palette in `src/styles/index.css` (`:root` custom properties).

For maskable icons, keep important content within the central "safe zone" (~80%).

---

## Project structure

```
src/
  domain/            # Shared types & data models
  db/                # Dexie database + schema versions/migrations
  repositories/      # Persistence contracts + IndexedDB implementations
  services/          # Camera, image pipeline (+ Web Worker), PDF, storage, PWA, orchestration
  context/           # React providers: services, scan flow, dialogs, toasts
  hooks/             # Reactive hooks (live queries, storage, preferences, install)
  components/        # Reusable UI (nav, dialogs, editors, lists)
  routes/            # Screens: Home, Folders, Scan, Review, Save, Detail, Recent, Trash, Settings
  styles/            # Global stylesheet (mobile-first, themed, accessible)
  test/              # Test setup + helpers
tests/e2e/           # Playwright end-to-end tests
docs/                # Implementation plan, architecture, backlog
scripts/             # Icon generator
```

See [`docs/architecture.md`](docs/architecture.md) for the architecture, data model, and
IndexedDB schema, and [`docs/backlog.md`](docs/backlog.md) for optional future work.

---

## Privacy

PocketScan performs camera capture, image processing, and PDF generation **entirely on your
device**. It does not upload scanned content, does not use analytics, and requests the
camera only when you start a scan. A strict Content Security Policy blocks any remote script
or network connection. See the in-app **Settings → Privacy** section for details.

## License

MIT — see [`LICENSE`](LICENSE).
