/**
 * location.js
 * Moduł lokalizacji GPS — watchPosition z debounce i obsługą błędów
 */

let watchId = null;
let lastLat = null;
let lastLng = null;
const MIN_DISTANCE_M = 30; // minimalne przesunięcie do odświeżenia danych (metry)

/**
 * Oblicz odległość między dwoma punktami GPS (Haversine)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Rozpocznij śledzenie lokalizacji
 * @param {Function} onUpdate - callback(lat, lng, accuracy)
 * @param {Function} onError  - callback(errorCode, message)
 * @param {Function} onFirst  - callback gdy pierwsza lokalizacja dostępna
 */
export function startTracking(onUpdate, onError, onFirst) {
  if (!navigator.geolocation) {
    onError?.(0, 'Twoja przeglądarka nie obsługuje geolokalizacji.');
    return;
  }

  let firstFix = true;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      if (firstFix) {
        firstFix = false;
        lastLat = lat;
        lastLng = lng;
        onFirst?.(lat, lng, accuracy);
        onUpdate?.(lat, lng, accuracy);
        return;
      }

      // Filtruj małe ruchy
      const dist = haversineDistance(lastLat, lastLng, lat, lng);
      if (dist < MIN_DISTANCE_M) return;

      lastLat = lat;
      lastLng = lng;
      onUpdate?.(lat, lng, accuracy);
    },
    (err) => {
      const msgs = {
        1: 'Brak zgody na dostęp do lokalizacji. Włącz w ustawieniach.',
        2: 'Lokalizacja niedostępna. Sprawdź GPS.',
        3: 'Przekroczono czas oczekiwania na lokalizację.',
      };
      onError?.(err.code, msgs[err.code] || err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15000,    // akceptuj dane max 15s stare
      timeout: 20000,       // czekaj max 20s
    }
  );
}

/**
 * Pobierz jednorazowo aktualną lokalizację
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

/**
 * Zatrzymaj śledzenie
 */
export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/**
 * Czy GPS jest aktywne
 */
export function isTracking() {
  return watchId !== null;
}
