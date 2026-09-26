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
import { initMap, updateUserPosition, showForestBoundary, panTo, setPinMode, setPin, removePin, isPinModeActive, toggleTreeSpeciesLayer, toggleTrailsLayer, isTrailsVisible } from './map.js';
import { initHeatmap, updateHeatmap, toggleHeatmap, isHeatmapVisible, setHeatmapCenter } from './heatmap.js?v=8.0';

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
  $('btn-heatmap').addEventListener('click', onHeatmapToggle);
  $('btn-tree-species').addEventListener('click', onTreeSpeciesToggle);
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

const LP_TO_NORM = {
  'SO': 'So', 'SW': 'Sw', 'ŚW': 'Sw', 'JD': 'Jd', 'MD': 'Md',
  'DB': 'Db', 'DBCZ': 'Dbcz', 'BK': 'Bk', 'GB': 'Gb', 'BRZ': 'Brz',
  'LP': 'Lp', 'JS': 'Js', 'KL': 'Kl', 'OL': 'Ol', 'OS': 'Os',
  'TP': 'Tp', 'WZ': 'Wz', 'LSZ': 'Lsz', 'WB': 'Wb', 'JW': 'Jw', 'CZR': 'Czr',
};

/**
 * Parsuj rawCode LP do tablicy z procentami dla scoringu
 * "6So4Db2Bk" → [{code:'So',pct:60},{code:'Db',pct:40},{code:'Bk',pct:20}]
 * "10SO"      → [{code:'So',pct:100}]
 * "SO"        → [{code:'So',pct:100}]
 */
function parseCompositionForScoring(rawCode, speciesCodes) {
  if (!rawCode || ['mixed', 'needleleaved', 'broadleaved'].includes(rawCode.toLowerCase())) {
    const codes = (speciesCodes && speciesCodes.length) ? speciesCodes : ['So', 'Db'];
    const eqPct = Math.round(100 / codes.length);
    return codes.map(c => ({ code: c, pct: eqPct }));
  }

  const upper = rawCode.toUpperCase().trim();
  const knownKeys = Object.keys(LP_TO_NORM).sort((a,b) => b.length - a.length);
  const regex = new RegExp(`(\\d+)?\\s*(${knownKeys.join('|')})`, 'g');
  const matches = [...upper.matchAll(regex)];

  if (matches.length > 0) {
    let items = matches.map(m => {
      const num = m[1] ? parseInt(m[1], 10) : null;
      const code = LP_TO_NORM[m[2]];
      return { code, num };
    });

    const hasNums = items.some(it => it.num !== null);
    if (hasNums) {
      const totalNum = items.reduce((sum, it) => sum + (it.num || 1), 0);
      return items.map(it => ({
        code: it.code,
        pct: totalNum <= 10 ? ((it.num || 1) * 10) : Math.round(((it.num || 1) / totalNum) * 100)
      }));
    } else {
      const eqPct = Math.round(100 / items.length);
      return items.map(it => ({ code: it.code, pct: eqPct }));
    }
  }

  if (speciesCodes?.length) {
    const eqPct = Math.round(100 / speciesCodes.length);
    return speciesCodes.map(c => ({ code: c, pct: eqPct }));
  }

  return [];
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
      terrainName = 'Teren miejski / zabudowany';
      terrainBadgeCls = 'badge-urban';
      terrainDesc = 'Obszar zurbanizowany (miasto / wieś zabudowana) — wyłączony ze zbiorów leśnych. Brak naturalnej ściółki i leśnych partnerów mikoryzowych. Na miejskich skwerach rzadko rosną pieczarki miejskie czy czernidłaki, lecz ich zbiór w miastach jest odradzany ze względu na zanieczyszczenia i metale ciężkie.';
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
            <span class="badge ${terrainBadgeCls}">${terrainName}</span>
            <span class="badge badge-nonforest" style="${f.terrainType === 'urban' ? 'background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.3)' : ''}">
              ${f.terrainType === 'urban' ? 'Wyłączony ze zbiorów' : 'Teren niezalesiony'}
            </span>
          </div>
        </div>
      </div>
      <div class="nonforest-box">
        <strong>Status terenu:</strong> ${terrainDesc}
      </div>
    `;
    return;
  }

  const isApprox = f.isApproximate || f.source?.startsWith('OSM') || f.missingLpData;

  const sourceBadge = (f.source === 'OGC_LP' || f.source === 'LP_WFS')
    ? '<span class="badge badge-lp">Lasy Państwowe (BDL)</span>'
    : `<span class="badge badge-osm">OpenStreetMap</span>
       <span class="badge badge-warning" style="background:rgba(234,179,8,0.18);color:#fef08a;border:1px solid rgba(234,179,8,0.4)">⚠️ Brak danych LP (dane szacunkowe)</span>`;

  const rdlpLabel = f.rdlp || f.nadlesnictwo || (f.isNationalPark ? 'Park Narodowy (Ochrona przyrody)' : (isApprox ? 'Zasoby leśne OSM' : ''));

  // Rozszyfrowuj skład gatunkowy
  const composition = decodeComposition(f.rawCode);
  const compositionHtml = composition.length
    ? composition.map(s => `
        <div class="species-row">
          <span class="species-pct">${s.pct !== null ? s.pct + '%' : ''}</span>
          <span class="species-bar-wrap"><span class="species-bar" style="width:${s.pct ?? 100}%"></span></span>
          <span class="species-name"><strong>${s.name}</strong> <em>${s.latin}</em></span>
        </div>`).join('')
    : `<p class="no-data" style="margin:0;font-size:12px">Brak danych o szczegółowym składzie</p>`;

  // Czytelny opis siedliska
  const habitatLabel = f.habitatCode
    ? `${f.habitatCode} — ${decodeHabitat(f.habitatCode)}`
    : null;

  const approxNotice = isApprox ? `
    <div class="approx-notice-box" style="margin:10px 0;padding:11px 14px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.35);border-radius:8px;font-size:12.5px;line-height:1.5;color:#fef08a">
      🌲 <strong>Brak danych urzędowych na temat tego lasu:</strong><br>
      ${f.isNationalPark
        ? 'Teren leży w granicach Parku Narodowego (poza ewidencją Lasów Państwowych).'
        : 'Teren stanowi las według mapy OpenStreetMap (las prywatny, komunalny lub zadrzewienie), lecz nie posiada ewidencji LP ani planu urządzania lasu.'}<br>
      <span style="display:inline-block;margin-top:4px">
        <strong>Przypuszczalnie występują tu gatunki grzybów:</strong><br>
        Lokalne warunki i typowe zadrzewienie sprzyjają takim grzybom jak: <em>Borowik szlachetny, Podgrzybek brunatny, Pieprznik jadalny (Kurka), Koźlarz, Maślak oraz Czubajka kania</em>.
        Indeks zbiorów obliczono przypuszczalnie na bazie wilgotności gleby, opadów i mikroklimatu.
      </span>
    </div>
  ` : '';

  infoEl.innerHTML = `
    <div class="forest-header">
      <span class="forest-icon-big">${f.isNationalPark ? '🏞️' : '🌲'}</span>
      <div>
        <h2 class="forest-name">${f.forestName || 'Las Państwowy'}</h2>
        ${rdlpLabel ? `<p class="forest-sub">${rdlpLabel.startsWith('Park') || rdlpLabel.startsWith('Zasoby') ? rdlpLabel : 'RDLP ' + rdlpLabel}</p>` : ''}
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          ${modeBadge}
          ${sourceBadge}
        </div>
      </div>
    </div>
    ${approxNotice}
    <div class="composition-block">
      <div class="composition-label">${isApprox ? 'Przypuszczalny skład drzewostanu' : 'Skład drzewostanu'}</div>
      ${compositionHtml}
    </div>
    <div class="forest-details">
      ${habitatLabel  ? `<div class="detail-chip" title="Typ siedliskowy lasu">🏷️ ${habitatLabel}</div>` : ''}
      ${f.specAge     ? `<div class="detail-chip">🌱 Wiek: <strong>${f.specAge}</strong></div>` : ''}
      ${f.area        ? `<div class="detail-chip">📐 ${f.area}</div>` : ''}
      ${f.adrFor      ? `<div class="detail-chip" title="Adres leśny">📌 ${f.adrFor.trim()}</div>` : ''}
      ${isApprox && !f.specAge ? `<div class="detail-chip" title="Status ewidencji">ℹ️ Poza ewidencją Lasów Państwowych</div>` : ''}
    </div>
  `;
}

/**
 * Rozszyfruj kod składu gatunkowego LP
 * "6So4Db2Bk" → [{pct:60, name:'Sosna', latin:'Pinus sylvestris'}, ...]
 * "10SO"      → [{pct:100, name:'Sosna', latin:'Pinus sylvestris'}]
 * "SO"        → [{pct:null, name:'Sosna', latin:'Pinus sylvestris'}]
 */
function decodeComposition(rawCode) {
  if (!rawCode) return [];

  const lower = rawCode.toLowerCase().trim();
  if (lower === 'needleleaved') {
    return [
      { pct: 70, code: 'So', name: 'Sosna (szac.)', latin: 'Pinus sylvestris' },
      { pct: 30, code: 'Sw', name: 'Świerk (szac.)', latin: 'Picea abies' },
    ];
  }
  if (lower === 'broadleaved') {
    return [
      { pct: 60, code: 'Db', name: 'Dąb (szac.)', latin: 'Quercus robur' },
      { pct: 40, code: 'Brz', name: 'Brzoza (szac.)', latin: 'Betula pendula' },
    ];
  }
  if (lower === 'mixed') {
    return [
      { pct: 60, code: 'So', name: 'Sosna (szac.)', latin: 'Pinus sylvestris' },
      { pct: 40, code: 'Db', name: 'Dąb (szac.)', latin: 'Quercus robur' },
    ];
  }

  const upper = rawCode.toUpperCase().trim();
  const knownKeys = Object.keys(LP_TO_NORM).sort((a,b) => b.length - a.length);
  const regex = new RegExp(`(\\d+)?\\s*(${knownKeys.join('|')})`, 'g');
  const matches = [...upper.matchAll(regex)];

  if (matches.length > 0) {
    let items = matches.map(m => {
      const num = m[1] ? parseInt(m[1], 10) : null;
      const norm = LP_TO_NORM[m[2]];
      return { norm, num };
    });

    const hasNums = items.some(it => it.num !== null);
    const totalNum = hasNums ? items.reduce((sum, it) => sum + (it.num || 1), 0) : null;

    return items.map(it => {
      const spec = TREE_SPECIES[it.norm];
      let pct = null;
      if (hasNums) {
        pct = totalNum <= 10 ? ((it.num || 1) * 10) : Math.round(((it.num || 1) / totalNum) * 100);
      }
      return {
        pct,
        code: it.norm,
        name: spec?.name || it.norm,
        latin: spec?.latin || '',
      };
    });
  }

  // Fallback: prosty kod
  const parts = rawCode.trim().split(/\s+/);
  return parts.map(p => {
    const upperP = p.toUpperCase();
    const norm = LP_TO_NORM[upperP] || (p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    const spec = TREE_SPECIES[norm];
    return {
      pct: null,
      code: norm,
      name: spec?.name || norm,
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
    if (f.terrainType === 'urban') {
      el.innerHTML = `
        <div class="empty-list" style="text-align:left;padding:16px 18px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;margin:8px 0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:26px">🏙️</span>
            <div>
              <strong style="color:#ef4444;font-size:14px;display:block">Teren miejski / zabudowany — wyłączony z programu</strong>
              <small style="color:#94a3b8">Brak szans na jadalne grzyby leśne</small>
            </div>
          </div>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.5;margin:8px 0">
            W zwartej zabudowie miast i wsi leśne grzyby jadalne (borowiki, podgrzybki, maślaki, kurki) nie występują z powodu braku leśnej mikoryzy i utwardzonego podłoża.
          </p>
          <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;margin:8px 0;font-size:12px;color:#94a3b8;line-height:1.4">
            ⚠️ <strong>Ostrzeżenie:</strong> Na miejskich trawnikach lub skwerach sporadycznie wyrastają pieczarki miejskie (<em>Agaricus bitorquis</em>) czy czernidłaki kołpakowate. Zbieranie i spożywanie grzybów w miastach i przy drogach jest <strong>zdecydowanie odradzane</strong> ze względu na wysoką bioakumulację metali ciężkich (ołów, kadm) oraz pyłów komunikacyjnych.
          </div>
          <p style="font-size:12px;color:#60a5fa;margin-top:8px">
            👉 Przesuń próbnik lub kliknij na zielony las na mapie, aby sprawdzić szanse na zbiory.
          </p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="empty-list">
        <span style="font-size:32px;display:block;margin-bottom:8px">💧</span>
        <p>Brak grzybów na terenie wodnym.<br>
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

// ── Nakładka gatunków drzew ─────────────────────────────────────────
let treeSpeciesVisible = false;

function onTreeSpeciesToggle() {
  treeSpeciesVisible = !treeSpeciesVisible;
  toggleTreeSpeciesLayer(treeSpeciesVisible);
  $('btn-tree-species')?.classList.toggle('active-species', treeSpeciesVisible);
  const legend = $('forest-type-legend');
  if (legend) legend.classList.toggle('hidden', !treeSpeciesVisible);
}

// ── Szlaki turystyczne LP ─────────────────────────────────────────
let trailsVisible = false;

function onTrailsToggle() {
  trailsVisible = !trailsVisible;
  toggleTrailsLayer(trailsVisible);
  $('btn-trails').classList.toggle('active-trails', trailsVisible);
  $('trails-legend').classList.toggle('hidden', !trailsVisible);
}
