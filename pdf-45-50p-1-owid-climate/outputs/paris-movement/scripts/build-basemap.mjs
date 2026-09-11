// The base map, once, as SVG paths keyed by ISO3.
//
// Source: Natural Earth 1:110m admin-0 (public domain), fetched from
// nvkelso/natural-earth-vector. Run it again with:
//   curl -sL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson -o /tmp/ne110m.geojson
//   node scripts/build-basemap.mjs /tmp/ne110m.geojson
//
// It is a base map, not a data source: nothing here is measured and no figure
// on any screen comes from it. It only decides where a country is drawn.
//
// Projected at build time with Equal Earth (Šavrič, Patterson & Jenny 2018),
// so the page ships paths and no projection library, and so area is not
// distorted the way Mercator distorts exactly the countries this product is
// mostly about.
import { readFileSync, writeFileSync } from 'node:fs';

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;
function equalEarth(lon, lat) {
  const l = lon * Math.PI / 180, p = lat * Math.PI / 180;
  const t = Math.asin(M * Math.sin(p));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = 2 * Math.sqrt(3) * l * Math.cos(t) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = A4 * t6 * t2 * t + A3 * t6 * t + A2 * t2 * t + A1 * t;
  return [x, y];
}

const src = process.argv[2] ?? '/tmp/ne110m.geojson';
const geo = JSON.parse(readFileSync(src, 'utf8'));

// Pass one: project every ring and learn the extent.
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
const projected = [];
for (const f of geo.features) {
  // ISO_A3 is -99 for a handful (France, Norway, Kosovo…); ADM0_A3 is the
  // fallback Natural Earth itself documents for exactly this case.
  const iso = /^[A-Z]{3}$/.test(f.properties.ISO_A3) ? f.properties.ISO_A3 : f.properties.ADM0_A3;
  if (!/^[A-Z]{3}$/.test(iso)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = equalEarth(lon, lat);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        return [x, y];
      });
      if (pts.length > 3) rings.push(pts);
    }
  }
  if (rings.length) projected.push({ iso, name: f.properties.NAME, rings });
}

// Pass two: scale into a 1000-wide box, y down, and round hard. One decimal at
// this scale is about a kilometre — far below the 110m source's own precision.
const W = 1000, scale = W / (maxX - minX), H = Math.round((maxY - minY) * scale);
const shapes = {};
for (const { iso, rings } of projected) {
  let d = '';
  for (const ring of rings) {
    let last = '';
    for (let i = 0; i < ring.length; i++) {
      const x = ((ring[i][0] - minX) * scale).toFixed(1);
      const y = ((maxY - ring[i][1]) * scale).toFixed(1);
      const pt = `${x} ${y}`;
      if (pt === last) continue; // a repeated vertex draws nothing
      d += (i === 0 ? 'M' : 'L') + pt;
      last = pt;
    }
    d += 'Z';
  }
  // Two features can carry the same ISO3 (mainland plus an overseas part);
  // they are one country, so their rings join into one path.
  shapes[iso] = (shapes[iso] ?? '') + d;
}

const out = {
  $source: 'Natural Earth 1:110m admin-0, public domain (naturalearthdata.com)',
  $projection: 'Equal Earth (Šavrič, Patterson & Jenny 2018), projected at build time',
  $note: 'A base map, not a measurement. No figure on any screen is derived from it.',
  width: W, height: H, shapes,
};
writeFileSync('data/basemap.json', JSON.stringify(out) + '\n');
console.log(`basemap: ${Object.keys(shapes).length} countries, ${W}×${H}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB → data/basemap.json`);
