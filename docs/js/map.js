/**
 * map.js
 * Moduł mapy — Leaflet.js z warstwami WMS Lasów Państwowych
 */

let map = null;
let userMarker = null;
let accuracyCircle = null;
let forestBoundaryLayer = null;
let wmsLayer = null;
let pinMarker = null;        // marker ręcznie wybranego punktu
let pinModeActive = false;  // czy tryb kliknij-na-mapę jest włączony
let onMapClickCb = null;    // callback(lat, lng) przy kliknięciu

const WMS_BDL_URL = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL_Mapa_turystyczna/MapServer/WMSServer';
const WMS_DRZEWOSTANY = 'https://mapserver.bdl.lasy.gov.pl/ArcGIS/services/WMS_BDL_Drzewostany/MapServer/WMSServer';

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

  // Obsługa kliknięcia mapy (tryb pinezki / próbnik)
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setPin(lat, lng);
    onMapClickCb?.(lat, lng);
  });

  return map;  // ← zwróć instancję (potrzebne przez heatmap.js)
}

/**
 * Dodaj warstwę WMS drzewostanów
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
 * Przełącz widoczność warstwy drzewostanów
 */
export function toggleForestLayer(visible) {
  if (!map || !wmsLayer) return;
  if (visible) map.addLayer(wmsLayer);
  else map.removeLayer(wmsLayer);
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
