# Publishing the TMA site — get a shareable link

You can't send a `localhost` link to anyone — it only works on your own PC.
To get a link you can send, drag this folder onto Netlify.

## Get a public link (30 seconds)

1. Go to **https://app.netlify.com/drop**
2. Drag the whole **`tma-site`** folder onto the page.
3. Netlify gives you a URL like `https://random-name-123.netlify.app` — **that's the link you send people.**
   (You can rename it in Netlify → Site settings → Change site name.)

The entire site works immediately — every section, the design, the copy.

## One caveat: the forecast box

The **Free forecast** section talks to a separate "prediction engine" (a small
Python program). Until that engine is put online, the forecast box on the public
site will honestly say *"waking up / unreachable"* — it never shows a fake number.
Everything else on the page works perfectly.

So you have two states:

- **Right now (share the site):** publish as above. Recipients see the whole site;
  the forecast box shows the honest "unreachable" state.
- **Later (make the forecast work for visitors too):** the engine
  (`OneDrive/Desktop/PREDICTION-ENGINE/forecast_service.py`) needs to run on a
  public host (Render) with an LLM key set and CORS enabled. Then do the one edit
  below and re-drag the folder.

## When the engine IS deployed — one edit

Open **`app.js`**, find this near the top of the forecast section:

```js
const PROD_ENGINE = 'https://tma-forecast-engine.onrender.com'; // TODO: real URL
```

Change that URL to wherever the engine is actually deployed. Also set the booking
link in **`index.html`** (search for `data-booking`). Re-drag the folder to Netlify
(or drag onto the existing site to update it).

## How the forecast picks its engine (so you don't have to)

`app.js` auto-detects:

- On **localhost** → it uses your **local** engine at `http://localhost:8791`
  (so the forecast works while you develop, as long as the Python engine is running).
- On **Netlify / any real domain** → it uses `PROD_ENGINE` above.

Same folder, both behaviours — nothing to toggle.

## Running it locally (for yourself)

- Site: served at `http://localhost:8125` (via `serve.cjs`).
- Forecast engine (optional — only if you want the forecast to work locally):
  run `forecast_service.py --port 8791` from the PREDICTION-ENGINE folder.

## Files in this folder

| File | What it is |
|------|-----------|
| `index.html` | the page |
| `styles.css` | all styling |
| `app.js` | behaviour + forecast engine selection |
| `forecast-widget.html` | the embedded forecast tool |
| `netlify.toml` | Netlify config (caching + headers) |
| `serve.cjs` | local preview server only — Netlify ignores it |
