/**
 * app.js
 * Główny moduł aplikacji GrzyboMapa
 * Integruje: GPS, OGC API LP, pogoda, scoring, UI, i18n
 */

import { startTracking, getCurrentPosition, stopTracking } from './location.js';
import { getForestData, getForestBoundary } from './forest_api.js';
import { getWeatherData, weatherCodeToText, weatherCodeToIcon } from './weather.js';
import { getMushroomsForStand, getMushroomsForMixedForest, filterBySeason, TREE_SPECIES } from './mushroom_knowledge.js';
import { scoreAllMushrooms, calculateOverallScore, calculateDailyForecastScores, generateSummary, generateDetailedDiagnosis, edibleLabel, scoreToColor, scoreToLabel } from './scoring.js';
import { initMap, updateUserPosition, showForestBoundary, panTo, setPinMode, setPin, removePin, isPinModeActive, toggleTreeSpeciesLayer, toggleTrailsLayer, isTrailsVisible, getMap } from './map.js';
import { initHeatmap, updateHeatmap, toggleHeatmap, isHeatmapVisible, setHeatmapCenter } from './heatmap.js?v=8.0';
import { t, getLang, setLang, onLanguageChange, getTreeSpeciesName, decodeHabitat, getMushroomName, LANGUAGES } from './i18n.js';

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
  mode: null,
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

  // Inicjalizacja tekstów statycznych i języka
  updateStaticTexts();

  // Bindowanie przełącznika języków
  initLanguageSwitcher();

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
    showError(t('gpsErr1'));
  }

  // Splash — ukryj po chwili
  setTimeout(() => {
    $('splash')?.classList.add('hidden');
  }, 1800);

  // Uruchom od razu próbnik terenu — pinezka natychmiast pojawia się na mapie!
  activatePinMode();
});

// ── Przełącznik języków ─────────────────────────────────────────────
function initLanguageSwitcher() {
  const btnLang = $('btn-lang');
  const langDropdown = $('lang-dropdown');

  if (btnLang && langDropdown) {
    btnLang.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!$('lang-selector-wrap')?.contains(e.target)) {
        langDropdown.classList.add('hidden');
      }
    });

    langDropdown.querySelectorAll('.lang-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const chosen = opt.getAttribute('data-lang');
        if (chosen) {
          setLang(chosen);
          langDropdown.classList.add('hidden');
        }
      });
    });
  }

  onLanguageChange(() => {
    updateStaticTexts();
    updatePanelSource(state.mode, state.pinMode ? state.pinLat : state.lat, state.pinMode ? state.pinLng : state.lng);
    if (state.forestData || state.weatherData) {
      recalculateAndRender();
    }
  });
}

function updateStaticTexts() {
  const lang = getLang();
  document.title = t('appTitle');
  document.documentElement.lang = lang;

  const currentLangCode = $('current-lang-code');
  if (currentLangCode) {
    currentLangCode.textContent = lang.toUpperCase();
  }

  // Przycisk i aria
  const bTree = $('btn-tree-species');
  if (bTree) {
    bTree.title = t('btnTreeSpeciesTitle');
    bTree.setAttribute('aria-label', t('btnTreeSpeciesTitle'));
  }
  const bHeat = $('btn-heatmap');
  if (bHeat) {
    bHeat.title = t('btnHeatmapTitle');
    bHeat.setAttribute('aria-label', t('btnHeatmapTitle'));
  }
  const bTrails = $('btn-trails');
  if (bTrails) {
    bTrails.title = t('btnTrailsTitle');
    bTrails.setAttribute('aria-label', t('btnTrailsTitle'));
  }
  const bPin = $('btn-pin-mode');
  if (bPin) {
    bPin.title = t('btnPinTitle');
    bPin.setAttribute('aria-label', t('btnPinTitle'));
  }
  const bGps = $('btn-locate');
  if (bGps) {
    bGps.title = t('btnGpsTitle');
    bGps.setAttribute('aria-label', t('btnGpsTitle'));
  }
  const bRefresh = $('btn-refresh');
  if (bRefresh) {
    bRefresh.title = t('btnRefresh');
    bRefresh.setAttribute('aria-label', t('btnRefresh'));
  }
  const bClose = $('btn-panel-toggle');
  if (bClose) {
    bClose.setAttribute('aria-label', t('btnClosePanel'));
  }
  const fab = $('fab-panel');
  if (fab) {
    fab.setAttribute('aria-label', t('fabShowResults'));
  }

  // Tłumaczenie wszystkich elementów z data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Zaznaczenie aktywnego języka w menu
  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
  });
}

// ── Kliknięcie Lokalizuj (GPS Na Żywo) ─────────────────────────────
async function onLocateClick() {
  if (state.pinMode) {
    deactivatePinMode();
  }

  if (state.isTracking && state.mode === 'gps') {
    if (state.lat) panTo(state.lat, state.lng, 16);
    return;
  }

  state.mode = 'gps';
  stopTracking();
  removePin();

  $('btn-locate').classList.add('loading');
  setStatus(t('gpsFetching'), 'info');

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

  stopTracking();
  state.isTracking = false;

  $('btn-pin-mode').classList.add('active');
  $('btn-locate').classList.remove('active');
  $('btn-locate').classList.remove('loading');
  $('pin-hint').classList.remove('hidden');

  setPinMode(true, async (lat, lng) => {
    state.pinLat = lat;
    state.pinLng = lng;
    updatePanelSource('pin', lat, lng);
    setHeatmapCenter(lat, lng);
    showPanel(true);
    await loadAllData(lat, lng);
  });

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
  setPinMode(false);
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
    const coordsStr = (curLat && curLng) ? `${curLat.toFixed(5)}, ${curLng.toFixed(5)}` : t('pointOnMap');
    titleEl.innerHTML = `${t('panelTitleSampler')}
      <small style="font-size:11px;color:#fbbf24;font-weight:600;display:block;margin-top:2px">
        ${t('panelSubSample', { coords: coordsStr })}
      </small>`;
  } else {
    const curLat = lat || state.lat;
    const curLng = lng || state.lng;
    const coordsStr = (curLat && curLng) ? `${curLat.toFixed(5)}, ${curLng.toFixed(5)}` : '';
    titleEl.innerHTML = `${t('panelTitleGps')}
      <small style="font-size:11px;color:#60a5fa;font-weight:400;display:block;margin-top:2px">
        ${coordsStr ? t('panelSubGps', { coords: coordsStr }) : t('panelSubGpsLive')}
      </small>`;
  }
}

// ── Przeliczanie i renderowanie ────────────────────────────────────
function recalculateAndRender() {
  const month = new Date().getMonth() + 1;
  const f = state.forestData;
  const isForest = f ? f.isForest !== false : false;
  const terrainType = f?.terrainType || (isForest ? 'forest' : 'meadow');

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
}

// ── Ładuj wszystkie dane ───────────────────────────────────────────
async function loadAllData(lat, lng) {
  if (!lat || !lng) return;
  if (state.isLoading) return;

  state.isLoading = true;
  showPanel(true);
  setStatus(t('forestDetecting'), 'info');
  renderLoading();

  try {
    const [forestData, weatherData] = await Promise.allSettled([
      getForestData(lat, lng),
      getWeatherData(lat, lng),
    ]);

    state.forestData = forestData.status === 'fulfilled' ? forestData.value : null;
    state.weatherData = weatherData.status === 'fulfilled' ? weatherData.value : null;

    if (!state.forestData || state.forestData.isForest === false) {
      if (state.forestData?.terrainType === 'urban') {
        setStatus(t('urbanStatusWarn'), 'warn');
      } else if (state.forestData?.terrainType === 'water') {
        setStatus(t('waterStatusWarn'), 'warn');
      } else {
        setStatus(t('meadowStatusWarn'), 'warn');
      }
    }

    if (state.forestData?.isForest && state.forestData._feature) {
      showForestBoundary(state.forestData._feature);
    } else if (state.forestData?.isForest) {
      getForestBoundary(lat, lng).then(b => showForestBoundary(b));
    } else {
      showForestBoundary(null);
    }

    const weatherAnalysis = state.weatherData?.analysis || null;
    const month = new Date().getMonth() + 1;

    recalculateAndRender();

    setHeatmapCenter(lat, lng);
    updateHeatmap(weatherAnalysis, month);

    setStatus('', '');

  } catch (e) {
    console.error('[App] loadAllData error:', e);
    setStatus(t('dataFetchError'), 'error');
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
  const lang = getLang();

  if (!f) {
    infoEl.innerHTML = `
      <div class="forest-empty">
        <span class="forest-icon">🌿</span>
        <p>${t('forestEmptyNotice')}</p>
      </div>`;
    return;
  }

  const modeBadge = state.pinMode
    ? `<span class="badge badge-pin">${t('badgePin')}</span>`
    : `<span class="badge badge-gps">${t('badgeGps')}</span>`;

  // Obsługa terenu niezalesionego (łąka / miasto / woda)
  if (f.isForest === false) {
    let terrainIcon = '🌾';
    let terrainName = t('terrainMeadow');
    let terrainBadgeCls = 'badge-meadow';
    let terrainDesc = t('terrainMeadowDesc');

    if (f.terrainType === 'urban') {
      terrainIcon = '🏙️';
      terrainName = t('terrainUrban');
      terrainBadgeCls = 'badge-urban';
      terrainDesc = t('terrainUrbanDesc');
    } else if (f.terrainType === 'water') {
      terrainIcon = '💧';
      terrainName = t('terrainWater');
      terrainBadgeCls = 'badge-water';
      terrainDesc = t('terrainWaterDesc');
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
              ${f.terrainType === 'urban' ? t('statusExcluded') : t('statusNonForest')}
            </span>
          </div>
        </div>
      </div>
      <div class="nonforest-box">
        <strong>${t('statusTerrLabel')}</strong> ${terrainDesc}
      </div>
    `;
    return;
  }

  const isApprox = f.isApproximate || f.source?.startsWith('OSM') || f.missingLpData;

  const sourceBadge = (f.source === 'OGC_LP' || f.source === 'LP_WFS')
    ? `<span class="badge badge-lp">${t('badgeLp')}</span>`
    : `<span class="badge badge-osm">${t('badgeOsm')}</span>
       <span class="badge badge-warning" style="background:rgba(234,179,8,0.18);color:#fef08a;border:1px solid rgba(234,179,8,0.4)">${t('badgeLpMissing')}</span>`;

  const rdlpLabel = f.rdlp || f.nadlesnictwo || (f.isNationalPark ? (t('approxNoticeNationalPark')) : (isApprox ? 'OpenStreetMap' : ''));

  // Rozszyfrowuj skład gatunkowy
  const composition = decodeComposition(f.rawCode);
  const compositionHtml = composition.length
    ? composition.map(s => `
        <div class="species-row">
          <span class="species-pct">${s.pct !== null ? s.pct + '%' : ''}</span>
          <span class="species-bar-wrap"><span class="species-bar" style="width:${s.pct ?? 100}%"></span></span>
          <span class="species-name"><strong>${s.name}</strong> <em>${s.latin}</em></span>
        </div>`).join('')
    : `<p class="no-data" style="margin:0;font-size:12px">${t('compositionNoData')}</p>`;

  // Czytelny opis siedliska
  const habitatLabel = f.habitatCode
    ? `${f.habitatCode} — ${decodeHabitat(f.habitatCode, lang)}`
    : null;

  const approxNotice = isApprox ? `
    <div class="approx-notice-box" style="margin:10px 0;padding:11px 14px;background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.35);border-radius:8px;font-size:12.5px;line-height:1.5;color:#fef08a">
      🌲 <strong>${t('approxNoticeTitle')}</strong><br>
      ${f.isNationalPark ? t('approxNoticeNationalPark') : t('approxNoticeOsm')}<br>
      <span style="display:inline-block;margin-top:4px">
        <strong>${t('approxNoticeSpecies')}</strong><br>
        ${t('approxNoticeDesc')}
      </span>
    </div>
  ` : '';

  infoEl.innerHTML = `
    <div class="forest-header">
      <span class="forest-icon-big">${f.isNationalPark ? '🏞️' : '🌲'}</span>
      <div>
        <h2 class="forest-name">${f.forestName || t('badgeLp')}</h2>
        ${rdlpLabel ? `<p class="forest-sub">${rdlpLabel}</p>` : ''}
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          ${modeBadge}
          ${sourceBadge}
        </div>
      </div>
    </div>
    ${approxNotice}
    <div class="composition-block">
      <div class="composition-label">${isApprox ? t('compositionApproxTitle') : t('compositionTitle')}</div>
      ${compositionHtml}
    </div>
    <div class="forest-details">
      ${habitatLabel  ? `<div class="detail-chip" title="${t('secForestTitle')}">🏷️ ${habitatLabel}</div>` : ''}
      ${f.specAge     ? `<div class="detail-chip">${t('chipAge', { age: f.specAge })}</div>` : ''}
      ${f.area        ? `<div class="detail-chip">📐 ${f.area}</div>` : ''}
      ${f.adrFor      ? `<div class="detail-chip" title="${t('secForestTitle')}">📌 ${f.adrFor.trim()}</div>` : ''}
      ${isApprox && !f.specAge ? `<div class="detail-chip" title="${t('secForestTitle')}">${t('chipOutsideLp')}</div>` : ''}
    </div>
  `;
}

function decodeComposition(rawCode) {
  if (!rawCode) return [];
  const lang = getLang();

  const lower = rawCode.toLowerCase().trim();
  if (lower === 'needleleaved') {
    return [
      { pct: 70, code: 'So', name: `${getTreeSpeciesName('So', lang)}`, latin: 'Pinus sylvestris' },
      { pct: 30, code: 'Sw', name: `${getTreeSpeciesName('Sw', lang)}`, latin: 'Picea abies' },
    ];
  }
  if (lower === 'broadleaved') {
    return [
      { pct: 60, code: 'Db', name: `${getTreeSpeciesName('Db', lang)}`, latin: 'Quercus robur' },
      { pct: 40, code: 'Brz', name: `${getTreeSpeciesName('Brz', lang)}`, latin: 'Betula pendula' },
    ];
  }
  if (lower === 'mixed') {
    return [
      { pct: 60, code: 'So', name: `${getTreeSpeciesName('So', lang)}`, latin: 'Pinus sylvestris' },
      { pct: 40, code: 'Db', name: `${getTreeSpeciesName('Db', lang)}`, latin: 'Quercus robur' },
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
        name: getTreeSpeciesName(it.norm, lang),
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
      name: getTreeSpeciesName(norm, lang),
      latin: spec?.latin || '',
    };
  });
}

function renderWeather() {
  const w = state.weatherData;
  const el = $('weather-info');
  const lang = getLang();

  if (!w?.current && !w?.analysis) {
    el.innerHTML = `<p class="no-data">${t('weatherStatsNoData')}</p>`;
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
        ? '<span class="f-trend up" title="Up">📈 +</span>'
        : (d.trend === 'down' ? '<span class="f-trend down" title="Down">📉 -</span>' : '');

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
            <div class="forecast-title">${t('forecastTitle')}</div>
            <div class="forecast-sub">${t('forecastSub')}</div>
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
          <div class="weather-desc">${cur ? weatherCodeToText(cur.weathercode, lang) : t('scoreNoData')}</div>
        </div>
      </div>
      ${a ? `
        <div class="weather-stats">
          <div class="w-stat">
            <span class="w-stat-label">${t('statRain14')}</span>
            <span class="w-stat-value rain">${Math.round(a.rain14)} mm</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">${t('statAvgTemp')}</span>
            <span class="w-stat-value">${a.avgTemp7}°C</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">${t('statLastRain')}</span>
            <span class="w-stat-value">${a.lastRainDaysAgo >= 0 ? t('daysAgo', { n: a.lastRainDaysAgo }) : t('today')}</span>
          </div>
          <div class="w-stat">
            <span class="w-stat-label">${t('statDrought')}</span>
            <span class="w-stat-value ${a.droughtDays >= 5 ? 'warn' : ''}">${t('daysUnit', { n: a.droughtDays })}</span>
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
  const lang = getLang();

  $('overall-score').textContent = `${score}%`;
  $('score-label').textContent = scoreToLabel(score, lang);
  $('score-emoji').textContent = score >= 65 ? '🍄' : score >= 40 ? '🌿' : score >= 20 ? '🍂' : '🌵';

  const mainText = s?.main || s?.text || '';
  $('summary-text').textContent = mainText;

  const tipEl = $('summary-tip');
  if (tipEl) tipEl.textContent = s?.tip || '';

  const bar = $('score-bar-fill');
  if (bar) { bar.style.width = `${score}%`; bar.style.background = color; }

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
  const lang = getLang();

  if (isNonForest && (f.terrainType === 'urban' || f.terrainType === 'water')) {
    if (f.terrainType === 'urban') {
      el.innerHTML = `
        <div class="empty-list" style="text-align:left;padding:16px 18px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.22);border-radius:12px;margin:8px 0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:26px">🏙️</span>
            <div>
              <strong style="color:#ef4444;font-size:14px;display:block">${t('terrainUrban')}</strong>
              <small style="color:#94a3b8">${t('statusExcluded')}</small>
            </div>
          </div>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.5;margin:8px 0">
            ${t('terrainUrbanDesc')}
          </p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="empty-list">
        <span style="font-size:32px;display:block;margin-bottom:8px">💧</span>
        <p>${t('terrainWaterDesc')}</p>
      </div>`;
    return;
  }

  if (!all || all.length === 0) {
    el.innerHTML = `
      <div class="empty-list">
        <p>${t('mushroomsEmptyList')}</p>
      </div>`;
    return;
  }

  const edible   = all.filter(m => m.edible === 'jadalne' && m.score > 4);
  const caution  = all.filter(m => (m.edible === 'uwaga' || m.edible === 'niejadalne') && m.score > 4);
  const toxic    = all.filter(m => m.edible === 'trujące' && m.score > 2);

  const renderGroup = (list, limit = 20) => list.slice(0, limit).map(m => {
    const edibleInfo = edibleLabel(m.edible, lang);
    const barColor   = scoreToColor(m.score);
    const id         = `d-${m.id}`;
    const pct = m.score;
    const cmp = m.components || {};
    const mushroomName = getMushroomName(m, lang);

    const treeBadge = m.matchedTreeName
      ? `<span class="tag tag-tree" title="${t('mycorrhizalPartner')}">🌳 ${m.matchedTreeName}</span>`
      : `<span class="tag tag-relation">${m.relation || (isNonForest ? t('meadowSaprotroph') : t('saprotroph'))}</span>`;

    const ageBadge = m.ageNote
      ? `<span class="tag tag-age">${m.ageNote.split('—')[0]}</span>`
      : '';

    const treeEcoText = m.matchedTreeName
      ? m.matchedTreeName
      : (isNonForest ? t('meadowSaprotroph') : t('ftlMixed'));

    return `
      <div class="mushroom-card ${m.danger ? 'danger' : ''}" onclick="toggleMushroomDetail('${id}')">
        <div class="mushroom-main">
          <span class="mushroom-icon">${m.icon}</span>
          <div class="mushroom-info">
            <div class="mushroom-name">${mushroomName}</div>
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
            <div class="score-label-mini">${scoreToLabel(pct, lang)}</div>
          </div>
        </div>
        <div class="mushroom-detail hidden" id="${id}">
          <p class="mushroom-desc">${m.description || ''}</p>
          ${m.danger ? `<p class="danger-warning">${t('dangerWarning')}</p>` : ''}

          <!-- Ekologiczne wyznaczniki -->
          <div class="eco-indicators-box">
            <div class="eco-ind-title">${t('ecoWhyTitle')}</div>
            <div class="eco-ind-list">
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🌳</span>
                <span>${t('ecoTrees')} <strong>${treeEcoText}</strong></span>
              </div>
              ${m.ageNote ? `
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🌱</span>
                <span>${t('ecoAge')} <strong>${m.ageNote}</strong></span>
              </div>` : ''}
              ${m.habitatNote ? `
              <div class="eco-ind-item">
                <span class="eco-ind-icon">🏷️</span>
                <span>${t('ecoHabitat')} <strong>${decodeHabitat(m.habitatNote, lang)}</strong></span>
              </div>` : ''}
            </div>
          </div>

          <div class="score-components">
            <div class="sc-item" title="${t('scTree')}">
              <span class="sc-label">${t('scTree')}</span>
              <span class="sc-val" style="color:${barColor}">${cmp.tree ?? '—'}%</span>
            </div>
            <div class="sc-item" title="${t('scSeason')}">
              <span class="sc-label">${t('scSeason')}</span>
              <span class="sc-val">${cmp.season ?? '—'}%</span>
            </div>
            <div class="sc-item" title="${t('scWeather')}">
              <span class="sc-label">${t('scWeather')}</span>
              <span class="sc-val">${cmp.weather ?? '—'}%</span>
            </div>
            <div class="sc-item" title="${t('scPrevalence')}">
              <span class="sc-label">${t('scPrevalence')}</span>
              <span class="sc-val">${cmp.prevalence ?? '—'}%</span>
            </div>
          </div>
          ${m.ecology ? `
          <div class="ecology-row">
            <span>🌡️ ${m.ecology.tempMin}–${m.ecology.tempMax}°C</span>
            <span>💧 min ${m.ecology.rain14min} mm/14d</span>
            <span>🕓 ${t('daysAfterRain', { min: m.ecology.daysAfter?.[0], max: m.ecology.daysAfter?.[1] })}</span>
          </div>` : ''}
          <div class="wiki-row">
            <a class="wiki-link"
               href="https://pl.wikipedia.org/wiki/${encodeURIComponent(m.latin.replace(/ /g,'_'))}"
               target="_blank" rel="noopener noreferrer"
               onclick="event.stopPropagation()"
               title="${m.latin}">
              <svg class="wiki-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8 5 8h-4v4h-2z"/>
              </svg>
              ${t('wikiLinkText', { latin: m.latin })}
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
          <strong>${t('meadowBannerTitle')}</strong>
          <span>${t('meadowBannerDesc')}</span>
        </div>
      </div>
    `;
  }
  if (edible.length)  html += `<div class="mushroom-group-label">${t('mushroomGroupEdible', { count: edible.length })}</div>${renderGroup(edible, 40)}`;
  if (caution.length) html += `<div class="mushroom-group-label warn">${t('mushroomGroupCaution', { count: caution.length })}</div>${renderGroup(caution, 15)}`;
  if (toxic.length)   html += `<div class="mushroom-group-label danger">${t('mushroomGroupToxic', { count: toxic.length })}</div>${renderGroup(toxic, 15)}`;

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
  if (e.code === 1) return t('gpsErr1');
  if (e.code === 2) return t('gpsErr2');
  if (e.code === 3) return t('gpsErr3');
  return t('gpsErrUnknown', { msg: e.message || 'unknown' });
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
    setStatus(t('heatmapNeedWeather'), 'info');
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
  const legend = $('trails-legend');
  if (legend) legend.classList.toggle('hidden', !trailsVisible);
}
