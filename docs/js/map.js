/**
 * map.js
 * Moduł mapy — Leaflet.js z warstwami WMS Lasów Państwowych
 */

let map = null;
let userMarker = null;
let accuracyCircle = null;
let forestBoundaryLayer = null;
let wmsLayer = null;
let forestTypeGeoJSONLayer = null;  // nakładka GeoJSON typów drzewostanu
let trailsLayer = null;             // nakładka WMS szlaków turystycznych LP
let pinMarker = null;        // marker ręcznie wybranego punktu
let pinModeActive = false;  // czy tryb kliknij-na-mapę jest włączony
let onMapClickCb = null;    // callback(lat, lng) przy kliknięciu

// Stan nakładki szlaków
let _showTrails = false;

// Stan nakładek typów lasu
let _showDeciduous = false;
let _showConiferous = false;
let _forestTypeLoading = false;

const WMS_BDL_URL = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL_Mapa_turystyczna/MapServer/WMSServer';
const WMS_DRZEWOSTANY = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL_Drzewostany/MapServer/WMSServer';
const OGC_BASE = 'https://ogcapi.bdl.lasy.gov.pl/collections';

// Kolekcje RDLP z zasięgami (bbox WGS84)
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

// Gatunki iglaste i liściaste LP
const CONIFEROUS_CODES = new Set([
  'So','Sw','Jd','Md','Sb','Dgl','Kos','Cis','So','Lad','Ak',
]);
const DECIDUOUS_CODES = new Set([
  'Db','Dbcz','Bk','Gb','Brz','Lp','Js','Kl','Ol','Os','Tp','Wz','Lsz',
  'Czm','Wis','Grb','Rob',
]);

/**
 * Określ typ dominującego gatunku na podstawie kodu LP
 * Zwraca: 'coniferous' | 'deciduous' | 'mixed' | 'unknown'
 */
function getPrimaryForestType(speciesCode) {
  if (!speciesCode) return 'unknown';

  let dominantCode = '';
  let dominantPct = 0;

  // Format "6So4Db2Bk"
  const withNums = speciesCode.match(/(\d+)([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*)/g);
  if (withNums?.length) {
    for (const m of withNums) {
      const pct  = parseInt(m.match(/^(\d+)/)?.[1] || '0', 10);
      const raw  = m.replace(/^\d+/, '');
      const code = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      if (pct > dominantPct) { dominantPct = pct; dominantCode = code; }
    }
  } else {
    // Format prosty: "SO" lub "SO DB"
    const raw = speciesCode.trim().split(/\s+/)[0];
    dominantCode = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }

  if (CONIFEROUS_CODES.has(dominantCode)) return 'coniferous';
  if (DECIDUOUS_CODES.has(dominantCode))  return 'deciduous';
  return 'mixed';
}

/**
 * Styl GeoJSON dla wydzielenia wg typu lasu
 */
function forestTypeStyle(feature) {
  const code = feature.properties?.species_cd || '';
  const type = getPrimaryForestType(code);

  const visible =
    (type === 'deciduous'  && _showDeciduous) ||
    (type === 'coniferous' && _showConiferous) ||
    (type === 'mixed'      && (_showDeciduous || _showConiferous));

  if (!visible) return { opacity: 0, fillOpacity: 0, weight: 0 };

  const palette = {
    deciduous:  { color: '#86ef64', fill: '#86ef64', fo: 0.30 },
    coniferous: { color: '#38bdf8', fill: '#38bdf8', fo: 0.30 },
    mixed:      { color: '#c084fc', fill: '#c084fc', fo: 0.22 },
  };
  const p = palette[type] || palette.mixed;
  return {
    color:       p.color,
    weight:      1.2,
    opacity:     0.7,
    fillColor:   p.fill,
    fillOpacity: p.fo,
  };
}

/**
 * Pobierz wydzielenia leśne z OGC API dla aktualnego widoku mapy
 */
async function fetchFeaturesForView() {
  if (!map) return [];
  if (map.getZoom() < 11) return [];   // zbyt duży obszar

  const b = map.getBounds();
  const bbox = `${b.getWest().toFixed(5)},${b.getSouth().toFixed(5)},${b.getEast().toFixed(5)},${b.getNorth().toFixed(5)}`;

  // Wybierz kolekcje nachodzące na widok
  const applicable = RDLP_COLLECTIONS.filter(r =>
    b.getNorth() >= r.minLat && b.getSouth() <= r.maxLat &&
    b.getEast()  >= r.minLng && b.getWest()  <= r.maxLng
  );

  if (!applicable.length) return [];

  const allFeatures = [];
  await Promise.all(applicable.map(async col => {
    try {
      const url = `${OGC_BASE}/${col.id}/items?f=json&bbox=${bbox}&limit=300`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.features?.length) allFeatures.push(...data.features);
    } catch (e) {
      console.warn('[Map] ForestType fetch error:', e.message);
    }
  }));

  return allFeatures;
}

/**
 * Odśwież warstwę GeoJSON typów lasu
 */
export async function refreshForestTypeOverlay() {
  if (!map) return;
  if (!_showDeciduous && !_showConiferous) {
    if (forestTypeGeoJSONLayer) {
      map.removeLayer(forestTypeGeoJSONLayer);
      forestTypeGeoJSONLayer = null;
    }
    return;
  }

  if (_forestTypeLoading) return;
  _forestTypeLoading = true;

  try {
    const features = await fetchFeaturesForView();

    // Usuń poprzednią warstwę
    if (forestTypeGeoJSONLayer) {
      map.removeLayer(forestTypeGeoJSONLayer);
      forestTypeGeoJSONLayer = null;
    }

    if (!features.length) return;

    forestTypeGeoJSONLayer = L.geoJSON(features, {
      style: forestTypeStyle,
      onEachFeature: (feature, layer) => {
        const code = feature.properties?.species_cd || '?';
        const type = getPrimaryForestType(code);
        const typeLabel = type === 'deciduous' ? '🌳 Liściasty'
                        : type === 'coniferous' ? '🌲 Iglasty'
                        : '🌿 Mieszany';
        layer.bindTooltip(
          `<strong>${typeLabel}</strong><br><span style="font-size:11px;opacity:.8">${code}</span>`,
          { sticky: true, className: 'forest-type-tooltip' }
        );
      },
    }).addTo(map);

  } catch (e) {
    console.error('[Map] refreshForestTypeOverlay error:', e);
  } finally {
    _forestTypeLoading = false;
  }
}

/**
 * Inicjalizuj mapę Leaflet
 */
export function initMap(containerId = 'map') {
  map = L.map(containerId, {
    center: [52.0, 19.5],
    zoom: 7,
    zoomControl: false,
    attributionControl: true,
  });

  // Przyciski zoom — prawym dolnym
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Warstwa bazowa: OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Warstwa WMS — Drzewostany LP (nakładka z typem drzewostanu)
  addForestWMSLayer();

  // Odśwież nakładkę typów lasu po zakończeniu przesuwania/zoomowania
  map.on('moveend', () => {
    if (_showDeciduous || _showConiferous) {
      refreshForestTypeOverlay();
    }
  });

  // Obsługa kliknięcia mapy (tryb pinezki / próbnik)
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setPin(lat, lng);
    onMapClickCb?.(lat, lng);
  });

  return map;  // ← zwróć instancję (potrzebne przez heatmap.js)
}

/**
 * Dodaj warstwę WMS drzewostanów (ogólna)
 */
function addForestWMSLayer() {
  try {
    wmsLayer = L.tileLayer.wms(WMS_DRZEWOSTANY, {
      layers: '0',
      format: 'image/png',
      transparent: true,
      opacity: 0.55,
      attribution: '© Lasy Państwowe BDL',
      maxZoom: 19,
    }).addTo(map);
  } catch (e) {
    console.warn('[Map] WMS layer failed:', e);
  }
}

const WMS_BDL_ODDZIALY = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL/MapServer/WMSServer';

/**
 * Utwórz kompletną warstwę leśnych ścieżek i tras:
 *  1. Linie oddziałowe i podział powierzchniowy LP (BDL warstwa 3) — dukty, drogi leśne i numery oddziałów
 *  2. Szlaki turystyczne i trasy piesze w lasach (Waymarked Trails) — znakowane szlaki PTTK (czerwone, niebieskie, itp.)
 *  3. Ścieżki dydaktyczne i konne LP (BDL Mapa Turystyczna)
 */
function createTrailsWMSLayer() {
  const oddzialyLayer = L.tileLayer.wms(WMS_BDL_ODDZIALY, {
    layers: '3',
    format: 'image/png',
    transparent: true,
    opacity: 0.85,
    attribution: '© Lasy Państwowe BDL (Oddziały)',
    maxZoom: 19,
    version: '1.3.0',
  });

  const hikingLayer = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18,
    opacity: 0.95,
    attribution: '© Waymarked Trails (Szlaki PTTK)',
  });

  const turystykaLayer = L.tileLayer.wms(WMS_BDL_URL, {
    layers: '19,20,21',
    format: 'image/png',
    transparent: true,
    opacity: 0.85,
    attribution: '© Lasy Państwowe BDL (Turystyka)',
    maxZoom: 19,
    version: '1.3.0',
  });

  return L.layerGroup([oddzialyLayer, hikingLayer, turystykaLayer]);
}

/**
 * Przełącz widoczność warstwy szlaków turystycznych LP
 */
export function toggleTrailsLayer(visible) {
  _showTrails = visible;
  if (!map) return;

  if (visible) {
    if (!trailsLayer) {
      trailsLayer = createTrailsWMSLayer();
    }
    if (!map.hasLayer(trailsLayer)) {
      trailsLayer.addTo(map);
    }
  } else {
    if (trailsLayer && map.hasLayer(trailsLayer)) {
      map.removeLayer(trailsLayer);
    }
  }
}

/**
 * Czy warstwa szlaków jest aktualnie widoczna
 */
export function isTrailsVisible() {
  return _showTrails;
}


/**
 * Zaktualizuj pozycję użytkownika na mapie
 */
export function updateUserPosition(lat, lng, accuracy, panTo = false) {
  if (!map) return;

  // Pulsujący marker użytkownika
  if (!userMarker) {
    const pulseIcon = L.divIcon({
      className: '',
      html: `<div class="user-marker"><div class="user-marker-pulse"></div><div class="user-marker-dot"></div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    userMarker = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  // Okrąg dokładności
  if (!accuracyCircle) {
    accuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4',
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
  }

  if (panTo) {
    map.setView([lat, lng], Math.min(map.getZoom() < 14 ? 15 : map.getZoom(), 17), {
      animate: true, duration: 0.8,
    });
  }
}

/**
 * Narysuj granicę wydzielenia leśnego
 */
export function showForestBoundary(geojsonFeature) {
  if (!map) return;

  if (forestBoundaryLayer) {
    map.removeLayer(forestBoundaryLayer);
    forestBoundaryLayer = null;
  }

  if (!geojsonFeature) return;

  forestBoundaryLayer = L.geoJSON(geojsonFeature, {
    style: {
      color: '#4ade80',
      weight: 2.5,
      fillColor: '#4ade80',
      fillOpacity: 0.08,
      dashArray: '6 4',
    },
  }).addTo(map);
}

/**
 * Centruj mapę na pozycji
 */
export function panTo(lat, lng, zoom = 15) {
  map?.setView([lat, lng], zoom, { animate: true, duration: 0.8 });
}

/**
 * Pobierz mapę
 */
export function getMap() { return map; }

/**
 * Przełącz widoczność warstwy drzewostanów WMS
 */
export function toggleForestLayer(visible) {
  if (!map || !wmsLayer) return;
  if (visible) map.addLayer(wmsLayer);
  else map.removeLayer(wmsLayer);
}

/**
 * Przełącz nakładkę lasów liściastych
 */
export async function toggleDeciduousLayer(visible) {
  _showDeciduous = visible;
  await refreshForestTypeOverlay();
}

/**
 * Przełącz nakładkę lasów iglastych
 */
export async function toggleConiferousLayer(visible) {
  _showConiferous = visible;
  await refreshForestTypeOverlay();
}

/**
 * Włącz/wyłącz tryb kliknij-na-mapę (pinezka)
 * @param {boolean} active
 * @param {Function} onClick - callback(lat, lng)
 */
export function setPinMode(active, onClick) {
  pinModeActive = active;
  onMapClickCb = onClick || null;

  if (map) {
    map.getContainer().style.cursor = active ? 'crosshair' : '';
  }

  // Usuń pin gdy wyłączamy tryb
  if (!active) removePin();
}

/**
 * Ustaw pinezkę w danym punkcie (bez trybu kliknięcia)
 */
export function setPin(lat, lng) {
  if (!map) return;

  const pinIcon = L.divIcon({
    className: 'custom-pin-container',
    html: `
      <div class="pin-marker-wrapper">
        <div class="pin-badge-label">📌 Próbnik</div>
        <div class="pin-marker-head">📍</div>
        <div class="pin-marker-pulse"></div>
      </div>`,
    iconSize: [80, 52],
    iconAnchor: [40, 50],
  });

  if (!pinMarker) {
    pinMarker = L.marker([lat, lng], {
      icon: pinIcon,
      draggable: true,
      zIndexOffset: 2000,
    }).addTo(map);

    pinMarker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const pos = e.target.getLatLng();
      onMapClickCb?.(pos.lat, pos.lng);
    });

    pinMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      onMapClickCb?.(pos.lat, pos.lng);
    });
  } else {
    pinMarker.setLatLng([lat, lng]);
  }
}

/**
 * Usuń pinezkę
 */
export function removePin() {
  if (pinMarker && map) {
    map.removeLayer(pinMarker);
    pinMarker = null;
  }
}

/**
 * Czy tryb pinezki jest aktywny
 */
export function isPinModeActive() {
  return pinModeActive;
}
