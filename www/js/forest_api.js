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

  return null;
}

/**
 * Pobierz granicę wydzielenia jako GeoJSON Feature (do rysowania na mapie)
 */
export async function getForestBoundary(lat, lng) {
  const collection = findCollection(lat, lng);
  if (!collection) return null;

  const delta = 0.008; // ~800m — szersza siatka by na pewno złapać wydzielenie
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  const url = `${OGC_BASE}/${collection.id}/items?f=json&bbox=${bbox}&limit=10`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.features?.length) return null;

    // Znajdź wydzielenie zawierające punkt
    const hit = findContainingFeature(data.features, lat, lng);
    return hit || data.features[0];
  } catch {
    return null;
  }
}

// ── OGC API ────────────────────────────────────────────────────────

function findCollection(lat, lng) {
  return RDLP_COLLECTIONS.find(r =>
    lat >= r.minLat && lat <= r.maxLat &&
    lng >= r.minLng && lng <= r.maxLng
  ) || null;
}

/**
 * Pobierz dane z OGC API LP (pygeoapi, CORS: *)
 * Używa BBOX ~800m i point-in-polygon do wybrania właściwego wydzielenia
 */
async function fetchFromOGC(lat, lng) {
  const collection = findCollection(lat, lng);
  if (!collection) {
    console.warn('[ForestAPI] Punkt poza zasięgiem LP:', lat, lng);
    return null;
  }

  // BBOX ok. 800m wokół punktu — zbieramy kilka wydzieleń i wybieramy to zawierające punkt
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `${OGC_BASE}/${collection.id}/items?f=json&bbox=${bbox}&limit=20`;

  console.log('[ForestAPI] OGC request:', url);

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    console.warn('[ForestAPI] OGC HTTP error:', res.status);
    return null;
  }

  const data = await res.json();
  console.log('[ForestAPI] OGC matched:', data.numberMatched, 'returned:', data.numberReturned);

  if (!data.features?.length) return null;

  // Wybierz wydzielenie zawierające punkt GPS (point-in-polygon)
  const feature = findContainingFeature(data.features, lat, lng) || data.features[0];
  const props = feature.properties;

  const speciesCode = props.species_cd || null;
  const habitatCode = props.site_type  || null;
  const nazwaRaw    = props.nazwa      || '';
  const area        = props.sub_area   || null;
  const specAge     = props.spec_age   || null;
  const adrFor      = props.adr_for    || null;

  const speciesCodes = parseSpeciesCode(speciesCode);
  const forestName   = parseNazwaLP(nazwaRaw, collection.id);
  const rdlpName     = collection.id.replace('RDLP_', '').replace('_wydzielenia', '');

  return {
    source: 'OGC_LP',
    forestName,
    nadlesnictwo: extractNadlesnictwo(nazwaRaw, rdlpName),
    rdlp: rdlpName,
    speciesCodes,
    habitatCode,
    area: area ? `${Number(area).toFixed(1)} ha` : null,
    rawCode: speciesCode,
    specAge: specAge ? `${specAge} lat` : null,
    adrFor,
    _feature: feature, // zachowaj geometrię do rysowania granicy
  };
}

// ── Algorytm point-in-polygon (ray casting) ────────────────────────

/**
 * Znajdź wydzielenie które zawiera punkt (lat, lng)
 * Obsługuje MultiPolygon i Polygon
 */
function findContainingFeature(features, lat, lng) {
  for (const f of features) {
    if (geometryContains(f.geometry, lat, lng)) return f;
  }
  return null;
}

function geometryContains(geometry, lat, lng) {
  if (!geometry) return false;
  const type = geometry.type;

  if (type === 'Polygon') {
    return polygonContains(geometry.coordinates, lat, lng);
  }
  if (type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => polygonContains(poly, lat, lng));
  }
  return false;
}

/**
 * Ray-casting: czy punkt [lng, lat] jest wewnątrz wielokąta
 * GeoJSON: coords = [outerRing, ...holes], każdy ring = [[lng,lat], ...]
 */
function polygonContains(rings, lat, lng) {
  if (!rings?.length) return false;
  // Sprawdź tylko zewnętrzny ring (otwory ignorujemy — rzadko mamy dziury w wydzieleniach)
  return pointInRing(rings[0], lng, lat);
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

// ── Parsowanie pól LP ──────────────────────────────────────────────

/**
 * Parsuj kod gatunkowy LP
 * "SO" → ['So'] | "6So4Db2Bk" → ['So','Db','Bk'] | "SO DB" → ['So','Db']
 */
function parseSpeciesCode(code) {
  if (!code) return [];

  // Format "6So4Db2Bk" — z cyframi
  const withNums = code.match(/\d*([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*)/g);
  if (withNums?.length) {
    return withNums.map(m => {
      const clean = m.replace(/^\d+/, '');
      return normalizeCode(clean);
    });
  }

  // Spacja-separated "SO DB"
  const parts = code.trim().split(/\s+/);
  return parts.map(normalizeCode).filter(Boolean);
}

/** Normalizuj kod: "SO" → "So", "DB" → "Db" */
function normalizeCode(code) {
  if (!code) return '';
  return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
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

// ── Overpass API (fallback dla lasów niepaństwowych) ───────────────

async function fetchFromOverpass(lat, lng) {
  const query = `
    [out:json][timeout:10];
    (
      way["natural"="wood"](around:300,${lat},${lng});
      way["landuse"="forest"](around:300,${lat},${lng});
      relation["natural"="wood"](around:300,${lat},${lng});
      relation["landuse"="forest"](around:300,${lat},${lng});
    );
    out tags;
  `;

  const res = await fetch(OVERPASS_BASE, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.elements?.length) return null;

  const el   = data.elements[0];
  const tags = el.tags || {};

  const leafType = tags.leaf_type;
  const name     = tags.name || tags['name:pl'] || 'Las';

  let speciesCodes = [];
  if      (leafType === 'needleleaved') speciesCodes = ['So'];
  else if (leafType === 'broadleaved')  speciesCodes = ['Db'];
  else if (leafType === 'mixed')        speciesCodes = ['So', 'Db'];
  else                                  speciesCodes = ['So'];

  return {
    source: 'OSM_Overpass',
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
