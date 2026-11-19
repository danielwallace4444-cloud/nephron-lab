# Nephron Lab

An interactive, illustrative model of renal physiology for medical students. Adjust
haemodynamics, volume status, hormones and drugs, and watch glomerular filtration,
creatinine, urea, eGFR and urine respond over simulated days.

> **Illustrative model, not for clinical decisions.** It is not patient-specific and does
> not predict what will happen to real patients. Many of its gains are chosen to show
> qualitative behaviour rather than fitted to data — see [MODEL.md](MODEL.md), which lists
> every equation, assumption, calibration choice and known limitation.

No data is collected, stored or sent anywhere. The simulation runs entirely in the browser.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | type-check and build the static site into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` | run the model test suite (112 tests) |
| `npm run typecheck` | type-check without emitting |

## Deploying

The build is a static site with no backend, so `dist/` can be served by anything.
On Vercel, import the repository and accept the detected Vite settings — build command
`npm run build`, output directory `dist`.

`vercel.json` sets the response headers: hashed files under `/assets/` are cached for a
year, icons and the social card for a week, and every response carries
`X-Content-Type-Options`, `Referrer-Policy` and a `Permissions-Policy` that turns off
geolocation, microphone and camera. There is deliberately no `X-Frame-Options`, so a
lecturer can embed the simulator in a virtual learning environment or a slide.

`node scripts/og-image.mjs` regenerates `public/og.png`, the favicons, the apple touch
icon and `site.webmanifest` from the same kidney glyph used in the app.

`node scripts/artifact-page.mjs` additionally emits `dist/artifact.html`, a version of the
page without its own `<html>` wrapper, for hosts that supply their own document skeleton.

## How it is put together

| Path | Contents |
| --- | --- |
| `src/model/` | the simulation engine — pure TypeScript, no UI imports |
| `src/model/parameters.ts` | every parameter, with unit, range, description and source |
| `src/model/__tests__/` | 112 tests covering calibration, direction, drugs and tubular handling |
| `src/components/` | the nephron diagram, controls, charts and stat cards |
| `MODEL.md` | the equations, assumptions, evidence and known mismatches |

The engine is deliberately separate from the interface: `src/model` has no React imports,
so the physiology can be tested on its own.

## Honesty about the model

`MODEL.md` marks each parameter as one of three things: verified against a published
source, a model choice that no source can confirm, or still unverified. Two known
mismatches with the literature are documented there rather than hidden, and quantities
that cannot be measured in a patient — glomerular capillary pressure above all — are shown
as bands rather than numbers.
