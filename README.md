# Buildman Inc. — Invoices & Quotes

A lightweight, static web app for **invoices** and **quotes** that match Buildman Inc. paper templates. It runs entirely in the browser (no backend), works on phones and desktops, and keeps working data in memory until you refresh.

## Features

- **Invoice** and **Quote** modes with a top toggle
- **Mobile-friendly** layout (scrollable preview, horizontal toolbar, larger tap targets)
- **Print / Save as PDF** via the system print dialog
- **Share** — Web Share API or clipboard text summary
- Editable fields, line items, auto-calculate totals (optional), **Sync from lines**

## Quote footer (template)

New and reset quotes load the standard Buildman footer content from your reference sheet: money-transfer line, acceptance heading and legal text, **Net Total** / **HST** / **Total Payable**, and **Quote Valid for 30 Calendar Days**. Signature and date lines are omitted from the app by design.

## Run locally

```bash
cd buildman-app
python -m http.server 8080
```

Open `http://localhost:8080` so `assets/buildman-banner.jpg` loads correctly.

## GitHub Pages

Publish the `buildman-app` folder (or repo root). **Settings → Pages** → deploy from your main branch. Open the site URL; relative paths resolve for `app.css`, `app.js`, and `assets/`.

### Print quality

Use **Print PDF** and enable **Background graphics** / **Print backgrounds** so black header bars print correctly.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Structure and editor |
| `app.css` | Screen + print styles |
| `app.js` | State, preview, calculations, share |
| `assets/buildman-banner.jpg` | Header banner |

## Privacy

Nothing is sent to a server. Refreshing clears in-memory data.

## Browsers

Recent Chrome, Edge, Firefox, and Safari.
