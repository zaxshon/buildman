# Buildman Inc. — Invoices & Quotes

A lightweight, static web app for creating **invoices** and **quotes** that match Buildman Inc. paper templates. It runs entirely in the browser (no backend), keeps working data in memory, and is laid out for **phones and desktops**.

## Features

- **Invoice** and **Quote** modes with a top toggle
- **Mobile-friendly**: preview scrolls in a comfortable viewport, toolbar scrolls horizontally, larger tap targets, safe-area support for notched phones
- **Blank templates** by default (empty fields and line rows until you fill them)
- **Export PDF** — downloads a letter-size PDF of the preview and embeds editable app data inside the file
- **Import PDF** — restores invoice/quote data from PDFs that were **exported with this app** (embedded JSON attachment)
- **Print PDF** — system print dialog (Save as PDF / Microsoft Print to PDF)
- **Share** — Web Share API or clipboard text summary
- Auto-calculate totals (optional), **Sync from lines**, add/remove rows

## PDF import / export (important)

- **Export PDF** builds the visual document and attaches a small `buildman-state.json` file to the PDF. That attachment is what **Import PDF** reads.
- PDFs from scanners, Word, or other apps **cannot** be turned back into editable fields here unless they were exported from this app.
- Export needs the page loaded over **http(s)** (not `file://`) so the banner image and libraries work reliably—use a local server or GitHub Pages.

## Run locally

```bash
cd buildman-app
python -m http.server 8080
```

Open `http://localhost:8080` (serving the folder avoids `file://` issues with images and PDF export).

## Deploy on GitHub Pages

1. Add the `buildman-app` folder (or its contents at repo root) to a GitHub repository.
2. **Settings → Pages**: deploy from branch `main` (or `master`), folder `/ (root)` or your subfolder.
3. Open the published URL. Scripts load from **cdnjs**; the app needs an online connection on first load for those libraries.

### Print / PDF quality

Use **Print PDF** and enable **Background graphics** / **Print backgrounds** so black header bars print correctly.

## File layout

| File | Purpose |
|------|---------|
| `index.html` | Page structure, CDN scripts (pdf.js, html2pdf.js, pdf-lib), editor, preview |
| `app.css` | Screen + print styles |
| `app.js` | State, rendering, PDF import/export, share |
| `assets/buildman-banner.jpg` | Header banner |

## Data & privacy

Nothing is sent to a server. Refreshing the page clears in-memory data unless you **Export PDF** first.

## Browser support

Recent Chrome, Edge, Firefox, and Safari. **Import PDF** uses PDF.js `getAttachments()`; if a browser build omits that API, import will show an error and you can still use **Print PDF**.
