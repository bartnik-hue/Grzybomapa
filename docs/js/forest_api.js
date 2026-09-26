/**
 * forest_api.js
 * Moduł pobierania danych o typie lasu z:
 *  1. OGC API Lasów Państwowych (ogcapi.bdl.lasy.gov.pl) — CORS: Access-Control-Allow-Origin: *
 *  2. Overpass API / OpenStreetMap (fallback)
 *
 * Uwaga: stary WFS (wfs.bdl.lasy.gov.pl) NIE ma nagłówków CORS — blokowany przez przeglądarki.
 */

import { TREE_SPECIES } from './mushroom_knowledge.js';
import { getCachedForestAt } from './heatmap.js';

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

// Polskie Parki Narodowe (poza ewidencją Lasów Państwowych, zarządzane przez DPN/Klimat)
const POLISH_NATIONAL_PARKS = [
  { name: 'Babiogórski Park Narodowy', minLat: 49.56, maxLat: 49.62, minLng: 19.50, maxLng: 19.62 },
  { name: 'Białowieski Park Narodowy', minLat: 52.68, maxLat: 52.88, minLng: 23.70, maxLng: 24.02 },
  { name: 'Biebrzański Park Narodowy', minLat: 53.30, maxLat: 53.80, minLng: 22.45, maxLng: 23.10 },
  { name: 'Bieszczadzki Park Narodowy', minLat: 49.00, maxLat: 49.30, minLng: 22.50, maxLng: 22.95 },
  { name: 'Park Narodowy Bory Tucholskie', minLat: 53.75, maxLat: 53.95, minLng: 17.45, maxLng: 17.65 },
  { name: 'Drawieński Park Narodowy', minLat: 53.05, maxLat: 53.25, minLng: 15.85, maxLng: 16.15 },
  { name: 'Gorczański Park Narodowy', minLat: 49.52, maxLat: 49.62, minLng: 20.05, maxLng: 20.25 },
  { name: 'Park Narodowy Gór Stołowych', minLat: 50.40, maxLat: 50.52, minLng: 16.25, maxLng: 16.45 },
  { name: 'Kampinoski Park Narodowy', minLat: 52.25, maxLat: 52.42, minLng: 20.35, maxLng: 20.88 },
  { name: 'Karkonoski Park Narodowy', minLat: 50.70, maxLat: 50.85, minLng: 15.45, maxLng: 15.85 },
  { name: 'Magurski Park Narodowy', minLat: 49.45, maxLat: 49.60, minLng: 21.35, maxLng: 21.65 },
  { name: 'Narwiański Park Narodowy', minLat: 53.00, maxLat: 53.18, minLng: 22.75, maxLng: 22.95 },
  { name: 'Ojcowski Park Narodowy', minLat: 50.18, maxLat: 50.25, minLng: 19.80, maxLng: 19.86 },
  { name: 'Pieniński Park Narodowy', minLat: 49.38, maxLat: 49.46, minLng: 20.35, maxLng: 20.50 },
  { name: 'Poleski Park Narodowy', minLat: 51.38, maxLat: 51.52, minLng: 23.08, maxLng: 23.28 },
  { name: 'Roztoczański Park Narodowy', minLat: 50.55, maxLat: 50.68, minLng: 22.90, maxLng: 23.10 },
  { name: 'Słowiński Park Narodowy', minLat: 54.60, maxLat: 54.80, minLng: 17.10, maxLng: 17.60 },
  { name: 'Świętokrzyski Park Narodowy', minLat: 50.85, maxLat: 50.95, minLng: 20.85, maxLng: 21.05 },
  { name: 'Tatrzański Park Narodowy', minLat: 49.18, maxLat: 49.33, minLng: 19.75, maxLng: 20.15 },
  { name: 'Park Narodowy Ujście Warty', minLat: 52.55, maxLat: 52.65, minLng: 14.65, maxLng: 14.85 },
  { name: 'Wielkopolski Park Narodowy', minLat: 52.23, maxLat: 52.33, minLng: 16.78, maxLng: 16.92 },
  { name: 'Wigierski Park Narodowy', minLat: 54.00, maxLat: 54.12, minLng: 22.98, maxLng: 23.20 },
  { name: 'Woliński Park Narodowy', minLat: 53.90, maxLat: 54.02, minLng: 14.38, maxLng: 14.58 },
];

function checkNationalPark(lat, lng) {
  return POLISH_NATIONAL_PARKS.find(p =>
    lat >= p.minLat && lat <= p.maxLat &&
    lng >= p.minLng && lng <= p.maxLng
  );
}

const OVERPASS_SERVERS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Rozpoznawanie kolorystyki lasu, młodnika, zarośli i drzewek na kafelkach OpenStreetMap (styl Carto).
 * Obejmuje zielone pola leśne (#add19e), młodniki/zarośla (#c8d7ab), parki i symbole drzewek.
 */
function isForestColor(r, g, b) {
  // 1. Ciemnozielone symbole drzewek (tree icons: korony i liście drzew na mapie OSM)
  const isTreeSymbol = (g >= 80 && g <= 175 && g > r + 10 && g > b + 12 && r >= 35 && r <= 155 && b >= 25 && b <= 135);

  // 2. Standardowy las OSM (#add19e = 173, 209, 158)
  const isWoodStandard = (r >= 135 && r <= 198 && g >= 175 && g <= 235 && b >= 125 && b <= 185 && g > r + 12 && g > b + 18);

  // 3. Rezerwat leśny (#8dc56c = 141, 197, 108)
  const isWoodReserve = (r >= 105 && r <= 165 && g >= 160 && g <= 225 && b >= 80 && b <= 140 && g > r + 20);

  // 4. Scrub / zarośla / młodnik / zalesienie z drzewkami (#c8d7ab = 200, 215, 171)
  const isScrubOrYoungWood = (r >= 175 && r <= 218 && g >= 195 && g <= 238 && b >= 145 && b <= 198 && g > r + 5 && g > b + 18);

  // 5. Park / zadrzewienie jasne (#c8facc = 200, 250, 204 lub #b5d29f = 181, 210, 159)
  const isWoodPark = (r >= 160 && r <= 218 && g >= 190 && g <= 250 && b >= 135 && b <= 212 && g > r + 12 && g > b + 18);

  // 6. Ogólna sygnatura zalesienia (zieleń roślinności drzewiastej, wykluczająca zażółcone pola uprawne)
  const isGenericWood = (g >= 95 && g <= 242 && g > r + 12 && g > b + 16 && (r + g + b) <= 615 && !(r > 218 && g > 228 && b > 195));

  return isTreeSymbol || isWoodStandard || isWoodReserve || isScrubOrYoungWood || isWoodPark || isGenericWood;
}

/**
 * Nadrzędna detekcja obecności lasu na kafelku OpenStreetMap.
 * Próbkuje piksele z kafelka OSM wyświetlanego użytkownikowi na ekranie.
 * Używa fetch(tileUrl, { mode: 'cors' }) oraz createImageBitmap, co eliminuje
 * błędy Cross-Origin Canvas Tainting w przeglądarce i działa błyskawicznie (0-150 ms).
 * Sprawdza zoom 15, 14 oraz 16, wykrywając każdy las, zagajnik, młodnik i symbol drzewka.
 */
export async function isOsmForestTileAt(lat, lng) {
  if (typeof window === 'undefined') return null;

  const checkAtZoom = async (zoom) => {
    try {
      const n = 1 << zoom;
      const x = (lng + 180) / 360 * n;
      const latRad = lat * Math.PI / 180;
      const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      const px = Math.floor((x - tileX) * 256);
      const py = Math.floor((y - tileY) * 256);

      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

      // 1. Pobierz kafelek przez fetch z trybem CORS (bezpieczny dla Canvas)
      let imageSource = null;
      if (typeof fetch !== 'undefined' && typeof createImageBitmap !== 'undefined') {
        try {
          const res = await fetch(tileUrl, { mode: 'cors', signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const blob = await res.blob();
            imageSource = await createImageBitmap(blob);
          }
        } catch {
          // Fallback do new Image() poniżej
        }
      }

      // 2. Tradycyjny fallback Image() jeśli fetch/createImageBitmap zawiedzie
      if (!imageSource && typeof Image !== 'undefined') {
        imageSource = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const timer = setTimeout(() => resolve(null), 2500);
          img.onload = () => { clearTimeout(timer); resolve(img); };
          img.onerror = () => { clearTimeout(timer); resolve(null); };
          img.src = tileUrl;
        });
      }

      if (!imageSource) return null;

      // 3. Renderuj próbkę na płótnie Canvas
      const cvs = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(256, 256)
        : document.createElement('canvas');
      cvs.width = 256;
      cvs.height = 256;
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imageSource, 0, 0);

      const sampleRadius = 6; // Obszar 13x13 pikseli wokół punktu
      const size = sampleRadius * 2 + 1;
      const sx = Math.max(0, Math.min(256 - size, px - sampleRadius));
      const sy = Math.max(0, Math.min(256 - size, py - sampleRadius));

      const imgData = ctx.getImageData(sx, sy, size, size).data;
      let forestPixels = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        if (isForestColor(imgData[i], imgData[i + 1], imgData[i + 2])) {
          forestPixels++;
        }
      }

      return forestPixels >= 2;
    } catch (e) {
      console.warn('[ForestAPI] Tile check error at zoom', zoom, e);
      return null;
    }
  };

  // Sprawdzaj równolegle zoom 15 i 14 dla maksymalnej szybkości
  const [res15, res14] = await Promise.all([
    checkAtZoom(15),
    checkAtZoom(14),
  ]);

  if (res15 === true || res14 === true) return true;
  if (res15 === false && res14 === false) return false;

  // W razie braku jednoznacznego wyniku sprawdź zoom 16
  const res16 = await checkAtZoom(16);
  if (res16 === true) return true;
  if (res16 === false) return false;

  return null;
}

// ── Funkcje publiczne ──────────────────────────────────────────────

/**
 * Główna funkcja: pobierz dane o lesie dla GPS.
 * Nadrzędnie decyduje OpenStreetMap (OSM) czy na danym obszarze znajduje się las.
 * Dane Lasów Państwowych (LP BDL) uzupełniają informację o szczegółowy skład, wiek i siedlisko.
 * @returns {Object} { isForest, isApproximate, missingLpData, forestName, ... }
 */
export async function getForestData(lat, lng) {
  // 1. Sprawdź pamięć podręczną pobranych poligonów (BDL oraz OSM z heatmapy — 0 ms)
  let cached = null;
  try {
    cached = getCachedForestAt(lat, lng);
  } catch (e) {
    console.warn('[ForestAPI] Cache check error:', e);
  }

  // 2. Równoległe pobieranie: weryfikacja lasu na OSM oraz zapytanie do urzędowego OGC API Lasów Państwowych
  const [isOsmTileForest, lpData, park] = await Promise.all([
    isOsmForestTileAt(lat, lng),
    fetchFromOGC(lat, lng).catch(() => null),
    Promise.resolve(checkNationalPark(lat, lng)),
  ]);

  // A. JEŚLI LASY PAŃSTWOWE POSIADAJĄ DANE:
  // Wykorzystujemy pełne, urzędowe dane wydzielenia leśnego
  if (lpData) {
    return lpData;
  }

  // B. JEŚLI PUNKT BYŁ W POLIGONIE BDL W CACHE:
  if (cached && !!(cached.properties?.adr_for || cached.properties?.species_cd)) {
    const p = cached.properties || {};
    const specCodes = parseSpeciesCode(p.species_cd || '');
    return {
      source: 'OGC_LP',
      isForest: true,
      isApproximate: false,
      terrainType: 'forest',
      forestName: parseNazwaLP(p.nazwa, p.rdlp),
      nadlesnictwo: extractNadlesnictwo(p.nazwa, p.rdlp),
      rdlp: p.rdlp ? formatRDLPName(p.rdlp) : null,
      speciesCodes: specCodes.length ? specCodes : ['So'],
      habitatCode: p.site_type || null,
      area: p.sub_area ? `${p.sub_area} ha` : null,
      rawCode: p.species_cd || null,
      specAge: p.spec_age ? `${p.spec_age} lat` : null,
      adrFor: p.adr_for || null,
      _feature: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [cached.outer || cached.ring, ...(cached.holes || [])],
        },
        properties: p,
      },
    };
  }

  // C. NADRZĘDNE POTWIERDZENIE LASU Z OPENSTREETMAP:
  // Jeśli kafelek OSM pokazuje las, punkt leży w Parku Narodowym lub w poligonie OSM:
  const isConfirmedOsmForest = isOsmTileForest === true || !!park || !!(cached && (cached.missingLpData || cached.isOsmOnly));

  if (isConfirmedOsmForest) {
    const p = cached?.properties || {};
    const fName = park
      ? park.name
      : (cached?.stand?.specDesc || p.name || 'Las (poza ewidencją Lasów Państwowych)');

    return {
      source: 'OSM',
      isForest: true,
      isApproximate: true,
      missingLpData: true,
      isNationalPark: !!park,
      terrainType: 'forest',
      forestName: fName,
      nadlesnictwo: null,
      rdlp: null,
      speciesCodes: ['So', 'Db'],
      habitatCode: null,
      area: null,
      rawCode: 'mixed',
      specAge: null,
      adrFor: null,
      _feature: cached ? {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [cached.outer || cached.ring, ...(cached.holes || [])],
        },
        properties: p,
      } : null,
    };
  }

  // D. Fallback: Zapytaj Overpass API (gdy kafelek nie został jednoznacznie sklasyfikowany)
  try {
    const osmData = await fetchFromOverpass(lat, lng);
    if (osmData && osmData.isForest) {
      osmData.missingLpData = true;
      return osmData;
    }
    if (osmData && !osmData.isForest) {
      return osmData;
    }
  } catch (e) {
    console.warn('[ForestAPI] Overpass error:', e.message);
  }

  // E. Fallback: Nominatim reverse geocode (weryfikacja ścieżek leśnych, wody i miast)
  try {
    const nomData = await fetchFromNominatim(lat, lng);
    if (nomData) {
      if (nomData.isForest) nomData.missingLpData = true;
      return nomData;
    }
  } catch (e) {
    console.warn('[ForestAPI] Nominatim error:', e.message);
  }

  // F. Poza lasem: teren otwarty (łąka / pole uprawne)
  return {
    source: 'NON_FOREST',
    isForest: false,
    terrainType: 'meadow',
    forestName: 'Teren otwarty (łąka / pole uprawne)',
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
  // 1. Sprawdź pamięć podręczną heatmapy
  try {
    const cached = getCachedForestAt(lat, lng);
    if (cached?.outer) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [cached.outer, ...(cached.holes || [])],
        },
        properties: cached.properties || {},
      };
    }
  } catch {}

  // 2. Jeśli brak w cache, pobierz z OGC API LP
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
    const url = `${OGC_BASE}/${collection.id}/items?f=json&bbox=${bbox}&limit=100`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.features?.length) continue;

      // Wybierz wydzielenie: wewnątrz poligonu lub w promieniu ścieżki leśnej (do 90m)
      const match = findBestFeature(data.features, lat, lng, 90);
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

// ── Overpass API & Nominatim (detekcja lasów niepaństwowych, miast i terenu) ───

async function fetchFromOverpass(lat, lng) {
  // Sprawdza lasy, rezerwaty, akweny oraz tereny miejskie/wiejskie wokół punktu z promieniem 600m
  const query = `
    [out:json][timeout:4];
    (
      way["natural"="wood"](around:600,${lat},${lng});
      way["landuse"="forest"](around:600,${lat},${lng});
      relation["natural"="wood"](around:600,${lat},${lng});
      relation["landuse"="forest"](around:600,${lat},${lng});
      way["leisure"="nature_reserve"](around:600,${lat},${lng});
      relation["leisure"="nature_reserve"](around:600,${lat},${lng});
      relation["boundary"="national_park"](around:600,${lat},${lng});
      way["natural"="water"](around:60,${lat},${lng});
      way["waterway"](around:40,${lat},${lng});
      way["building"](around:60,${lat},${lng});
      way["landuse"~"residential|commercial|industrial|retail|construction|cemetery|garages"](around:80,${lat},${lng});
      way["highway"~"pedestrian|living_street"](around:50,${lat},${lng});
      way["landuse"~"meadow|farmland|orchard|allotments"](around:100,${lat},${lng});
      way["natural"~"grassland|heath|scrub"](around:80,${lat},${lng});
    );
    out tags 25;
  `;

  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Grzybomapa/1.0 (https://grzybomapa.pl; kontakt@grzybomapa.pl)',
          'Accept': 'application/json, */*'
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.elements?.length) continue;

      const elements = data.elements;

      // 1. Sprawdź czy to las / zadrzewienie / rezerwat / młodnik / zalesienie (PRIORYTET)
      const forestEl = elements.find(el => {
        const t = el.tags || {};
        return t.natural === 'wood' || t.landuse === 'forest' ||
               t.natural === 'scrub' || t.landuse === 'plant_nursery' ||
               t.leisure === 'nature_reserve' || t.boundary === 'national_park' ||
               t.boundary === 'protected_area' ||
               t.tree_row || t.trees || t.wood ||
               (t.landuse === 'meadow' && (t.trees || t.wood));
      });

      if (forestEl) {
        const tags = forestEl.tags || {};
        const leafType = tags.leaf_type;
        let name = tags.name || tags['name:pl'];
        if (!name) {
          if (tags.boundary === 'national_park') name = 'Park Narodowy';
          else if (tags.natural === 'scrub') name = 'Młodnik leśny / Zadrzewienie (OSM)';
          else if (tags.tree_row) name = 'Pas drzew / Zadrzewienie (OSM)';
          else name = 'Zalesienie / Las (OpenStreetMap)';
        }

        let speciesCodes = [];
        if      (leafType === 'needleleaved') speciesCodes = ['So', 'Sw'];
        else if (leafType === 'broadleaved')  speciesCodes = ['Db', 'Brz'];
        else if (leafType === 'mixed')        speciesCodes = ['So', 'Db'];
        else                                  speciesCodes = ['So', 'Db'];

        return {
          source: 'OSM_Overpass',
          isForest: true,
          isApproximate: true,
          terrainType: 'forest',
          forestName: name,
          nadlesnictwo: null,
          rdlp: null,
          speciesCodes,
          habitatCode: null,
          area: null,
          rawCode: leafType || 'mixed',
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

      // 3. Sprawdź czy to teren zabudowany / miejski
      const urbanEl = elements.find(el => {
        const t = el.tags || {};
        return ['residential', 'commercial', 'industrial', 'retail', 'construction', 'cemetery', 'garages'].includes(t.landuse) ||
               t.building ||
               ['pedestrian', 'living_street'].includes(t.highway);
      });
      if (urbanEl) {
        const t = urbanEl.tags || {};
        const label = t.name ? `Teren miejski / zabudowany (${t.name})` : 'Teren miejski / zabudowany';
        return {
          source: 'OSM_Overpass',
          isForest: false,
          terrainType: 'urban',
          forestName: label,
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

      // 4. Sprawdź czy to pole uprawne lub otwarta łąka bez zadrzewień
      const meadowEl = elements.find(el => {
        const t = el.tags || {};
        if (t.trees || t.wood || t.tree_row || t.natural === 'scrub') return false;
        return ['farmland', 'allotments', 'village_green', 'recreation_ground'].includes(t.landuse) ||
               (t.landuse === 'meadow' && !t.trees) ||
               (t.natural === 'grassland' && !t.trees) ||
               (t.natural === 'heath' && !t.trees);
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
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Niezawodny fallback Nominatim — inteligentnie rozróżnia lasy miejskie, tereny zurbanizowane i łąki
 */
async function fetchFromNominatim(lat, lng) {
  try {
    const url16 = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&extratags=1`;
    const res16 = await fetch(url16, {
      headers: { 'User-Agent': 'Grzybomapa/2.0 (kontakt@grzybomapa.pl)' },
      signal: AbortSignal.timeout(3500)
    });
    if (!res16.ok) return null;
    const d = await res16.json();
    const a = d.address || {};
    const name = d.name || '';
    const displayName = d.display_name || '';

    // 1. Sprawdź czy to las / rezerwat / park narodowy (także lasy miejskie, np. Las Kabacki, Las Wolski)
    const isForest = isForestText(name) || isForestText(displayName) ||
                     ['wood', 'forest', 'nature_reserve'].includes(d.type) ||
                     ['wood', 'forest'].includes(d.class);

    if (isForest) {
      const fName = isForestText(name) ? name : (name ? `Las (${name})` : 'Las / Obszar leśny (OSM)');
      return {
        source: 'OSM_Nominatim',
        isForest: true,
        isApproximate: true,
        terrainType: 'forest',
        forestName: fName,
        nadlesnictwo: null,
        rdlp: null,
        speciesCodes: ['So', 'Db'],
        habitatCode: null,
        area: null,
        rawCode: 'mixed',
        specAge: null,
        adrFor: null,
        _feature: null,
      };
    }

    // 2. Jeśli zoom=16 nie wykrył lasu, sprawdź zoom=14 pod kątem obszaru leśnego lub rezerwatu
    try {
      const url14 = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&extratags=1`;
      const res14 = await fetch(url14, {
        headers: { 'User-Agent': 'Grzybomapa/2.0 (kontakt@grzybomapa.pl)' },
        signal: AbortSignal.timeout(2500)
      });
      if (res14.ok) {
        const d14 = await res14.json();
        if (isForestText(d14.name) || isForestText(d14.display_name) || isForestText(d14.extratags?.['name:prefix'])) {
          return {
            source: 'OSM_Nominatim',
            isForest: true,
            isApproximate: true,
            terrainType: 'forest',
            forestName: d14.name || 'Las / Rezerwat przyrody (OSM)',
            nadlesnictwo: null,
            rdlp: null,
            speciesCodes: ['So', 'Db'],
            habitatCode: null,
            area: null,
            rawCode: 'mixed',
            specAge: null,
            adrFor: null,
            _feature: null,
          };
        }
      }
    } catch {}

    // Ścieżka, dukt lub szlak leśny (path, track, footway)
    const isPathOrTrack = ['path', 'track', 'footway', 'cycleway'].includes(d.type);

    const nomLat = parseFloat(d.lat), nomLon = parseFloat(d.lon);
    const dDist = (!isNaN(nomLat) && !isNaN(nomLon))
      ? Math.hypot((lat - nomLat) * 111000, (lng - nomLon) * 111000 * Math.cos(lat * Math.PI / 180))
      : 0;

    // 3. Sprawdź czy otoczenie ścieżki wskazuje na leśną drogę/szlak bez zabudowań miejskich
    const hasBuildingOrHouse = (dDist < 120) && (
                               !!a.house_number ||
                               ['building', 'shop', 'amenity', 'office', 'tourism', 'craft'].includes(d.class) ||
                               ['house', 'apartments', 'commercial', 'retail', 'pedestrian', 'living_street'].includes(d.type) ||
                               ['house', 'building', 'city_block'].includes(d.addresstype)
    );

    const cityName = a.city || a.town;

    if (isPathOrTrack && !hasBuildingOrHouse) {
      const textAll = `${name} ${displayName} ${a.hamlet || ''} ${a.village || ''} ${d.extratags?.['name:prefix'] || ''}`;
      if (isForestText(textAll) || ['dirt', 'unpaved', 'ground', 'gravel'].includes(d.extratags?.surface) || !cityName) {
        return {
          source: 'OSM_Nominatim',
          isForest: true,
          isApproximate: true,
          terrainType: 'forest',
          forestName: name ? `Ścieżka leśna (${name})` : 'Ścieżka leśna / las (OSM)',
          nadlesnictwo: null,
          rdlp: null,
          speciesCodes: ['So', 'Db'],
          habitatCode: null,
          area: null,
          rawCode: 'mixed',
          specAge: null,
          adrFor: null,
          _feature: null,
        };
      }
    }

    const isUrbanStreet = (dDist < 120) && !!cityName && !isPathOrTrack && (
      ['residential', 'living_street', 'pedestrian'].includes(d.type) ||
      ['city_block', 'quarter'].includes(d.addresstype) ||
      (['primary', 'secondary', 'tertiary'].includes(d.type) && !!a.house_number)
    );

    if (!isPathOrTrack && (hasBuildingOrHouse || isUrbanStreet)) {
      const cityLabel = cityName || a.village || '';
      const label = cityLabel ? `Teren miejski / zabudowany (${cityLabel})` : 'Teren miejski / zabudowany';
      return {
        source: 'OSM_Nominatim',
        isForest: false,
        terrainType: 'urban',
        forestName: label,
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

    // 4. W pozostałych przypadkach to teren otwarty (łąka / pole uprawne)
    const villageName = a.village || a.hamlet;
    return {
      source: 'OSM_Nominatim',
      isForest: false,
      terrainType: 'meadow',
      forestName: villageName ? `Teren otwarty (łąka / pole — okolice ${villageName})` : 'Teren otwarty (łąka / pole uprawne)',
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
  } catch {
    return null;
  }
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
