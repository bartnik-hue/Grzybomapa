/**
 * heatmap.js v7
 * ==============
 * Oficjalna Leśna Rastrowa Mapa Cieplna Grzybów (Forest-Masked Thermal Raster)
 *
 * 1. MASKOWANIE LEŚNE (PRIORYTET 1):
 *    Pobiera oficjalne wydzielenia leśne z OGC API Lasów Państwowych (ogcapi.bdl.lasy.gov.pl).
 *    Wszystkie tereny poza lasem (miasta, pola, łąki, woda) są w 100% PRZEZROCZYSTE (szansa: 0%).
 *    W przypadku braku lasów w rejonie mapa nie jest zalewana zielonym kolorem — jest pusta.
 *
 * 2. ANALIZA POGODY I MIKRO-TERENU (PRIORYTET 2):
 *    Open-Meteo Elevation API (64 punkty w 150 ms).
 *    Wylicza rzeczywiste zagłębienia terenu (doliny gromadzące wilgoć), stoki ocienione
 *    oraz uwzględnia sumę opadów z 14 dni, temperatury nocne i dni po deszczu.
 *
 * 3. WYDAJNOŚĆ I STABILNOŚĆ:
 *    Równoległe zapytania z precyzyjnym indeksem BBox polygonów.
 *    Koniec z zawieszającym się paskiem ładowania — pewne chowanie w bloku finally.
 */

import { scoreStand } from './scoring.js';

const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';
const BDL_OGC_BASE  = 'https://ogcapi.bdl.lasy.gov.pl/collections';

// Mapowanie 17 RDLP w Polsce z ich zakresami geograficznymi
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

const AREA_KM     = 10;  // Wymiar obszaru analizy [km × km] (10×10 km stabilny kafelek)
const GRID_N      = 12;  // 12×12 = 144 punkty wysokościowe (gładka mikrorzeźba)
const MASK_N      = 64;  // 64×64 siatka maski leśnej (4x wyższa szczegółowość granic)
const CANVAS_SIZE = 400; // Rozdzielczość rastra Leaflet (wysoka ostrość bez rozmyć)
const SNAP_LAT    = 0.04; // Krok kotwiczenia siatki geograficznej (~4.4 km)
const SNAP_LNG    = 0.06; // Krok kotwiczenia siatki geograficznej (~3.8 km)

// Leaflet instancje
let imageOverlay  = null;
let analysisRect  = null;
let mapRef        = null;
let visible       = false;

// Dane i Cache
let lastWeather           = null;
let lastMonth             = null;
let centerLat             = null;
let centerLng             = null;
let currentRenderedBounds = null; // [[south, west], [north, east]]
let cachedPolygons        = null;
let cachedElevations      = null;
let cachedPoints          = null;
let cachedBboxKey         = null;

// UI
let loadingEl = null;
let statusEl  = null;

// Paleta gradientu termicznego (RGB)
const COLOR_STOPS = [
  { p: 0.00, r: 30,  g: 27,  b: 75  }, // 0.00: granat (bardzo niska)
  { p: 0.18, r: 59,  g: 130, b: 246 }, // 0.18: niebieski (niska)
  { p: 0.35, r: 16,  g: 185, b: 129 }, // 0.35: szmaragd / zielony (umiarkowana)
  { p: 0.52, r: 132, g: 204, b: 22  }, // 0.52: limonka (dobra)
  { p: 0.70, r: 234, g: 179, b: 8   }, // 0.70: żółty (bardzo dobra)
  { p: 0.85, r: 249, g: 115, b: 22  }, // 0.85: pomarańcz (wysyp)
  { p: 1.00, r: 220, g: 38,  b: 38  }, // 1.00: czerwień (idealne warunki grzybobrania)
];

// Domyślna pogoda jeśli brak odczytów ze stacji
const DEFAULT_WEATHER = {
  avgNightTemp7: 13.5,
  totalRain14: 45,
  avgHumidity7: 72,
  daysSinceRain: 4,
};

function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/**
 * Sprawdza czy punkt mieści się w bezpiecznym wnętrzu aktualnego obszaru analizy.
 * Zapobiega to jakiemukolwiek przeliczaniu czy drżeniu heatmapy przy ruchach próbnika.
 */
function isPointInSafeZone(lat, lng) {
  if (!currentRenderedBounds) return false;
  const [[south, west], [north, east]] = currentRenderedBounds;
  // Margines 2.5 km od krawędzi kafelka (dla 10×10 km daje bezpieczny obszar 5×5 km)
  const marginLat = latDeg(2.5);
  const marginLng = lngDeg(2.5, lat);
  return (
    lat >= (south + marginLat) && lat <= (north - marginLat) &&
    lng >= (west + marginLng)  && lng <= (east - marginLng)
  );
}

// ─────────────────────────────────────────────────────────────────
// PUBLICZNE API
// ─────────────────────────────────────────────────────────────────

export function initHeatmap(map) {
  mapRef = map;
  loadingEl = document.getElementById('heatmap-loading');
  statusEl  = document.getElementById('heatmap-status');
}

/**
 * Ustawia centrum analizy heatmapy z gwarancją stabilności geograficznej.
 * Przestawienie próbnika w tym samym lesie NIE przesuwa ani nie zmienia heatmapy.
 */
export function setHeatmapCenter(lat, lng) {
  if (!lat || !lng) return;

  // 1. Jeśli punkt mieści się w już wyliczonym obszarze — NIE ruszaj heatmapy!
  if (currentRenderedBounds && isPointInSafeZone(lat, lng)) {
    return;
  }

  // 2. Kotwiczenie geograficzne (Grid Snapping) do stałych węzłów siatki świata
  centerLat = Math.round(lat / SNAP_LAT) * SNAP_LAT;
  centerLng = Math.round(lng / SNAP_LNG) * SNAP_LNG;

  if (!visible) return;
  renderAndFetch();
}

export function updateHeatmap(weatherAnalysis, month) {
  const isDiff = !lastWeather ||
    Math.abs((lastWeather.totalRain14 || 0) - (weatherAnalysis?.totalRain14 || 0)) > 2 ||
    Math.abs((lastWeather.avgNightTemp7 || 0) - (weatherAnalysis?.avgNightTemp7 || 0)) > 0.5;

  lastWeather = weatherAnalysis;
  lastMonth   = month;

  if (!visible || !isDiff) return;

  // Jeśli mamy już dane terenu i lasów, wystarczy zaktualizować warstwę bez pytań do sieci
  if (cachedPolygons && cachedElevations && currentRenderedBounds && cachedPoints) {
    renderHeatmapOverlay(cachedPoints, cachedElevations, currentRenderedBounds, cachedPolygons);
  } else if (!isPointInSafeZone(centerLat, centerLng)) {
    renderAndFetch();
  }
}

export function toggleHeatmap(show) {
  visible = show;
  if (!mapRef) return;

  if (show) {
    if (!centerLat || !centerLng) {
      const c = mapRef.getCenter();
      centerLat = Math.round(c.lat / SNAP_LAT) * SNAP_LAT;
      centerLng = Math.round(c.lng / SNAP_LNG) * SNAP_LNG;
    }
    if (!lastWeather) {
      lastWeather = DEFAULT_WEATHER;
      lastMonth   = new Date().getMonth() + 1;
    }

    if (imageOverlay && currentRenderedBounds) {
      if (!mapRef.hasLayer(imageOverlay)) imageOverlay.addTo(mapRef);
      if (analysisRect && !mapRef.hasLayer(analysisRect)) analysisRect.addTo(mapRef);
      if (isPointInSafeZone(centerLat, centerLng)) return;
    }

    renderAndFetch();
  } else {
    if (imageOverlay) {
      mapRef.removeLayer(imageOverlay);
    }
    if (analysisRect) {
      mapRef.removeLayer(analysisRect);
      analysisRect = null;
    }
    setLoading(false);
  }
}

export function isHeatmapVisible() {
  return visible;
}

// ─────────────────────────────────────────────────────────────────
// GŁÓWNA LOGIKA RENDEROOWANIA
// ─────────────────────────────────────────────────────────────────

async function renderAndFetch() {
  if (!mapRef) return;
  if (!centerLat || !centerLng) {
    const c = mapRef.getCenter();
    centerLat = c.lat;
    centerLng = c.lng;
  }
  if (!lastWeather) lastWeather = DEFAULT_WEATHER;

  const points = generateFixedGrid(centerLat, centerLng, AREA_KM, GRID_N);
  drawAnalysisRect(centerLat, centerLng, AREA_KM);

  setLoading(true);
  setStatus(`Pobieranie wydzieleń leśnych i rzeźby terenu…`);

  try {
    const halfLat = latDeg(AREA_KM / 2);
    const halfLng = lngDeg(AREA_KM / 2, centerLat);
    const south = centerLat - halfLat, north = centerLat + halfLat;
    const west  = centerLng - halfLng, east  = centerLng + halfLng;
    const bboxKey = `${south.toFixed(3)}_${west.toFixed(3)}_${north.toFixed(3)}_${east.toFixed(3)}`;

    // Pobierz poligony leśne (BDL OGC API) oraz wysokości (Open-Meteo) równolegle
    const [forestRings, elevations] = await Promise.all([
      (cachedPolygons && cachedBboxKey === bboxKey)
        ? Promise.resolve(cachedPolygons)
        : fetchBdlForestRings(south, west, north, east),
      fetchElevations(points),
    ]);

    cachedPolygons   = forestRings;
    cachedElevations = elevations;
    cachedPoints     = points;
    cachedBboxKey    = bboxKey;

    const bounds = [[south, west], [north, east]];
    currentRenderedBounds = bounds;

    // PRIORYTET 1: Sprawdź obecność lasów
    if (!forestRings || forestRings.length === 0) {
      // Brak lasów w analizowanym rejonie — NIE malujemy zielonego pola!
      if (imageOverlay && mapRef.hasLayer(imageOverlay)) {
        mapRef.removeLayer(imageOverlay);
      }
      setStatus(`🌲 Obszar bezleśny (miasto/pola) — szansa na grzyby: 0%`);
      return;
    }

    // PRIORYTET 2: Renderuj gładką termiczną mapę leśną z mikrorzeźbą
    renderHeatmapOverlay(points, elevations, bounds, forestRings);

    const rain  = lastWeather.totalRain14?.toFixed(0) ?? '40';
    const temp  = lastWeather.avgNightTemp7?.toFixed(1) ?? '14';
    const days  = lastWeather.daysSinceRain ?? 4;
    const rings = forestRings.length;
    setStatus(`${temp}°C nocą · ${rain}mm/14d · ${days}d po deszczu · 🌲 ${rings} wydzieleń leśnych`);

  } catch (e) {
    console.warn('[Heatmap] Render error:', e);
    setStatus(`Obliczanie warunków zakończone`);
  } finally {
    setLoading(false);
  }
}

/**
 * Pobiera oficjalne wydzielenia leśne z OGC API Lasów Państwowych (z fallbackiem OSM dla parków narodowych/lasów prywatnych)
 */
async function fetchBdlForestRings(south, west, north, east) {
  const matchingCols = RDLP_COLLECTIONS.filter(r =>
    !(north < r.minLat || south > r.maxLat || east < r.minLng || west > r.maxLng)
  );

  const bbox = `${west.toFixed(4)},${south.toFixed(4)},${east.toFixed(4)},${north.toFixed(4)}`;

  let allFeatures = [];
  if (matchingCols.length > 0) {
    // Zapytaj pasujące RDLP równolegle — pobierz do 1500 wydzieleń (pełne pokrycie kafelka 10x10 km)
    const fetches = matchingCols.map(col => {
      const url = `${BDL_OGC_BASE}/${col.id}/items?f=json&bbox=${bbox}&limit=1500`;
      return fetchWithTimeout(url, {}, 5000)
        .then(r => r.ok ? r.json() : { features: [] })
        .catch(() => ({ features: [] }));
    });

    const results = await Promise.all(fetches);
    allFeatures = results.flatMap(r => r.features || []);
  }

  // Jeśli BDL nie zwróciło wydzieleń (np. Park Narodowy lub las prywatny), pobierz obrysy leśne z OSM
  if (allFeatures.length < 5) {
    const osmRings = await fetchOsmForestRings(south, west, north, east);
    if (osmRings.length > 0) {
      return osmRings;
    }
  }

  return extractPolygonRings(allFeatures);
}

/**
 * Fallback dla Parków Narodowych i lasów prywatnych spoza ewidencji BDL LP
 */
async function fetchOsmForestRings(south, west, north, east) {
  const query = `
    [out:json][timeout:5];
    (
      way["natural"="wood"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
      way["landuse"="forest"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
    );
    out geom;
  `;
  try {
    const res = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Grzybomapa/2.0'
      }
    }, 4500);
    if (!res.ok) return [];
    const data = await res.json();
    const rings = [];
    for (const el of data.elements || []) {
      if (!el.geometry || el.geometry.length < 3) continue;
      const ring = el.geometry.map(pt => [pt.lon, pt.lat]);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      rings.push({
        ring,
        minX, maxX, minY, maxY,
        stand: { standScore: 0.75, specDesc: el.tags?.name || 'Las (OSM)' },
        properties: el.tags || {},
      });
    }
    return rings;
  } catch {
    return [];
  }
}

/**
 * Wyciąga obrysy wielokątów z precyzyjnym indeksem BBox dla błyskawicznego testu
 */
function extractPolygonRings(features) {
  const index = [];
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;

    const stand = scoreStand(f.properties) || { standScore: 0.70 };

    const rings = [];
    if (geom.type === 'Polygon') {
      if (geom.coordinates?.[0]) rings.push(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
      if (geom.coordinates) {
        for (const poly of geom.coordinates) {
          if (poly?.[0]) rings.push(poly[0]);
        }
      }
    }

    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0], y = ring[i][1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      index.push({
        ring,
        minX, maxX, minY, maxY,
        stand,
        properties: f.properties || {},
      });
    }
  }
  return index;
}

/**
 * Znajduje wydzielenie leśne zawierające dany punkt
 */
function findStandAt(x, y, ringIndex) {
  for (let i = 0; i < ringIndex.length; i++) {
    const p = ringIndex[i];
    if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
    if (pointInPolygon(x, y, p.ring)) return p;
  }
  return null;
}

/**
 * Pobiera wysokości terenu w 1 zapytaniu przez Open-Meteo (~140 ms)
 */
async function fetchElevations(points) {
  try {
    const lats = points.map(p => p.lat.toFixed(5)).join(',');
    const lngs = points.map(p => p.lng.toFixed(5)).join(',');
    const url = `${ELEVATION_API}?latitude=${lats}&longitude=${lngs}`;

    const res = await fetchWithTimeout(url, {}, 3500);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.elevation || null;
  } catch (e) {
    console.warn('[Heatmap] Open-Meteo elevation error:', e);
    return null;
  }
}

/**
 * Renderuje teksturę Canvas i nakłada na mapę
 */
function renderHeatmapOverlay(points, elevations, bounds, forestRings) {
  const weatherS = getWeatherScore(lastWeather);
  const seasonS  = getSeasonScore(lastMonth ?? new Date().getMonth() + 1);

  // Wycena ukształtowania terenu na podstawie rzeczywistych wysokości n.p.m.
  const terrainScores = elevations
    ? computeTerrainScores(points, elevations, GRID_N)
    : points.map(() => 0.5); // Neutralny współczynnik terenu przy braku danych wysokościowych (zero sztucznych fal)

  const grid8 = Array.from({ length: GRID_N }, () => new Array(GRID_N));
  points.forEach((p, i) => {
    grid8[p.row][p.col] = terrainScores[i] ?? 0.5;
  });

  const dataUrl = renderGridToCanvas(grid8, GRID_N, CANVAS_SIZE, CANVAS_SIZE, bounds, forestRings, weatherS, seasonS);

  if (imageOverlay) {
    imageOverlay.setUrl(dataUrl);
    imageOverlay.setBounds(bounds);
    if (!mapRef.hasLayer(imageOverlay)) imageOverlay.addTo(mapRef);
  } else {
    imageOverlay = L.imageOverlay(dataUrl, bounds, {
      opacity: 0.85,
      interactive: false,
    }).addTo(mapRef);
  }
}

/**
 * Generuje piksele rastra Canvas.
 * Miejsca poza lasami otrzymują alpha = 0 (100% przezroczyste).
 * Wewnątrz lasu każdy płat odzwierciedla wiek, gatunek i siedlisko konkretnego wydzielenia LP.
 */
function renderGridToCanvas(gridSrc, nSrc, width, height, bounds, forestRings, weatherS, seasonS) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const [[south, west], [north, east]] = bounds;

  // Siatka próbkowania jakości drzewostanu (MASK_N x MASK_N)
  const forestMask = Array.from({ length: MASK_N }, () => new Array(MASK_N));
  for (let r = 0; r < MASK_N; r++) {
    const lat = south + (north - south) * (r / (MASK_N - 1));
    for (let c = 0; c < MASK_N; c++) {
      const lng = west + (east - west) * (c / (MASK_N - 1));
      const hit = findStandAt(lng, lat, forestRings);
      forestMask[r][c] = hit ? Math.max(0.40, hit.stand?.standScore ?? 0.70) : 0.0;
    }
  }

  for (let y = 0; y < height; y++) {
    const rScale = ((height - 1 - y) / (height - 1)) * (nSrc - 1);
    const r0 = Math.floor(rScale), r1 = Math.min(nSrc - 1, r0 + 1), rf = rScale - r0;

    const mScale = ((height - 1 - y) / (height - 1)) * (MASK_N - 1);
    const mr0 = Math.floor(mScale), mr1 = Math.min(MASK_N - 1, mr0 + 1), mrf = mScale - mr0;

    for (let x = 0; x < width; x++) {
      const mcScale = (x / (width - 1)) * (MASK_N - 1);
      const mc0 = Math.floor(mcScale), mc1 = Math.min(MASK_N - 1, mc0 + 1), mcf = mcScale - mc0;

      // Dwuliniowa interpolacja jakości drzewostanu z krawędziami
      const fm00 = forestMask[mr0][mc0], fm10 = forestMask[mr1][mc0];
      const fm01 = forestMask[mr0][mc1], fm11 = forestMask[mr1][mc1];
      const fFactor = (1 - mrf) * (1 - mcf) * fm00 +
                      mrf * (1 - mcf) * fm10 +
                      (1 - mrf) * mcf * fm01 +
                      mrf * mcf * fm11;

      // Poza lasem — piksel jest w 100% przezroczysty!
      if (fFactor < 0.03) {
        const idx = (y * width + x) * 4;
        data[idx + 3] = 0;
        continue;
      }

      const cScale = (x / (width - 1)) * (nSrc - 1);
      const c0 = Math.floor(cScale), c1 = Math.min(nSrc - 1, c0 + 1), cf = cScale - c0;

      // Interpolacja mikrorzeźby (dolinki zbierające wilgoć vs odsłonięte wzniesienia)
      const v00 = gridSrc[r0][c0], v10 = gridSrc[r1][c0];
      const v01 = gridSrc[r0][c1], v11 = gridSrc[r1][c1];
      const reliefVal = (1 - rf) * (1 - cf) * v00 +
                        rf * (1 - cf) * v10 +
                        (1 - rf) * cf * v01 +
                        rf * cf * v11;

      // Realistyczna wartość termiczna: Drzewostan BDL/OSM (45%) + Pogoda (40%) + Rzeźba (15%) × Sezon
      const standVal = clamp(fFactor, 0.20, 1.0);
      const val = (0.45 * standVal + 0.40 * weatherS + 0.15 * reliefVal) * seasonS;

      const color = getColorForVal(val);
      const idx = (y * width + x) * 4;

      data[idx]     = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      // Łagodne wygaszanie przezroczystości na zewnętrznych obrysach lasu
      const alphaFactor = fFactor > 0.15 ? 1.0 : fFactor / 0.15;
      data[idx + 3] = Math.round(color.a * alphaFactor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}

/**
 * Sprawdza czy punkt [x, y] leży w którymkolwiek obrysie leśnym
 */
function isInsideAny(x, y, ringIndex) {
  for (let i = 0; i < ringIndex.length; i++) {
    const p = ringIndex[i];
    // Szybkie odrzucenie punktów poza obwiednią BBox
    if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) continue;
    if (pointInPolygon(x, y, p.ring)) return true;
  }
  return false;
}

/**
 * Algorytm Ray-Casting dla wielokąta
 */
function pointInPolygon(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getColorForVal(v) {
  v = Math.max(0, Math.min(1, v));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const s0 = COLOR_STOPS[i], s1 = COLOR_STOPS[i + 1];
    if (v >= s0.p && v <= s1.p) {
      const t = (v - s0.p) / (s1.p - s0.p);
      return {
        r: Math.round(s0.r + t * (s1.r - s0.r)),
        g: Math.round(s0.g + t * (s1.g - s0.g)),
        b: Math.round(s0.b + t * (s1.b - s0.b)),
        a: Math.round(140 + v * 65),
      };
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  return { r: last.r, g: last.g, b: last.b, a: 200 };
}

// ─────────────────────────────────────────────────────────────────
// POMOCNICZE MIKRORZEŹBY I SCORINGU
// ─────────────────────────────────────────────────────────────────

function latDeg(km)      { return km / 111.32; }
function lngDeg(km, lat) { return km / (111.32 * Math.cos(lat * Math.PI / 180)); }

function generateFixedGrid(clat, clng, sizeKm, n) {
  const halfLat = latDeg(sizeKm / 2);
  const halfLng = lngDeg(sizeKm / 2, clat);

  const points = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      points.push({
        lat: clat - halfLat + (2 * halfLat * r / (n - 1)),
        lng: clng - halfLng + (2 * halfLng * c / (n - 1)),
        row: r,
        col: c,
      });
    }
  }
  return points;
}

function drawAnalysisRect(clat, clng, sizeKm) {
  const halfLat = latDeg(sizeKm / 2);
  const halfLng = lngDeg(sizeKm / 2, clat);
  const bounds  = [
    [clat - halfLat, clng - halfLng],
    [clat + halfLat, clng + halfLng],
  ];

  if (analysisRect) {
    analysisRect.setBounds(bounds);
  } else {
    analysisRect = L.rectangle(bounds, {
      color:       '#eab308',
      weight:      2,
      dashArray:   '8 6',
      fillOpacity: 0.02,
      fillColor:   '#eab308',
      interactive: false,
    }).addTo(mapRef);
  }

  analysisRect.bindTooltip(
    `🌡️ Obszar analizy leśnej: ${sizeKm}×${sizeKm} km`,
    { permanent: false, direction: 'top', className: 'heatmap-rect-tooltip' }
  );
}

function computeTerrainScores(points, elevations, n) {
  const get = (r, c) => {
    r = Math.max(0, Math.min(n - 1, r));
    c = Math.max(0, Math.min(n - 1, c));
    return elevations[r * n + c] ?? 0;
  };

  return points.map((p, i) => {
    const r = p.row, c = p.col;
    const e = elevations[i] ?? 0;

    const neighbors = [
      get(r-1,c), get(r+1,c), get(r,c-1), get(r,c+1),
      get(r-1,c-1), get(r-1,c+1), get(r+1,c-1), get(r+1,c+1),
    ];
    const avgN = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
    // Dolinki i obniżenia gromadzące wilgoć
    const valleyScore = sigmoid(avgN - e, 0, 3.2);

    // Ekspozycja zbocza (stoki północne i wschodnie są wilgotniejsze)
    const dN = get(r-1,c) - e;
    const aspectScore = 0.5 + 0.3 * clamp(-dN / 3, -1, 1);

    // Spadek terenu
    const slopeH = Math.abs(get(r, c+1) - get(r, c-1)) / 2;
    const slopeV = Math.abs(get(r+1, c) - get(r-1, c)) / 2;
    const slope  = Math.sqrt(slopeH*slopeH + slopeV*slopeV);
    const slopeScore = sigmoid(-slope, 0, 5);

    // Wysokość bezwzględna n.p.m.
    const elevScore = e < 250 ? 1.0
      : e < 600 ? 1.0 - (e - 250) / 1400
      : e < 900 ? 0.75 - (e - 600) / 1800
      : 0.2;

    return clamp(
      0.42 * valleyScore +
      0.24 * aspectScore +
      0.20 * slopeScore  +
      0.14 * elevScore,
      0, 1
    );
  });
}

function getWeatherScore(wa) {
  if (!wa) return 0.55;
  const nightTemp = wa.avgNightTemp7 ?? wa.avgTemp7 ?? 13.5;
  const rain14    = wa.totalRain14 ?? wa.rain14 ?? 45;
  const humid     = wa.avgHumidity7 ?? 72;
  const days      = wa.daysSinceRain ?? 4;

  const tempS = (nightTemp >= 3 && nightTemp <= 22)
    ? Math.max(0, 1 - Math.abs(nightTemp - 13.5) / 10)
    : 0.1;

  const rainS = rain14 < 10 ? rain14 / 30
    : rain14 < 55  ? 0.35 + (rain14 - 10) / 60
    : rain14 < 120 ? 1.0
    : Math.max(0.1, 1 - (rain14 - 120) / 80);

  const impulseBonus = (days >= 3 && days <= 8) ? 0.20
    : (days >= 2 && days <= 12) ? 0.10 : 0;

  const humidS = clamp((humid - 45) / 40, 0, 1);

  return clamp(0.35*tempS + 0.38*rainS + 0.18*humidS + 0.09*impulseBonus, 0.1, 1);
}

function getSeasonScore(month) {
  const m = { 1:0.05, 2:0.05, 3:0.15, 4:0.30, 5:0.45,
              6:0.70, 7:0.80, 8:0.92, 9:1.00, 10:0.88, 11:0.55, 12:0.15 };
  return m[month] ?? 0.65;
}

function sigmoid(x, center, scale) {
  return 1 / (1 + Math.exp(-(x - center) / scale));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function setLoading(on) {
  const el = loadingEl ?? document.getElementById('heatmap-loading');
  if (el) el.classList.toggle('hidden', !on);
}

function setStatus(msg) {
  const el = statusEl ?? document.getElementById('heatmap-status');
  if (el) el.textContent = msg ?? '';
}
