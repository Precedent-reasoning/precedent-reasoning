# Precedent Reasoning — Landing Page

Marketing landing page + a front-end mock of the "Start free" app screen, matching
the dark-navy brand. Plain static HTML — no build step.

## Files

| File | What it is |
|------|-----------|
| `index.html` | The landing page (entry point) |
| `demo.html` | The "Start free" destination — dark app UI with a simulated streaming agent + sample results |
| `search.jsx` | Hero section + interactive search demo |
| `sections.jsx` | Nav, How it works, Capabilities, Trust, Pricing, CTA, Footer |
| `app-screen.jsx` | The app screen (sidebar, chat, faked agent stream, results) |
| `case-data.jsx` | Shared illustrative NSW / federal case data |
| `theme.jsx` | Color themes + scroll-reveal helpers |
| `app.jsx` | Landing page root |
| `styles.css` | Landing page styles |
| `app-styles.css` | App screen styles |
| `tweaks-panel.jsx` | In-page tweak panel (color theme switcher) |

## Sections (landing page)

Nav · Hero with interactive search demo · How it works · Capabilities · Trust &
transparency · **Cloud vs Local** deployment comparison · Pricing (Local /
Cloud-Basic / Cloud-Professional, with a "Why upgrade to Cloud-Professional" band)
· CTA · Footer.

## Cloud / Local mode (app screen)

The app has a **Where it runs** toggle (Cloud / Local), persisted to localStorage.
In **Local** mode it shows a "data stays on this device" indicator and the agent
steps switch to on-device wording. This is UI only — wire it to your real
cloud vs. local-model/agent backends in `app-screen.jsx`'s `run()`.

## Run locally

These reference each other with relative paths, so serve the folder (don't open via `file://`):

```bash
cd landing
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Notes

- **Front-end only.** The search/agent streaming and results are simulated in the
  browser — nothing calls the backend yet. Wire `app-screen.jsx`'s `run()` to your
  real API to make it live.
- **Illustrative data.** All case names and citations in `case-data.jsx` are fictional
  placeholders in realistic NSW citation format. Replace with real results.
- The page provides legal **information, not advice**, and surfaces real court
  decisions (source intentionally not named in the UI).
