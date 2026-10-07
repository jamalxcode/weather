// Builds site/world.json: region shapes + latest weather, refreshed politely.
// Each run refreshes a rotating third of regions (plus any with no data yet),
// so a 30-minute schedule stays well under Open-Meteo's free daily limit.
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SITE = process.env.SITE_URL || 'https://jamalxcode.github.io/weather/';
const SPLIT = new Set(['USA','CAN','RUS','CHN','BRA','AUS','IND','IDN','ZAF']); // large countries shown by state/province
const SLICES = 3, CHUNK = 50, PAUSE_MS = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

function ringArea(r){ let a=0; for(let i=0;i<r.length-1;i++) a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]; return a/2; }
// area-weighted centroid of the largest polygon, used as the region's sample point
function repPoint(geom) {
  const polys = geom.type==='Polygon' ? [geom.coordinates] : geom.coordinates;
  let best=null, bestA=-1;
  for (const p of polys) { const a=Math.abs(ringArea(p[0])); if (a>bestA){bestA=a;best=p[0];} }
  let A=0,cx=0,cy=0;
  for (let i=0;i<best.length-1;i++) {
    const [x0,y0]=best[i],[x1,y1]=best[i+1], c=x0*y1-x1*y0; A+=c; cx+=(x0+x1)*c; cy+=(y0+y1)*c;
  }
  return A ? [cx/(3*A), cy/(3*A)] : best[0];
}
// round coordinates to ~1 km to keep the file small
const round = g => JSON.parse(JSON.stringify(g, (k,v) => typeof v==='number' ? Math.round(v*100)/100 : v));

async function buildRegions() {
  const [c, s] = await Promise.all([getJSON(NE+'ne_50m_admin_0_countries.geojson'), getJSON(NE+'ne_50m_admin_1_states_provinces.geojson')]);
  const out = [];
  for (const f of c.features) {
    if (SPLIT.has(f.properties.ADM0_A3) || f.properties.ADMIN==='Antarctica') continue;
    out.push({ name:f.properties.NAME, country:'', geometry:f.geometry });
  }
  for (const f of s.features) {
    if (SPLIT.has(f.properties.adm0_a3)) out.push({ name:f.properties.name, country:f.properties.admin, geometry:f.geometry });
  }
  for (const r of out) {
    const [lon,lat] = repPoint(r.geometry);
    r.lat = +lat.toFixed(2); r.lon = +lon.toFixed(2); r.geometry = round(r.geometry);
  }
  return out;
}

async function fetchBatch(part) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude='+part.map(r=>r.lat).join(',')+
    '&longitude='+part.map(r=>r.lon).join(',')+
    '&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&forecast_days=1&timezone=auto';
  for (let tries=0; tries<3; tries++) {
    const r = await fetch(url);
    if (r.ok) { const j = await r.json(); return Array.isArray(j) ? j : [j]; }
    console.warn(`Open-Meteo ${r.status}, waiting before retry`);
    await sleep(r.status===429 ? 65000 : 5000);
  }
  throw new Error('Open-Meteo unavailable');
}

const key = r => r.country+'|'+r.name;
const regions = await buildRegions();

// carry over the previously published readings
let prev = new Map();
try { prev = new Map((await getJSON(SITE+'world.json')).regions.map(r => [key(r), r])); }
catch (e) { console.log('No previous data, fetching everything'); }
for (const r of regions) { const p = prev.get(key(r)); if (p) { r.t=p.t; r.h=p.h; r.p=p.p; r.at=p.at; } }

const slice = Math.floor(Date.now() / (30*60*1000)) % SLICES;
const todo = regions.filter((r,i) => i % SLICES === slice || r.at == null);
console.log(`Refreshing ${todo.length} of ${regions.length} regions (slice ${slice})`);

const now = new Date().toISOString();
for (let i=0; i<todo.length; i+=CHUNK) {
  const part = todo.slice(i, i+CHUNK);
  try {
    const res = await fetchBatch(part);
    part.forEach((r,k) => { const w=res[k]; if (!w) return;
      r.t=w.current?.temperature_2m; r.h=w.current?.relative_humidity_2m; r.p=w.daily?.precipitation_sum?.[0]; r.at=now; });
  } catch (e) { console.warn(e.message, '- keeping previous values for this batch'); }
  await sleep(PAUSE_MS);
}

await mkdir('site', { recursive:true });
await writeFile('site/world.json', JSON.stringify({ updated:now, regions }));
for (const f of ['index.html', 'logo.svg']) await copyFile(f, 'site/'+f);
console.log('Wrote site/world.json');
