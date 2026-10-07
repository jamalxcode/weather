# World Weather Globe

A 3D globe where every country (and every state/province of the largest countries) is colored by live temperature, humidity, or rain today.

- Data: [Open-Meteo](https://open-meteo.com/) (one sample point per region, cached in the browser for an hour)
- Borders: Natural Earth 50m admin-0 / admin-1
- Globe: [globe.gl](https://globe.gl/)

Open `index.html` in a browser, or run `powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1` and visit http://localhost:8765.
