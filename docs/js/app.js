/**
 * app.js
 * Główny moduł aplikacji GrzyboMapa
 * Integruje: GPS, OGC API LP, pogoda, scoring, UI
 */

import { startTracking, getCurrentPosition, stopTracking } from './location.js';
import { getForestData, getForestBoundary } from './forest_api.js';
import { getWeatherData, weatherCodeToText, weatherCodeToIcon } from './weather.js';
import { getMushroomsForStand, getMushroomsForMixedForest, filterBySeason, TREE_SPECIES } from './mushroom_knowledge.js';
import { scoreAllMushrooms, calculateOverallScore, calculateDailyForecastScores, generateSummary, generateDetailedDiagnosis, edibleLabel, scoreToColor, scoreToLabel } from './scoring.js';
import { initMap, updateUserPosition, showForestBoundary, panTo, setPinMode, setPin, removePin, isPinModeActive, toggleDeciduousLayer, toggleConiferousLayer, toggleTrailsLayer, isTrailsVisible } from './map.js';
import { initHeatmap, updateHeatmap, toggleHeatmap, isHeatmapVisible, setHeatmapCenter } from './heatmap.js?v=5.0';

// ── Stan aplikacji ─────────────────────────────────────────────────
const state = {
  lat: null,
  lng: null,
  accuracy: null,
  forestData: null,
  weatherData: null,
  forecastAnalysis: null,
  mushroomList: [],
  overallScore: 0,
  summary: null,
  diagnosis: [],
  isLoading: false,
  panelOpen: false,
  isTracking: false,
  pinMode: false,       // czy tryb ręcznego wyboru punktu
  pinLat: null,         // współrzędne wybranego pinu
  pinLng: null,
};

// ── Elementy UI ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Inicjalizacja ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Inicjalizacja mapy
  const leafletMap = initMap('map');

  // Inicjalizacja heatmapy (po załadowaniu Leaflet.heat z CDN)
  initHeatmap(leafletMap);

  // Bindowania przycisków
  $('btn-locate').addEventListener('click', onLocateClick);
  $('btn-pin-mode').addEventListener('click', onPinModeClick);
  $('fab-panel').addEventListener('click', togglePanel);
  $('btn-panel-toggle').addEventListener('click', closePanel);
  $('panel-backdrop').addEventListener('click', closePanel);
  $('btn-refresh').addEventListener('click', () => {
    const lat = state.pinMode ? state.pinLat : state.lat;
    const lng = state.pinMode ? state.pinLng : state.lng;
    loadAllData(lat, lng);
  });
  $('btn-layer-toggle').addEventListener('click', onLayerToggle);
  $('btn-heatmap').addEventListener('click', onHeatmapToggle);
  $('btn-deciduous').addEventListener('click', onDeciduousToggle);
  $('btn-coniferous').addEventListener('click', onConiferousToggle);
  $('btn-trails').addEventListener('click', onTrailsToggle);

  // Sprawdź czy Geolocation jest dostępne
  if (!navigator.geolocation) {
    showError('Twoje urządzenie nie obsługuje GPS.');
  }

  // Splash — ukryj po chwili
  setTimeout(() => {
    $('splash')?.classList.add('hidden');
  }, 1800);

  // Uruchom od razu próbnik terenu — pinezka natychmiast pojawia się na mapie!
  activatePinMode();
});

// ── Kliknięcie Lokalizuj ───────────────────────────────────────────
// ── Kliknięcie Lokalizuj (GPS Na Żywo) ─────────────────────────────
async function onLocateClick() {
  // Wyłącz tryb próbkowania/pinezki jeśli był aktywny
  if (state.pinMode) {
    deactivatePinMode();
  }

  if (state.isTracking && state.mode === 'gps') {
    // Już śledzimy na żywo — wycentruj mapę na użytkowniku
    if (state.lat) panTo(state.lat, state.lng, 16);
    return;
  }

  state.mode = 'gps';
  stopTracking();
  removePin();

  $('btn-locate').classList.add('loading');
  setStatus('Pobieranie lokalizacji GPS…', 'info');

  try {
    const pos = await getCurrentPosition();
    state.lat = pos.lat;
    state.lng = pos.lng;
    state.accuracy = pos.accuracy;
    state.isTracking = true;

    updateUserPosition(pos.lat, pos.lng, pos.accuracy, true);
    $('btn-locate').classList.remove('loading');
    $('btn-locate').classList.add('active');

    updatePanelSource('gps', pos.lat, pos.lng);
    await loadAllData(pos.lat, pos.lng);
  } catch (e) {
    $('btn-locate').classList.remove('loading');
    showError(getGpsError(e));
    return;
  }

  // Ciągłe śledzenie na żywo
  startTracking(
    async (lat, lng, accuracy) => {
      // Wykonaj odświeżenie tylko jeśli nadal jesteśmy w trybie GPS
      if (state.mode !== 'gps') return;
      state.lat = lat; state.lng = lng; state.accuracy = accuracy;
      updateUserPosition(lat, lng, accuracy, false);
      await loadAllData(lat, lng);
    },
    (code, msg) => {
      if (state.mode === 'gps') showError(msg);
    },
  );
}

// ── Tryb Próbnika (Kliknij na mapę) ────────────────────────────────
function onPinModeClick() {
  if (state.pinMode) {
    deactivatePinMode();
  } else {
    activatePinMode();
  }
}

function activatePinMode() {
  state.pinMode = true;
  state.mode = 'pin';

  // ZATRZYMAJ GPS — śledzenie GPS nie może nadpisywać próbnika ręcznego!
  stopTracking();
  state.isTracking = false;

  $('btn-pin-mode').classList.add('active');
  $('btn-locate').classList.remove('active');
  $('btn-locate').classList.remove('loading');
  $('pin-hint').classList.remove('hidden');

  // Włącz ciągłe bindowanie kliknięć i przeciągnięć mapy (Próbnik)
  setPinMode(true, async (lat, lng) => {
    state.pinLat = lat;
    state.pinLng = lng;
    updatePanelSource('pin', lat, lng);
    setHeatmapCenter(lat, lng);
    showPanel(true);
    await loadAllData(lat, lng);
  });

  // Użyj istniejącego pinu lub natychmiast postaw pinezkę w centrum widoku mapy
  if (!state.pinLat || !state.pinLng) {
    const mapObj = getMap();
    if (mapObj) {
      const c = mapObj.getCenter();
      state.pinLat = c.lat;
      state.pinLng = c.lng;
    }
  }

  if (state.pinLat && state.pinLng) {
    setPin(state.pinLat, state.pinLng);
    updatePanelSource('pin', state.pinLat, state.pinLng);
    setHeatmapCenter(state.pinLat, state.pinLng);
    loadAllData(state.pinLat, state.pinLng);
  }
}

function deactivatePinMode() {
  state.pinMode = false;
  if (state.mode === 'pin') state.mode = null;

  $('btn-pin-mode').classList.remove('active');
  $('pin-hint').classList.add('hidden');
  setPinMode(false); // wyłącza kursor crosshair i robi removePin()
  setStatus('', '');

  if (state.lat && state.lng) {
    updatePanelSource('gps', state.lat, state.lng);
  }
}

/**
 * Aktualizuje tytuł i nagłówek panelu zależnie od trybu (GPS vs Próbnik)
 */
function updatePanelSource(source, lat, lng) {
  const titleEl = document.querySelector('.panel-title');
  if (!titleEl) return;

  if (source === 'pin' || state.pinMode) {
    const curLat = lat || state.pinLat;
    const curLng = lng || state.pinLng;
    const coordsStr = (curLat && curLng) ? `${curLat.toFixed(5)}, ${curLng.toFixed(5)}` : 'Wskaż punkt na mapie';
    titleEl.innerHTML = `📌 Próbnik Terenu
      <small style="font-size:11px;color:#fbbf24;font-weight:600;display:block;margin-top:2px">
        📍 Próbka: ${coordsStr}
      </small>`;
  } else {
    const curLat = lat || state.lat;
    const curLng = lng || state.lng;
    const coordsStr = (curLat && curLng) ? `${curLat.toFixed(5)}, ${curLng.toFixed(5)}` : '';
    titleEl.innerHTML = `📡 Analiza GPS (Na Żywo)
      <small style="font-size:11px;color:#60a5fa;font-weight:400;display:block;margin-top:2px">
        ${coordsStr ? `GPS: ${coordsStr}` : 'Lokalizacja na żywo'}
      </small>`;
  }
}

// ── Ładuj wszystkie dane ───────────────────────────────────────────
async function loadAllData(lat, lng) {
  if (!lat || !lng) return;
  if (state.isLoading) return;

  state.isLoading = true;
  showPanel(true);
  setStatus('Wykrywanie lasu…', 'info');
  renderLoading();

  try {
    // Równolegle: dane lasu + pogoda
    const [forestData, weatherData] = await Promise.allSettled([
      getForestData(lat, lng),
      getWeatherData(lat, lng),
    ]);

    state.forestData = forestData.status === 'fulfilled' ? forestData.value : null;
    state.weatherData = weatherData.status === 'fulfilled' ? weatherData.value : null;

    if (!state.forestData || state.forestData.isForest === false) {
      if (state.forestData?.terrainType === 'urban') {
        setStatus('Teren zabudowany / miasto — brak lasu i grzybów.', 'warn');
      } else if (state.forestData?.terrainType === 'water') {
        setStatus('Zbiornik / ciek wodny — brak lasu.', 'warn');
      } else {
        setStatus('Teren otwarty / łąka — brak lasu (wykluczono grzyby leśne).', 'warn');
      }
    }

    // Rysuj granicę wydzielenia — tylko jeśli rzeczywiście jesteśmy w lesie
    if (state.forestData?.isForest && state.forestData._feature) {
      showForestBoundary(state.forestData._feature);
    } else if (state.forestData?.isForest) {
      getForestBoundary(lat, lng).then(b => showForestBoundary(b));
    } else {
      showForestBoundary(null);
    }

    // Oblicz grzyby i scoring
    const month = new Date().getMonth() + 1;
    const f = state.forestData;
    const isForest = f ? f.isForest !== false : false;
    const terrainType = f?.terrainType || (isForest ? 'forest' : 'meadow');

    // Skład z procentami — jeśli mamy rawCode to parsujemy, inaczej równe udziały (tylko w lesie)
    let speciesWithPct = [];
    if (isForest) {
      if (f?.rawCode) {
        speciesWithPct = parseCompositionForScoring(f.rawCode, f.speciesCodes);
      } else if (f?.speciesCodes?.length) {
        const eqPct = Math.round(100 / f.speciesCodes.length);
        speciesWithPct = f.speciesCodes.map(c => ({ code: c, pct: eqPct }));
      }
    }

    const weatherAnalysis = state.weatherData?.analysis || null;
    const forestAge = f?.specAge ? parseInt(f.specAge, 10) : null;

    let mushrooms = getMushroomsForStand(speciesWithPct, f?.habitatCode, forestAge, isForest, terrainType);
    mushrooms = filterBySeason(mushrooms, month);

    state.mushroomList = scoreAllMushrooms(mushrooms, weatherAnalysis, month, state.forestData);
    state.overallScore = calculateOverallScore(weatherAnalysis, state.forestData);
    state.forecastAnalysis = calculateDailyForecastScores(state.weatherData, state.forestData);
    state.summary = generateSummary(
      state.overallScore,
      weatherAnalysis,
      f?.forestName,
      state.forestData
    );
    state.diagnosis = generateDetailedDiagnosis(
      state.overallScore,
      weatherAnalysis,
      state.forestData
    );

    renderAll();

    // Aktualizuj heatmapę — centrum + dane pogodowe
    setHeatmapCenter(lat, lng);
    updateHeatmap(weatherAnalysis, month);
    const statusEl = $('heatmap-status');
    if (statusEl && weatherAnalysis) {
      // status zostanie nadpisany przez heatmap.js po obliczeniu
    }

    setStatus('', '');

  } catch (e) {
    console.error('[App] loadAllData error:', e);
    setStatus('Błąd pobierania danych. Sprawdź połączenie.', 'error');
  } finally {
    state.isLoading = false;
  }
}

/**
 * Parsuj rawCode LP do tablicy z procentami dla scoringu
 * "6So4Db2Bk" → [{code:'So',pct:60},{code:'Db',pct:40},{code:'Bk',pct:20}]
 * "SO"        → [{code:'So',pct:100}]
 */
function parseCompositionForScoring(rawCode, speciesCodes) {
  if (!rawCode) {
    const n = speciesCodes?.length || 1;
    return (speciesCodes || []).map(c => ({ code: c, pct: Math.round(100 / n) }));
  }

  // Format z cyframi: "6So4Db"
  const withNums = rawCode.match(/(\d+)([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*)/g);
  if (withNums?.length) {
    return withNums.map(m => {
      const num  = parseInt(m.match(/^(\d+)/)?.[1] || '1', 10);
      const code = m.replace(/^\d+/, '');
      return {
        code: code.charAt(0).toUpperCase() + code.slice(1).toLowerCase(),
        pct: num * 10,
      };
    });
  }

  // Prosty kod: "SO" lub "SO DB" — równe udziały
  const parts = rawCode.trim().split(/\s+/);
  const eqPct = Math.round(100 / parts.length);
  return parts.map(p => ({
    code: p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    pct: eqPct,
  }));
}

// ── Renderowanie ───────────────────────────────────────────────────
function renderAll() {
  renderForestInfo();
  renderWeather();
  renderOverallScore();
  renderMushrooms();
}

function renderForestInfo() {
  const f = state.forestData;
  const infoEl = $('forest-info');

  if (!f) {
    infoEl.innerHTML = `
      <div class="forest-empty">
        <span class="forest-icon">🌿</span>
        <p>Nie jesteś w lesie państwowym lub brak zasięgu API.<br>
        <small>Dane LP dostępne tylko w lasach zarządzanych przez Lasy Państwowe.</small></p>
      </div>`;
    return;
  }

  const modeBadge = state.pinMode
    ? '<span class="badge badge-pin">📌 Próbka ręczna</span>'
    : '<span class="badge badge-gps">📡 GPS na żywo</span>';

  // Obsługa terenu niezalesionego (łąka / miasto / woda)
  if (f.isForest === false) {
    let terrainIcon = '🌾';
    let terrainName = 'Teren otwarty / Łąka';
    let terrainBadgeCls = 'badge-meadow';
    let terrainDesc = 'Brak drzew leśnych wyklucza grzyby mikoryzowe (borowiki, podgrzybki, maślaki, kurki, rydze). W tym miejscu rosnąć mogą wyłącznie wybrane saprotrofy łąkowe (np. pieczarki, czasznice, twardzioszki).';

    if (f.terrainType === 'urban') {
      terrainIcon = '🏙️';
      terrainName = 'Teren zurbanizowany / Zabudowa';
      terrainBadgeCls = 'badge-urban';
      terrainDesc = 'Gęsta zabudowa, drogi lub infrastruktura miejska. Brak naturalnego podłoża i warunków do występowania grzybów jadalnych.';
    } else if (f.terrainType === 'water') {
      terrainIcon = '💧';
      terrainName = 'Zbiornik / Ciek wodny';
      terrainBadgeCls = 'badge-water';
      terrainDesc = 'Akwen lub teren stale podmokły — brak warunków do wzrostu grzybów naziemnych.';
    }

    infoEl.innerHTML = `
      <div class="forest-header">
        <span class="forest-icon-big">${terrainIcon}</span>
        <div>
          <h2 class="forest-name">${f.forestName || terrainName}</h2>
          <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
            ${modeBadge}
            <span class="badge badge-nonforest">Teren niezalesiony</span>
            <span class="badge ${terrainBadgeCls}">${terrainName}</span>
          </div>
        </div>
      </div>
      <div class="nonforest-box">
        <strong>Status terenu:</strong> ${terrainDesc}
      </div>
    `;
    return;
  }

  const sourceBadge = (f.source === 'OGC_LP' || f.source === 'LP_WFS')
    ? '<span class="badge badge-lp">Lasy Państwowe</span>'
    : '<span class="badge badge-osm">OpenStreetMap</span>';

  const rdlpLabel = f.rdlp || f.nadlesnictwo || '';

  // Rozszyfrowuj skład gatunkowy
  const composition = decodeComposition(f.rawCode);
  const compositionHtml = composition.length
    ? composition.map(s => `
        <div class="species-row">
          <span class="species-pct">${s.pct !== null ? s.pct + '%' : ''}</span>
          <span class="species-bar-wrap"><span class="species-bar" style="width:${s.pct ?? 100}%"></span></span>
          <span class="species-name"><strong>${s.name}</strong> <em>${s.latin}</em></span>
        </div>`).join('')
    : `<p class="no-data" style="margin:0;font-size:12px">Brak danych o składzie</p>`;

  // Czytelny opis siedliska
  const habitatLabel = f.habitatCode
    ? `${f.habitatCode} — ${decodeHabitat(f.habitatCode)}`
    : null;

  infoEl.innerHTML = `
    <div class="forest-header">
      <span class="forest-icon-big">🌲</span>
      <div>
        <h2 class="forest-name">${f.forestName || 'Las Państwowy'}</h2>
        ${rdlpLabel ? `<p class="forest-sub">RDLP ${rdlpLabel}</p>` : ''}
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          ${modeBadge}
          ${sourceBadge}
        </div>
      </div>
    </div>
    <div class="composition-block">
      <div class="composition-label">Skład drzewostanu</div>
      ${compositionHtml}
    </div>
    <div class="forest-details">
      ${habitatLabel  ? `<div class="detail-chip" title="Typ siedliskowy lasu">🏷️ ${habitatLabel}</div>` : ''}
      ${f.specAge     ? `<div class="detail-chip">🌱 Wiek: <strong>${f.specAge}</strong></div>` : ''}
      ${f.area        ? `<div class="detail-chip">📐 ${f.area}</div>` : ''}
      ${f.adrFor      ? `<div class="detail-chip" title="Adres leśny">📌 ${f.adrFor.trim()}</div>` : ''}
    </div>
  `;
}

/**
 * Rozszyfruj kod składu gatunkowego LP
 * "6So4Db2Bk" → [{pct:60, name:'Sosna', latin:'Pinus sylvestris'}, ...]
 * "SO"         → [{pct:null, name:'Sosna', latin:'Pinus sylvestris'}]
 */
function decodeComposition(rawCode) {
  if (!rawCode) return [];

  // Format z cyframi: "6So4Db2Bk" — cyfra to dziesiąte części (6 = 60%)
  const withNums = rawCode.match(/(\d+)([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*)/g);
  if (withNums?.length) {
    return withNums.map(m => {
      const num  = parseInt(m.match(/^(\d+)/)?.[1] || '0', 10);
      const code = m.replace(/^\d+/, '');
      const norm = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
      const spec = TREE_SPECIES[norm];
      return {
        pct:   num * 10,
        code:  norm,
        name:  spec?.name  || norm,
        latin: spec?.latin || '',
      };
    });
  }

  // Prosty kod bez cyfr: "SO" lub "SO DB"
  const parts = rawCode.trim().split(/\s+/);
  return parts.map(p => {
    const norm = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    const spec = TREE_SPECIES[norm];
    return {
      pct:   null,
      code:  norm,
      name:  spec?.name  || norm,
      latin: spec?.latin || '',
    };
  });
}

/**
 * Rozszyfruj siedlisko LP na opis słowny
 */
function decodeHabitat(code) {
  const HABITATS = {
    'BŚW': 'Bór świeży', 'BSW': 'Bór świeży',
    'BW':  'Bór wilgotny', 'BB': 'Bór bagienny',
    'BMŚ': 'Bór mieszany świeży', 'BMŚW': 'Bór mieszany świeży',
    'BMW': 'Bór mieszany wilgotny', 'BMB': 'Bór mieszany bagienny',
    'LMŚ': 'Las mieszany świeży', 'LMŚW': 'Las mieszany świeży',
    'LMW': 'Las mieszany wilgotny', 'LMB': 'Las mieszany bagienny',
    'LŚW': 'Las świeży', 'LW': 'Las wilgotny',
    'LL':  'Las łęgowy', 'LŁ': 'Las łęgowy',
    'OL':  'Ols', 'OLJ': 'Ols jesionowy',
    'BR':  'Bór chrobotkowy', 'BS': 'Bór suchy',
  };
  const key = (code || '').toUpperCase().replace(/\s/g, '');
  return HABITATS[key] || code;
}


function renderWeather() {
  const w = state.weatherData;
  const el = $('weather-info');

  if (!w?.current && !w?.analysis) {
    el.innerHTML = `<p class="no-data">Brak danych pogodowych</p>`;
    return;
  }

  const cur = w.current;
  const a = w.analysis;
  const fa = state.forecastAnalysis;

  let forecastHtml = '';
  if (fa?.days?.length) {
    const daysCards = fa.days.map(d => {
      const color = scoreToColor(d.score);
      const icon = weatherCodeToIcon(d.code);
      const rainLabel = d.rain > 0 ? `💧 ${d.rain} mm` : (d.prob > 20 ? `💧 ${d.prob}%` : '—');
      const trendBadge = d.trend === 'up'
        ? '<span class="f-trend up" title="Wzrost szans">📈 +</span>'
        : (d.trend === 'down' ? '<span class="f-trend down" title="Spadek">📉 -</span>' : '');

      return `
        <div class="f-day-card ${d.score >= 70 ? 'f-day-peak' : ''}">
          <div class="f-day-name">${d.dayName}</div>
          <div class="f-day-date">${d.dayDate}</div>
          <div class="f-day-icon">${icon}</div>
          <div class="f-day-temps">
            <span class="f-tmax">${d.tMax}°</span>
            <span class="f-tmin">${d.tMin}°</span>
          </div>
          <div class="f-day-rain">${rainLabel}</div>
          <div class="f-score-wrap">
            <span class="f-score-val" style="color:${color}">🍄 ${d.score}%</span>
            ${trendBadge}
          </div>
          <div class="f-mini-bar">
            <div class="f-mini-fill" style="width:${Math.max(d.score, 4)}%;background:${color}"></div>
          </div>
        </div>
      `;
    }).join('');

    forecastHtml = `
      <div class="weather-forecast-block">
        <div class="forecast-header">
          <div>
            <div class="forecast-title">📅 Prognoza 7-dniowa & Szanse na grzyby</div>
            <div class="forecast-sub">Model wzrostu grzybni: opad × bilans wilgoci × temperatura</div>
          </div>
        </div>
        <div class="forecast-scroll-row">
          ${daysCards}
        </div>
        ${fa.tacticalTip ? `
          <div class="forecast-tactical-tip">
            ${fa.tacticalTip}
          </div>
        ` : ''}
      </div>
    `;
  }

  el.innerHTML = `
    <div class="weather-grid">
      <div class="weather-item weather-current">
        <span class="weather-icon-big">${cur ? weatherCodeToIcon(cur.weathercode) : '🌡️'}</span>
        <div>
          <div class="temp-big">${cur ? `${Math.round(cur.temperature)}°C` : '—'}</div>
          <div class="weather-desc">${cur ? weatherCodeToText(cur.weathercode) : 'Brak danych'}</div>
        </div>
      </div>
      ${a ? `
        <div class="weather-stats">
          <div class="w-stat">
            <span class="w-stat-label">Deszcz 14 dni</span>
            <span class="w-stat-value rain">${Math.round(a.rain14)} mm</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">Śr. temperatura</span>
            <span class="w-stat-value">${a.avgTemp7}°C</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">Ostatni deszcz</span>
            <span class="w-stat-value">${a.lastRainDaysAgo >= 0 ? `${a.lastRainDaysAgo} dni temu` : 'Dziś'}</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">Susza</span>
            <span class="w-stat-value ${a.droughtDays >= 5 ? 'warn' : ''}">${a.droughtDays} dni</span>
          </div>
        </div>
      ` : ''}
    </div>
    ${forecastHtml}
  `;
}

function renderOverallScore() {
  const s = state.summary;
  const score = state.overallScore;
  const color = scoreToColor(score);

  $('overall-score').textContent = `${score}%`;
  $('score-label').textContent = scoreToLabel(score);
  $('score-emoji').textContent = score >= 65 ? '🍄' : score >= 40 ? '🌿' : score >= 20 ? '🍂' : '🌵';
  // summary.main i summary.tip (nowy format)
  const mainText = s?.main || s?.text || '';
  $('summary-text').textContent = mainText;

  // Wskazówka (tip)
  const tipEl = $('summary-tip');
  if (tipEl) tipEl.textContent = s?.tip || '';

  // Pasek progresu
  const bar = $('score-bar-fill');
  if (bar) { bar.style.width = `${score}%`; bar.style.background = color; }

  // Szczegółowa diagnoza czynników
  const diagEl = $('score-diagnosis');
  const factorsEl = $('diagnosis-factors');
  if (diagEl && factorsEl) {
    if (state.diagnosis && state.diagnosis.length) {
      diagEl.classList.remove('hidden');
      factorsEl.innerHTML = state.diagnosis.map(f => `
        <div class="diag-item diag-${f.type}">
          <div class="diag-icon">${f.icon}</div>
          <div class="diag-body">
            <div class="diag-title">${f.title}: <span class="diag-val">${f.val}</span></div>
            <div class="diag-sub">${f.desc}</div>
          </div>
          <div class="diag-badge badge-${f.type}">${f.impact}</div>
        </div>
      `).join('');
    } else {
      diagEl.classList.add('hidden');
    }
  }
}

function renderMushrooms() {
  const el = $('mushroom-list');
  const all = state.mushroomList;
  const f = state.forestData;
  const isNonForest = f && f.isForest === false;

  if (isNonForest && (f.terrainType === 'urban' || f.terrainType === 'water')) {
    el.innerHTML = `
      <div class="empty-list">
        <span style="font-size:32px;display:block;margin-bottom:8px">${f.terrainType === 'urban' ? '🏙️' : '💧'}</span>
        <p>Brak grzybów na terenie ${f.terrainType === 'urban' ? 'zurbanizowanym / miejskim' : 'wodnym'}.<br>
        <small>Wybierz las lub łąkę, aby sprawdzić występowanie grzybów.</small></p>
      </div>`;
    return;
  }

  if (!all || all.length === 0) {
    el.innerHTML = `
      <div class="empty-list">
        <p>Brak grzybów dla tego terenu w obecnym sezonie.<br>
        <small>Wybierz inny punkt w lesie lub na łące, aby zobaczyć dopasowane gatunki.</small></p>
      </div>`;
    return;
  }

  // Podziel na grupy
  const edible   = all.filter(m => m.edible === 'jadalne' && m.score > 4);
  const caution  = all.filter(m => (m.edible === 'uwaga' || m.edible === 'niejadalne') && m.score > 4);
  const toxic    = all.filter(m => m.edible === 'trujące' && m.score > 2);

  const renderGroup = (list, limit = 20) => list.slice(0, limit).map(m => {
    const edibleInfo = edibleLabel(m.edible);
    const barColor   = scoreToColor(m.score);
    const id         = `d-${m.id}`;
    const pct = m.score;
    const cmp = m.components || {};

    const treeBadge = m.matchedTreeName
      ? `<span class="tag tag-tree" title="Główny partner mikoryzowy">🌳 ${m.matchedTreeName}</span>`
      : `<span class="tag tag-relation">${m.relation || (isNonForest ? 'Saprotrof łąkowy' : 'Saprotrof')}</span>`;

    const ageBadge = m.ageNote
      ? `<span class="tag tag-age">${m.ageNote.split('—')[0]}</span>`
      : '';

    const treeEcoText = m.matchedTreeName
      ? m.matchedTreeName
      : (isNonForest ? 'Brak powiązania z drzewami (gatunek łąkowy / saprotroficzny)' : 'Lasy mieszane i liściaste');

    return `
      <div class="mushroom-card ${m.danger ? 'danger' : ''}" onclick="toggleMushroomDetail('${id}')">
        <div class="mushroom-main">
          <span class="mushroom-icon">${m.icon}</span>
          <div class="mushroom-info">
            <div class="mushroom-name">${m.name}</div>
            <div class="mushroom-latin">${m.latin}</div>
            <div class="mushroom-tags">
              <span class="tag ${edibleInfo.cls}">${edibleInfo.text}</span>
              ${treeBadge}
              ${ageBadge}
            </div>
          </div>
          <div class="mushroom-score-col">
            <div class="mushroom-score" style="color:${barColor}">${pct}%</div>
            <div class="score-bar-mini">
              <div class="score-bar-fill-mini" style="width:${Math.max(pct,2)}%;background:${barColor}"></div>
            </div>
            <div class="score-label-mini">${scoreToLabel(pct)}</div>
          </div>
        </div>
        <div class="mushroom-detail hidden" id="${id}">
          <p class="mushroom-desc">${m.description || ''}</p>
          ${m.danger ? '<p class="danger-warning">⚠️ Ten gatunek jest śmiertelnie niebezpieczny!</p>' : ''}

          <!-- Ekologiczne wyznaczniki w tym punkcie -->
          <div class="eco-indicators-box">
            <div class="eco-ind-title">🔍 Dlaczego ten grzyb w tym wydzieleniu?</div>
            <div class="eco-ind-list">
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🌳</span>
                <span>Drzewa / Podłoże: <strong>${treeEcoText}</strong></span>
              </div>
              ${m.ageNote ? `
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🌱</span>
                <span>Wiek drzewostanu: <strong>${m.ageNote}</strong></span>
              </div>` : ''}
              ${m.habitatNote ? `
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🏷️</span>
                <span>Siedlisko: <strong>${m.habitatNote}</strong></span>
              </div>` : ''}
            </div>
          </div>

          <div class="score-components">
            <div class="sc-item" title="Dopasowanie do drzewostanu i siedliska">
              <span class="sc-label">🌳 Drzewostan</span>
              <span class="sc-val" style="color:${barColor}">${cmp.tree ?? '—'}%</span>
            </div>
            <div class="sc-item" title="Sezonowość">
              <span class="sc-label">📅 Sezon</span>
              <span class="sc-val">${cmp.season ?? '—'}%</span>
            </div>
            <div class="sc-item" title="Warunki pogodowe">
              <span class="sc-label">🌦️ Pogoda</span>
              <span class="sc-val">${cmp.weather ?? '—'}%</span>
            </div>
            <div class="sc-item" title="Naturalna pospolitość gatunku">
              <span class="sc-label">🌏 Pospolitość</span>
              <span class="sc-val">${cmp.prevalence ?? '—'}%</span>
            </div>
          </div>
          ${m.ecology ? `
          <div class="ecology-row">
            <span>🌡️ ${m.ecology.tempMin}–${m.ecology.tempMax}°C</span>
            <span>💧 min ${m.ecology.rain14min} mm/14d</span>
            <span>🕓 +${m.ecology.daysAfter?.[0]}–${m.ecology.daysAfter?.[1]} dni po deszczu</span>
          </div>` : ''}
          <div class="wiki-row">
            ${m.grzybyUrl ? `
            <a class="wiki-link grzyby-link"
               href="${m.grzybyUrl}"
               target="_blank" rel="noopener noreferrer"
               onclick="event.stopPropagation()"
               title="Otwórz atlas na grzyby.pl">
              <span class="grzyby-link-icon">🍄</span>
              grzyby.pl — <em>${m.name.split(' (')[0]}</em>
            </a>` : ''}
            <a class="wiki-link"
               href="https://pl.wikipedia.org/wiki/${encodeURIComponent(m.latin.replace(/ /g,'_'))}"
               target="_blank" rel="noopener noreferrer"
               onclick="event.stopPropagation()"
               title="Otwórz artykuł na Wikipedii">
              <svg class="wiki-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8 5 8h-4v4h-2z"/>
              </svg>
              Wikipedia — <em>${m.latin}</em>
            </a>
          </div>
        </div>
      </div>`;
  }).join('');

  let html = '';
  if (isNonForest && (!f.terrainType || f.terrainType === 'meadow')) {
    html += `
      <div class="meadow-banner">
        <span class="meadow-banner-icon">🌾</span>
        <div class="meadow-banner-text">
          <strong>Teren otwarty / łąka (brak lasu)</strong>
          <span>Wykluczono wszystkie grzyby mikoryzowe (borowiki, kurki, maślaki, podgrzybki). Poniżej prezentowane są wyłącznie gatunki łąkowe, trawiaste i saprotrofy przydrożne.</span>
        </div>
      </div>
    `;
  }
  if (edible.length)  html += `<div class="mushroom-group-label">🍄 Jadalne (${edible.length})</div>${renderGroup(edible, 40)}`;
  if (caution.length) html += `<div class="mushroom-group-label warn">⚠️ Uwaga / niejadalne (${caution.length})</div>${renderGroup(caution, 15)}`;
  if (toxic.length)   html += `<div class="mushroom-group-label danger">☠️ Trujące — ostrzeżenie (${toxic.length})</div>${renderGroup(toxic, 15)}`;

  el.innerHTML = html;
}

function renderLoading() {
  $('forest-info').innerHTML = '<div class="loading-skeleton"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
  $('weather-info').innerHTML = '<div class="loading-skeleton"><div class="skeleton-line"></div></div>';
  $('mushroom-list').innerHTML = [1,2,3].map(() =>
    '<div class="loading-skeleton mushroom-skeleton"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>'
  ).join('');
}

// ── Panel UI ───────────────────────────────────────────────────────
function showPanel(open) {
  state.panelOpen = open;
  $('bottom-panel').classList.toggle('open', open);
  $('panel-backdrop').classList.toggle('active', open);
}

function togglePanel() {
  showPanel(!state.panelOpen);
}

function closePanel() {
  showPanel(false);
}

// ── Szczegóły grzyba (toggle) ──────────────────────────────────────
window.toggleMushroomDetail = function(id) {
  // id to bezpośrednio "d-{m.id}" przekazane z onclick
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
};

// ── Helpers UI ─────────────────────────────────────────────────────
function setStatus(msg, type) {
  const el = $('status-bar');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-bar ${type}`;
  el.style.display = msg ? 'flex' : 'none';
}

function showError(msg) {
  setStatus(msg, 'error');
  console.error('[App]', msg);
}

function getGpsError(e) {
  if (e.code === 1) return 'Brak zgody na lokalizację. Włącz GPS w ustawieniach.';
  if (e.code === 2) return 'Nie można określić lokalizacji. Sprawdź GPS.';
  if (e.code === 3) return 'Przekroczono czas oczekiwania na GPS.';
  return 'Błąd GPS: ' + (e.message || 'nieznany');
}

let forestLayerVisible = true;
function onLayerToggle() {
  forestLayerVisible = !forestLayerVisible;
  $('btn-layer-toggle').classList.toggle('active', forestLayerVisible);
  if (window.toggleForestLayerGlobal) window.toggleForestLayerGlobal(forestLayerVisible);
}

function onHeatmapToggle() {
  const nowVisible = !isHeatmapVisible();
  const lat = state.pinMode ? (state.pinLat || state.lat) : state.lat;
  const lng = state.pinMode ? (state.pinLng || state.lng) : state.lng;

  if (lat && lng) {
    setHeatmapCenter(lat, lng);
  }
  if (state.weatherData) {
    updateHeatmap(state.weatherData, new Date().getMonth() + 1);
  }

  toggleHeatmap(nowVisible);
  $('btn-heatmap').classList.toggle('active', nowVisible);
  $('heatmap-legend').classList.toggle('hidden', !nowVisible);

  if (nowVisible && !state.weatherData) {
    setStatus('Najpierw załaduj lokalizację — heatmapa potrzebuje danych pogodowych', 'info');
  }
}

// ── Nakładki typów lasu ────────────────────────────────────────────
let deciduousVisible = false;
let coniferousVisible = false;

function updateForestTypeLegend() {
  const legend = $('forest-type-legend');
  if (!legend) return;
  const anyActive = deciduousVisible || coniferousVisible;
  legend.classList.toggle('hidden', !anyActive);

  // Przyciemnij nieaktywne pozycje legendy
  const ftlDec = $('ftl-deciduous');
  const ftlCon = $('ftl-coniferous');
  if (ftlDec) ftlDec.style.opacity = deciduousVisible ? '1' : '0.35';
  if (ftlCon) ftlCon.style.opacity = coniferousVisible ? '1' : '0.35';
}

function onDeciduousToggle() {
  deciduousVisible = !deciduousVisible;
  toggleDeciduousLayer(deciduousVisible);
  $('btn-deciduous').classList.toggle('active-deciduous', deciduousVisible);
  updateForestTypeLegend();
}

function onConiferousToggle() {
  coniferousVisible = !coniferousVisible;
  toggleConiferousLayer(coniferousVisible);
  $('btn-coniferous').classList.toggle('active-coniferous', coniferousVisible);
  updateForestTypeLegend();
}

// ── Szlaki turystyczne LP ─────────────────────────────────────────
let trailsVisible = false;

function onTrailsToggle() {
  trailsVisible = !trailsVisible;
  toggleTrailsLayer(trailsVisible);
  $('btn-trails').classList.toggle('active-trails', trailsVisible);
  $('trails-legend').classList.toggle('hidden', !trailsVisible);
}
