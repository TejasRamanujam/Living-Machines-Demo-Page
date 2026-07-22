# Living Machines — Demo Page

**Live: https://tejas-live-demos.vercel.app**

Hub of six live, interactive demos — each plate has its own generative canvas vignette (flow field, orb, grid, force graph, ghost collaborators, latent field). Nothing here is a screenshot.

| # | Demo | Live |
|---|------|------|
| 01 | Portfolio — The Working Drawing | https://tejasramanujam.vercel.app |
| 02 | Connection — voice assistant | https://connection-assistant.vercel.app |
| 03 | Neuron — project database | https://neuron-database.vercel.app |
| 04 | Neurosurge — second brain | https://neurosurge.vercel.app |
| 05 | Scribbly — collaborative whiteboard | https://scribbly-collab.vercel.app |
| 06 | Latent Field — Gemini-directed WebGL | https://latent-field.vercel.app |

Static site, zero dependencies: `src/index.html`, `src/app.js` (canvas scenes), `src/styles.css`. Deployed on Vercel (`src/` is the site root). A scheduled GitHub Action keeps the demo backends warm without waking their databases.
