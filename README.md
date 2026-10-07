# World Weather Globe

A 3D globe where every country (and every state/province of the largest countries) is colored by temperature, humidity, or rain today.

**Live:** https://jamalxcode.github.io/weather/

## How it works

- A GitHub Action (`.github/workflows/update.yml`) runs every 30 minutes. It runs `scripts/update.mjs`, which builds `world.json` (region shapes and weather) and deploys the site to GitHub Pages.
- Visitors only download that one file and never call the weather API themselves.
- Each run refreshes a rotating third of the regions, about 175 lookups. That keeps total use around 8,400 lookups a day, under Open-Meteo's free limit. Every region is refreshed at least every 90 minutes.

## Sources

- Weather: [Open-Meteo](https://open-meteo.com/) (one sample point per region)
- Borders: Natural Earth 50m admin-0 / admin-1
- Globe: [globe.gl](https://globe.gl/)
