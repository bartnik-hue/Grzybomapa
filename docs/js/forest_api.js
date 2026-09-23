/**
 * forest_api.js
 * Moduł pobierania danych o typie lasu z:
 *  1. OGC API Lasów Państwowych (ogcapi.bdl.lasy.gov.pl) — CORS: Access-Control-Allow-Origin: *
 *  2. Overpass API / OpenStreetMap (fallback)
 *
 * Uwaga: stary WFS (wfs.bdl.lasy.gov.pl) NIE ma nagłówków CORS — blokowany przez przeglądarki.
 */

import { TREE_SPECIES } from './mushroom_knowledge.js';

// ── OGC API (działa z przeglądarki — CORS ok) ──────────────────────
const OGC_BASE = 'https://ogcapi.bdl.lasy.gov.pl/collections';

// Mapowanie RDLP → kolekcja OGC i przybliżony zasięg (bbox WGS84)
const RDLP_COLLECTIONS = [
  { id: 'RDLP_Bialystok_wydzielenia',    minLat: 52.25, maxLat: 54.45, minLng: 21.33, maxLng: 24.13 },
  { id: 'RDLP_Gdansk_wydzielenia',       minLat: 53.58, maxLat: 54.84, minLng: 17.47, maxLng: 19.67 },
  { id: 'RDLP_Katowice_wydzielenia',     minLat: 49.38, maxLat: 51.20, minLng: 17.05, maxLng: 20.11 },
  { id: 'RDLP_Krakow_wydzielenia',       minLat: 49.26, maxLat: 50.52, minLng: 19.45, maxLng: 21.60 },
  { id: 'RDLP_Krosno_wydzielenia',       minLat: 49.04, maxLat: 50.47, minLng: 21.12, maxLng: 23.53 },
  { id: 'RDLP_Lublin_wydzielenia',       minLat: 50.22, maxLat: 52.42, minLng: 21.45, maxLng: 24.30 },
  { id: 'RDLP_Lodz_wydzielenia',         minLat: 50.89, maxLat: 52.99, minLng: 18.30, maxLng: 20.69 },
  { id: 'RDLP_Olsztyn_wydzielenia',      minLat: 52.69, maxLat: 54.44, minLng: 19.15, maxLng: 22.03 },
  { id: 'RDLP_Pila_wydzielenia',         minLat: 52.58, maxLat: 53.66, minLng: 15.75, maxLng: 17.48 },
  { id: 'RDLP_Poznan_wydzielenia',       minLat: 51.08, maxLat: 52.85, minLng: 15.92, maxLng: 19.09 },
  { id: 'RDLP_Radom_wydzielenia',        minLat: 50.12, maxLat: 52.08, minLng: 19.75, maxLng: 21.90 },
  { id: 'RDLP_Szczecin_wydzielenia',     minLat: 52.23, maxLat: 54.17, minLng: 13.98, maxLng: 16.18 },
  { id: 'RDLP_Szczecinek_wydzielenia',   minLat: 53.28, maxLat: 54.69, minLng: 15.30, maxLng: 17.71 },
  { id: 'RDLP_Torun_wydzielenia',        minLat: 52.43, maxLat: 54.04, minLng: 17.23, maxLng: 19.78 },
  { id: 'RDLP_Warszawa_wydzielenia',     minLat: 51.59, maxLat: 52.96, minLng: 20.04, maxLng: 22.71 },
  { id: 'RDLP_Wroclaw_wydzielenia',      minLat: 50.05, maxLat: 51.83, minLng: 14.75, maxLng: 17.65 },
  { id: 'RDLP_Zielona_Gora_wydzielenia', minLat: 51.35, maxLat: 52.45, minLng: 14.54, maxLng: 16.32 },
];

const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';

// ── Funkcje publiczne ──────────────────────────────────────────────

/**
 * Główna funkcja: pobierz dane o lesie dla GPS
 * @returns {Object|null} { forestName, nadlesnictwo, speciesCodes, habitatCode, ... }
 */
export async function getForestData(lat, lng) {
  // 1. OGC API LP (CORS ok — bezpieczne z przeglądarki)
  try {
    const lpData = await fetchFromOGC(lat, lng);
    if (lpData) return lpData;
  } catch (e) {
    console.warn('[ForestAPI] OGC API error:', e.message);
  }

  // 2. Fallback: Overpass API (OSM)
  try {
    const osmData = await fetchFromOverpass(lat, lng);
    if (osmData) return osmData;
  } catch (e) {
    console.warn('[ForestAPI] Overpass error:', e.message);
  }

  // 3. Poza lasem państwowym i brak obiektu leśnego w OSM: teren niezalesiony (łąka / pole)
  return {
    source: 'NON_FOREST',
    isForest: false,
    terrainType: 'meadow',
    forestName: 'Teren niezalesiony (łąka / pole)',
    nadlesnictwo: null,
    rdlp: null,
    speciesCodes: [],
    habitatCode: null,
    area: null,
    rawCode: null,
    specAge: null,
    adrFor: null,
    _feature: null,
  };
}

/**
 * Pobierz granicę wydzielenia jako GeoJSON Feature (do rysowania na mapie)
 */
export async function getForestBoundary(lat, lng) {
  const collections = findCandidateCollections(lat, lng);
  if (!collections.length) return null;

  const delta = 0.008; // ~800m
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  for (const collection of collections) {
    const url = `${OGC_BASE}/${collection.id}/items?f=json&bbox=${bbox}&limit=25`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.features?.length) continue;

      const hit = findBestFeature(data.features, lat, lng, 70);
      if (hit?.feature) return hit.feature;
    } catch {
      continue;
    }
  }
  return null;
}

// ── OGC API ────────────────────────────────────────────────────────

function findCandidateCollections(lat, lng) {
  const matches = RDLP_COLLECTIONS.filter(r =>
    lat >= r.minLat && lat <= r.maxLat &&
    lng >= r.minLng && lng <= r.maxLng
  );
  // Sortuj według odległości od środka zasięgu kolekcji (najbliższa RDLP najpierw)
  return matches.sort((a, b) => {
    const centerALat = (a.minLat + a.maxLat) / 2;
    const centerALng = (a.minLng + a.maxLng) / 2;
    const centerBLat = (b.minLat + b.maxLat) / 2;
    const centerBLng = (b.minLng + b.maxLng) / 2;
    const distA = (lat - centerALat)**2 + (lng - centerALng)**2;
    const distB = (lat - centerBLat)**2 + (lng - centerBLng)**2;
    return distA - distB;
  });
}

/**
 * Pobierz dane z OGC API LP (pygeoapi, CORS: *)
 * Używa BBOX ~800m oraz tolerancji bufora (70m dla ścieżek leśnych/linii oddziałowych)
 */
async function fetchFromOGC(lat, lng) {
  const collections = findCandidateCollections(lat, lng);
  if (!collections.length) {
    console.warn('[ForestAPI] Punkt poza zasięgiem LP:', lat, lng);
    return null;
  }

  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  for (const collection of collections) {
    const url = `${OGC_BASE}/${collection.id}/items?f=json&bbox=${bbox}&limit=25`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.features?.length) continue;

      // Wybierz wydzielenie: wewnątrz poligonu lub w promieniu ścieżki leśnej (do 70m)
      const match = findBestFeature(data.features, lat, lng, 70);
      if (!match) continue;

      const feature = match.feature;
      const props = feature.properties || {};

      const speciesCode = props.species_cd || null;
      const habitatCode = props.site_type  || null;
      const nazwaRaw    = props.nazwa      || '';
      const area        = props.sub_area   || null;
      const specAge     = props.spec_age   || null;
      const adrFor      = props.adr_for    || null;
      const areaType    = (props.area_type || '').toUpperCase();

      const rdlpName     = collection.id.replace('RDLP_', '').replace('_wydzielenia', '');
      const nadlesnictwo = extractNadlesnictwo(nazwaRaw, rdlpName);

      // Weryfikacja typu powierzchni LP — czy to faktyczny drzewostan / las czy np. łąka, woda, bagno
      if (areaType.includes('WODA') || areaType.includes('RZEKA')) {
        return {
          source: 'OGC_LP',
          isForest: false,
          terrainType: 'water',
          forestName: 'Zbiornik wodny / rzeka (LP)',
          nadlesnictwo,
          rdlp: rdlpName,
          speciesCodes: [],
          habitatCode: null,
          area: area ? `${Number(area).toFixed(1)} ha` : null,
          rawCode: null,
          specAge: null,
          adrFor,
          _feature: feature,
        };
      }

      if (['ŁĄKA', 'LAKA', 'ROLNE', 'PASTW'].some(t => areaType.includes(t))) {
        return {
          source: 'OGC_LP',
          isForest: false,
          terrainType: 'meadow',
          forestName: 'Łąka leśna / Teren otwarty (LP)',
          nadlesnictwo,
          rdlp: rdlpName,
          speciesCodes: [],
          habitatCode: habitatCode,
          area: area ? `${Number(area).toFixed(1)} ha` : null,
          rawCode: null,
          specAge: null,
          adrFor,
          _feature: feature,
        };
      }

      const speciesCodes = parseSpeciesCode(speciesCode);
      const forestName   = parseNazwaLP(nazwaRaw, collection.id);

      return {
        source: 'OGC_LP',
        isForest: true,
        terrainType: 'forest',
        forestName,
        nadlesnictwo,
        rdlp: rdlpName,
        speciesCodes,
        habitatCode,
        area: area ? `${Number(area).toFixed(1)} ha` : null,
        rawCode: speciesCode,
        specAge: specAge ? `${specAge} lat` : null,
        adrFor,
        _feature: feature,
      };
    } catch (e) {
      console.warn(`[ForestAPI] OGC collection ${collection.id} error:`, e.message);
      continue;
    }
  }

  return null;
}

// ── Algorytm geometrii (point-in-polygon & bufor ścieżek leśnych) ───

function distToSegmentSquared(px, py, vx, vy, wx, wy) {
  const l2 = (vx - wx)**2 + (vy - wy)**2;
  if (l2 === 0) return (px - vx)**2 + (py - vy)**2;
  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (px - (vx + t * (wx - vx)))**2 + (py - (vy + t * (wy - vy)))**2;
}

function pointInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToGeometryMeters(geometry, lat, lng) {
  if (!geometry) return Infinity;
  if (geometry.type === 'Polygon') {
    if (pointInRing(geometry.coordinates[0], lng, lat)) return 0;
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInRing(poly[0], lng, lat)) return 0;
    }
  }

  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : (geometry.type === 'MultiPolygon' ? geometry.coordinates : []);
  let minD2 = Infinity;

  for (const rings of polygons) {
    const ring = rings[0];
    if (!ring) continue;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d2 = distToSegmentSquared(lng, lat, ring[i][0], ring[i][1], ring[j][0], ring[j][1]);
      if (d2 < minD2) minD2 = d2;
    }
  }

  return Math.sqrt(minD2) * 111000;
}

/**
 * Znajdź wydzielenie leśne:
 *  1. Dokładnie zawierające punkt (d = 0)
 *  2. Najbliższe w tolerancji maxToleranceMeters (dla ścieżek, dróg leśnych, linii oddziałowych)
 *  Zwraca null jeśli najbliższy las jest dalej (pole, łąka, miasto)
 */
function findBestFeature(features, lat, lng, maxToleranceMeters = 70) {
  if (!features?.length) return null;

  for (const f of features) {
    if (distanceToGeometryMeters(f.geometry, lat, lng) === 0) {
      return { feature: f, distance: 0, isInside: true };
    }
  }

  let best = null;
  let minD = Infinity;

  for (const f of features) {
    const d = distanceToGeometryMeters(f.geometry, lat, lng);
    if (d < minD) {
      minD = d;
      best = f;
    }
  }

  if (best && minD <= maxToleranceMeters) {
    return { feature: best, distance: minD, isInside: false };
  }

  return null;
}

// ── Parsowanie pól LP ──────────────────────────────────────────────

/**
 * Parsuj kod gatunkowy LP
 * "SO" → ['So'] | "6So4Db2Bk" → ['So','Db','Bk'] | "SO DB" → ['So','Db']
 */
const LP_TO_NORM = {
  'SO': 'So', 'SW': 'Sw', 'ŚW': 'Sw', 'JD': 'Jd', 'MD': 'Md',
  'DB': 'Db', 'DBCZ': 'Dbcz', 'BK': 'Bk', 'GB': 'Gb', 'BRZ': 'Brz',
  'LP': 'Lp', 'JS': 'Js', 'KL': 'Kl', 'OL': 'Ol', 'OS': 'Os',
  'TP': 'Tp', 'WZ': 'Wz', 'LSZ': 'Lsz', 'WB': 'Wb', 'JW': 'Jw', 'CZR': 'Czr',
};

/**
 * Parsuj kod gatunkowy LP
 * "SO" → ['So'] | "6So4Db2Bk" → ['So','Db','Bk'] | "10SO" → ['So'] | "SO DB" → ['So','Db']
 */
function parseSpeciesCode(code) {
  if (!code) return [];
  const upper = code.toUpperCase().trim();

  // 1. Sprawdź czy to pojedynczy znany kod, np. "SO", "BRZ", "ŚW"
  if (LP_TO_NORM[upper]) return [LP_TO_NORM[upper]];

  // 2. Jeśli format z udziałami np. "6SO 4DB" lub "6SO4DB" lub "7SO2DB1BRZ" lub "6So4Db"
  const knownKeys = Object.keys(LP_TO_NORM).sort((a,b) => b.length - a.length);
  const regex = new RegExp(`(\\d*)\\s*(${knownKeys.join('|')})`, 'g');
  const matches = [...upper.matchAll(regex)];

  if (matches.length > 0) {
    const list = matches.map(m => LP_TO_NORM[m[2]]).filter(Boolean);
    if (list.length > 0) return [...new Set(list)];
  }

  // 3. Fallback: słowa rozdzielone spacjami
  const parts = upper.split(/\s+/);
  const res = parts.map(p => LP_TO_NORM[p] || (p.charAt(0) + p.slice(1).toLowerCase())).filter(Boolean);
  return res.length ? [...new Set(res)] : [];
}

/**
 * Parsuj pole "nazwa" LP → czytelna nazwa nadleśnictwa
 * "BDL_17_01_CELESTYNOW_2026" → "Nadleśnictwo Celestynow"
 */
function parseNazwaLP(nazwa, collectionId) {
  if (!nazwa) return formatRDLPName(collectionId);

  const parts = nazwa.split('_').filter(p => p && p !== 'BDL');
  // Odfiltruj liczby i rok (≥4 cyfry)
  const textParts = parts.filter(p => !/^\d+$/.test(p));
  const nameRaw   = textParts[textParts.length - 1] || '';

  if (!nameRaw) return formatRDLPName(collectionId);
  return 'Nadleśnictwo ' + nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1).toLowerCase();
}

function extractNadlesnictwo(nazwa, rdlpFallback) {
  if (!nazwa) return rdlpFallback || '';
  const parts = nazwa.split('_').filter(p => p && p !== 'BDL' && !/^\d+$/.test(p));
  const raw = parts[parts.length - 1] || rdlpFallback || '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function formatRDLPName(collectionId) {
  return (collectionId || '')
    .replace('RDLP_', 'RDLP ')
    .replace('_wydzielenia', '')
    .replace(/_/g, ' ');
}

// ── Overpass API (fallback dla lasów niepaństwowych i klasyfikacja terenu) ───

async function fetchFromOverpass(lat, lng) {
  // Wąski promień wokół punktu — sprawdza rzeczywisty teren pod pinezką
  const query = `
    [out:json][timeout:3];
    (
      way["natural"="wood"](around:50,${lat},${lng});
      way["landuse"="forest"](around:50,${lat},${lng});
      way["natural"="water"](around:40,${lat},${lng});
      way["waterway"](around:30,${lat},${lng});
      way["building"](around:30,${lat},${lng});
      way["landuse"="residential"](around:35,${lat},${lng});
      way["landuse"="meadow"](around:50,${lat},${lng});
      way["landuse"="farmland"](around:50,${lat},${lng});
      relation["natural"="wood"](around:50,${lat},${lng});
      relation["landuse"="forest"](around:50,${lat},${lng});
    );
    out tags;
  `;

  const res = await fetch(OVERPASS_BASE, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Grzybomapa/2.0 (https://bartnik-hue.github.io/Grzybomapa)'
    },
    signal: AbortSignal.timeout(2500),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.elements?.length) return null;

  const elements = data.elements;

  // 1. Sprawdź czy to las / zadrzewienie
  const forestEl = elements.find(el => {
    const t = el.tags || {};
    return t.natural === 'wood' || t.landuse === 'forest';
  });

  if (forestEl) {
    const tags = forestEl.tags || {};
    const leafType = tags.leaf_type;
    const name = tags.name || tags['name:pl'] || 'Las prywatny / komunalny';

    let speciesCodes = [];
    if      (leafType === 'needleleaved') speciesCodes = ['So'];
    else if (leafType === 'broadleaved')  speciesCodes = ['Db'];
    else if (leafType === 'mixed')        speciesCodes = ['So', 'Db'];
    else                                  speciesCodes = ['So'];

    return {
      source: 'OSM_Overpass',
      isForest: true,
      terrainType: 'forest',
      forestName: name,
      nadlesnictwo: null,
      rdlp: null,
      speciesCodes,
      habitatCode: null,
      area: null,
      rawCode: leafType || 'unknown',
      specAge: null,
      adrFor: null,
      _feature: null,
    };
  }

  // 2. Sprawdź czy to zbiornik wodny
  const waterEl = elements.find(el => {
    const t = el.tags || {};
    return t.natural === 'water' || t.waterway;
  });
  if (waterEl) {
    return {
      source: 'OSM_Overpass',
      isForest: false,
      terrainType: 'water',
      forestName: waterEl.tags?.name || 'Akwen / Zbiornik wodny',
      nadlesnictwo: null,
      rdlp: null,
      speciesCodes: [],
      habitatCode: null,
      area: null,
      rawCode: null,
      specAge: null,
      adrFor: null,
      _feature: null,
    };
  }

  // 3. Sprawdź czy to łąka, pole uprawne, pastwisko
  const meadowEl = elements.find(el => {
    const t = el.tags || {};
    return ['meadow', 'grass', 'farmland', 'orchard', 'allotments', 'village_green', 'recreation_ground'].includes(t.landuse) ||
           ['grassland', 'heath', 'scrub'].includes(t.natural);
  });
  if (meadowEl) {
    const t = meadowEl.tags || {};
    const label = t.landuse === 'farmland'
      ? 'Pole uprawne'
      : (t.landuse === 'orchard' ? 'Sad' : 'Teren otwarty (łąka / pastwisko)');
    return {
      source: 'OSM_Overpass',
      isForest: false,
      terrainType: 'meadow',
      forestName: t.name || label,
      nadlesnictwo: null,
      rdlp: null,
      speciesCodes: [],
      habitatCode: null,
      area: null,
      rawCode: null,
      specAge: null,
      adrFor: null,
      _feature: null,
    };
  }

  // 4. Sprawdź czy to teren zabudowany / miejski
  const urbanEl = elements.find(el => {
    const t = el.tags || {};
    return ['residential', 'commercial', 'industrial', 'retail', 'construction', 'cemetery'].includes(t.landuse) ||
           t.building || t.highway;
  });
  if (urbanEl) {
    return {
      source: 'OSM_Overpass',
      isForest: false,
      terrainType: 'urban',
      forestName: urbanEl.tags?.name || 'Obszar zurbanizowany (zabudowa / drogi)',
      nadlesnictwo: null,
      rdlp: null,
      speciesCodes: [],
      habitatCode: null,
      area: null,
      rawCode: null,
      specAge: null,
      adrFor: null,
      _feature: null,
    };
  }

  return null;
}

// ── Pomocnicze (dla nadleśnictwa) ──────────────────────────────────

export async function getNadlesnictwoData(lat, lng) {
  const delta = 0.05;
  const bbox  = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url   = `${OGC_BASE}/nadlesnictwa/items?f=json&bbox=${bbox}&limit=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const props = data.features?.[0]?.properties;
    return props ? { name: props.nazwa || props.name, rdlp: props.rdlp } : null;
  } catch {
    return null;
  }
}
