/**
 * weather.js
 * Moduł pogodowy — Open-Meteo API (darmowe, bez klucza)
 * - Historia 14 dni (archive API)
 * - Prognoza 7 dni (forecast API)
 * - Dane: opady, temperatura, wilgotność gleby
 */

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL  = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * Główna funkcja: pobierz kompletne dane pogodowe
 * @returns {Object} { current, history14d, forecast7d, analysis }
 */
export async function getWeatherData(lat, lng) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);

  const fmt = d => d.toISOString().split('T')[0];

  // Równolegle: historia + prognoza
  const [history, forecast] = await Promise.allSettled([
    fetchHistory(lat, lng, fmt(twoWeeksAgo), fmt(yesterday)),
    fetchForecast(lat, lng),
  ]);

  const histData = history.status === 'fulfilled' ? history.value : null;
  const foreData = forecast.status === 'fulfilled' ? forecast.value : null;

  // Analiza danych
  const analysis = histData ? analyzeWeather(histData, foreData) : null;

  return {
    current: foreData?.current || null,
    history14d: histData,
    forecast7d: foreData?.daily || null,
    analysis,
  };
}

/**
 * Pobierz historię pogody (14 dni wstecz)
 */
async function fetchHistory(lat, lng, startDate, endDate) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    start_date: startDate,
    end_date: endDate,
    daily: [
      'precipitation_sum',
      'temperature_2m_max',
      'temperature_2m_min',
      'relative_humidity_2m_mean',
      'soil_moisture_0_to_7cm_mean',
      'et0_fao_evapotranspiration',
    ].join(','),
    timezone: 'Europe/Warsaw',
  });

  const res = await fetch(`${ARCHIVE_URL}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Weather history HTTP ${res.status}`);
  return res.json();
}

/**
 * Pobierz prognozę pogody (7 dni + aktualne warunki)
 */
async function fetchForecast(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: [
      'precipitation_sum',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ].join(','),
    current_weather: true,
    hourly: 'soil_moisture_0_to_7cm',
    forecast_days: 7,
    past_days: 2,
    timezone: 'Europe/Warsaw',
  });

  const res = await fetch(`${FORECAST_URL}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Weather forecast HTTP ${res.status}`);
  return res.json();
}

/**
 * Analizuj dane pogodowe pod kątem grzybobrania
 * Zwraca kompletny zestaw metryk używanych przez scoring.js v2
 */
function analyzeWeather(history, forecast) {
  const daily = history.daily;
  if (!daily) return null;

  const rain      = daily.precipitation_sum           || [];
  const tempMax   = daily.temperature_2m_max          || [];
  const tempMin   = daily.temperature_2m_min          || [];
  const humidity  = daily.relative_humidity_2m_mean   || [];
  const soil      = daily.soil_moisture_0_to_7cm_mean || [];
  const n = rain.length; // liczba dni historii (max 14)

  // ── Sumy opadów ─────────────────────────────────────────────
  const totalRain14 = rain.reduce((s, v) => s + (v || 0), 0);
  const totalRain7  = rain.slice(-7).reduce((s, v) => s + (v || 0), 0);
  const totalRain3  = rain.slice(-3).reduce((s, v) => s + (v || 0), 0);

  // Opady wg okna: rainByDay[1] = opady wczoraj, [2] = przedwczoraj, itd.
  const rainByDay = {};
  for (let d = 1; d <= n; d++) {
    rainByDay[d] = rain[n - d] ?? 0;
  }

  // Ile dni minęło od ostatniego deszczu ≥ 2mm
  let daysSinceRain = -1;
  for (let i = n - 1; i >= 0; i--) {
    if ((rain[i] || 0) >= 2) { daysSinceRain = n - 1 - i; break; }
  }

  // Suma opadów w "oknach wzrostu" — 4-10 dni temu (grzyby dojrzewają)
  const rainImpulse4to10 = rain.slice(-10, -3).reduce((s, v) => s + (v || 0), 0);
  const rainImpulse2to3  = rain.slice(-3, -1).reduce((s, v) => s + (v || 0), 0);

  // ── Temperatury ─────────────────────────────────────────────
  // Nocne (min) — kluczowe dla grzybów (Tmin ≈ temperatura gruntu)
  const avgNightTemp7  = avg(tempMin.slice(-7));
  const avgNightTemp14 = avg(tempMin);
  const avgDayTemp7    = avg(tempMax.slice(-7));
  // Klasyczna średnia dobowa
  const avgTemp7  = (avg(tempMax.slice(-7)) + avg(tempMin.slice(-7))) / 2;
  const avgTemp14 = (avg(tempMax) + avg(tempMin)) / 2;

  // Ekstrema
  const hotDays7    = tempMax.slice(-7).filter(t => t > 28).length;
  const coldNights7 = tempMin.slice(-7).filter(t => t < 5).length;

  // ── Wilgotność powietrza ─────────────────────────────────────
  const avgHumidity7  = avg(humidity.slice(-7));
  const avgHumidity14 = avg(humidity);

  // ── Wilgotność gleby ─────────────────────────────────────────
  const avgSoilMoisture = avg(soil.filter(v => v !== null));

  // ── Susza ────────────────────────────────────────────────────
  let droughtDays = 0;
  for (let i = n - 1; i >= 0; i--) {
    if ((rain[i] || 0) < 1) droughtDays++;
    else break;
  }

  return {
    // Kompatybilne z poprzednią wersją
    rain14: totalRain14, rain7: totalRain7, rain3: totalRain3,
    rain4to10: rainImpulse4to10, rain2to3: rainImpulse2to3,
    avgTemp7: round1(avgTemp7), avgTempMax7: round1(avgDayTemp7),
    avgTempMin7: round1(avgNightTemp7), droughtDays, lastRainDaysAgo: daysSinceRain,
    avgSoilMoisture, hotDays7, coldNights7,
    currentTemp: forecast?.current_weather?.temperature ?? null,
    currentWeatherCode: forecast?.current_weather?.weathercode ?? null,

    // Nowe pola dla scoring.js v2
    totalRain14, totalPrecip14: totalRain14,
    avgNightTemp7:  round1(avgNightTemp7),
    avgNightTemp14: round1(avgNightTemp14),
    avgTemp14:      round1(avgTemp14),
    avgHumidity7:   round1(avgHumidity7),
    avgHumidity14:  round1(avgHumidity14),
    rainByDay,       // {1: mm, 2: mm, ...} — do okna impulsowego
    daysSinceRain,   // dni temu ostatni deszcz ≥2mm (-1 jeśli brak)
  };
}

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function round1(v) { return Math.round(v * 10) / 10; }


/**
 * Konwertuj kod WMO na opis pogody
 */
export function weatherCodeToText(code) {
  const codes = {
    0: 'Bezchmurnie', 1: 'Głównie czyste', 2: 'Częściowe zachmurzenie', 3: 'Zachmurzenie',
    45: 'Mgła', 48: 'Mgła oszraniająca',
    51: 'Mżawka słaba', 53: 'Mżawka', 55: 'Mżawka silna',
    61: 'Deszcz słaby', 63: 'Deszcz', 65: 'Deszcz ulewny',
    71: 'Śnieg słaby', 73: 'Śnieg', 75: 'Śnieg intensywny',
    80: 'Przelotny deszcz', 81: 'Przelotne opady', 82: 'Gwałtowna ulewa',
    95: 'Burza', 96: 'Burza z gradem', 99: 'Silna burza z gradem',
  };
  return codes[code] || 'Nieznana pogoda';
}

export function weatherCodeToIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  return '⛈️';
}
