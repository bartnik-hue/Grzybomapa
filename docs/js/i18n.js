/**
 * i18n.js
 * GrzyboMapa Internationalization Module
 * Supported languages:
 *  - pl: Polski (Polish)
 *  - en: English
 *  - de: Deutsch (German)
 *  - uk: Українська (Ukrainian)
 *  - sk: Slovenčina (Slovak)
 *  - cs: Čeština (Czech)
 *  - lt: Lietuvių (Lithuanian)
 */

export const LANGUAGES = {
  pl: { code: 'pl', name: 'Polski', flag: '🇵🇱', locale: 'pl-PL' },
  en: { code: 'en', name: 'English', flag: '🇬🇧', locale: 'en-US' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪', locale: 'de-DE' },
  uk: { code: 'uk', name: 'Українська', flag: '🇺🇦', locale: 'uk-UA' },
  sk: { code: 'sk', name: 'Slovenčina', flag: '🇸🇰', locale: 'sk-SK' },
  cs: { code: 'cs', name: 'Čeština', flag: '🇨🇿', locale: 'cs-CZ' },
  lt: { code: 'lt', name: 'Lietuvių', flag: '🇱🇹', locale: 'lt-LT' },
};

const STORAGE_KEY = 'grzybomap_lang';
const listeners = [];

/**
 * Detect initial language
 */
function detectLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANGUAGES[saved]) return saved;
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined') {
      const navLangs = navigator.languages || [navigator.language || ''];
      for (const nl of navLangs) {
        const code = (nl || '').slice(0, 2).toLowerCase();
        if (LANGUAGES[code]) return code;
      }
    }
  } catch {}

  return 'pl';
}

let currentLang = detectLanguage();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!LANGUAGES[lang] || lang === currentLang) return;
  currentLang = lang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {}
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  listeners.forEach(fn => {
    try { fn(currentLang); } catch (e) { console.error('[i18n] listener error:', e); }
  });
}

export function onLanguageChange(fn) {
  listeners.push(fn);
}

// ─────────────────────────────────────────────────────────────────
// TRANSLATION STRINGS
// ─────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  pl: {
    appTitle: 'GrzyboMapa 🍄 – Pomocnik Zbieracza',
    appSub: 'Twój leśny kompas',
    btnTreeSpecies: 'Gatunki drzew',
    btnTreeSpeciesTitle: 'Gatunki drzewostanu BDL (liściaste, iglaste, mieszane)',
    btnHeatmap: 'Szanse',
    btnHeatmapTitle: 'Mapa cieplna warunków grzybobrania',
    btnTrails: 'Ścieżki',
    btnTrailsTitle: 'Szlaki turystyczne i ścieżki leśne LP',
    btnPin: 'Próbnik',
    btnPinTitle: 'Próbnik Terenu — postaw lub przesuń pinezkę',
    btnGps: 'GPS',
    btnGpsTitle: 'Lokalizator GPS na żywo',
    btnRefresh: 'Odśwież dane',
    btnClosePanel: 'Zamknij panel',
    fabShowResults: '🍄 Pokaż wyniki',
    pinHint: '👆 Kliknij w dowolne miejsce na mapie',
    pinMarkerTitle: 'Próbnik: przeciągnij lub kliknij, aby zbadać to miejsce',

    // Status bar & GPS
    gpsFetching: 'Pobieranie lokalizacji GPS…',
    forestDetecting: 'Wykrywanie lasu…',
    gpsErr1: 'Brak zgody na lokalizację. Włącz GPS w ustawieniach.',
    gpsErr2: 'Nie można określić lokalizacji. Sprawdź GPS.',
    gpsErr3: 'Przekroczono czas oczekiwania na GPS.',
    gpsErrUnknown: 'Błąd GPS: {msg}',
    dataFetchError: 'Błąd pobierania danych. Sprawdź połączenie.',
    heatmapNeedWeather: 'Najpierw załaduj lokalizację — heatmapa potrzebuje danych pogodowych',
    urbanStatusWarn: 'Teren zabudowany / miasto — brak lasu i grzybów.',
    waterStatusWarn: 'Zbiornik / ciek wodny — brak lasu.',
    meadowStatusWarn: 'Teren otwarty / łąka — brak lasu (wykluczono grzyby leśne).',

    // Heatmap legend
    heatmapTitle: '🌡️ Warunki grzybobrania',
    heatmapLo: 'Niekorzystne',
    heatmapHi: 'Idealne',
    heatmapFormula: 'Teren × Pogoda × Sezon',
    heatmapPromptLoc: 'ustaw lokalizację aby aktywować',
    heatmapCalcDone: 'Obliczanie warunków zakończone',
    heatmapFetching: 'Pobieranie wydzieleń leśnych i rzeźby terenu…',
    heatmapLpCount: '🌲 {count} wydzieleń LP',
    heatmapOsmLpCount: '🌲 Lasy poza ewidencją LP',
    heatmapOsmAdded: ' + lasy OSM (szacunek)',
    heatmapStatusText: '{temp}°C nocą · {rain}mm/14d · {days}d po deszczu · {status}',

    // Forest type legend
    ftlTitle: '🌿 Typ drzewostanu',
    ftlDeciduous: '🌳 Liściaste',
    ftlConiferous: '🌲 Iglaste',
    ftlMixed: '🌿 Mieszane',
    ftlNote: 'Dane BDL LP · Przybliż mapę (>zoom 11)',

    // Trails legend
    trailsTitle: '🥾 Szlaki i ścieżki leśne',
    trailsLines: 'Linie i oddziały LP (dukty)',
    trailsHiking: 'Szlaki turystyczne PTTK',
    trailsDidactic: 'Ścieżki dydaktyczne',
    trailsHorse: 'Ścieżki konne',
    trailsNote: 'Dane: BDL Lasy Państwowe · Waymarked Trails',

    // Panel
    panelTitleSampler: '📌 Próbnik Terenu',
    panelSubSample: '📍 Próbka: {coords}',
    panelTitleGps: '📡 Analiza GPS (Na Żywo)',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Lokalizacja na żywo',
    pointOnMap: 'Wskaż punkt na mapie',

    secForestTitle: '🌲 Informacje o lesie',
    secWeatherTitle: '🌦️ Warunki pogodowe',
    secScoreTitle: '📊 Ocena warunków',
    secMushroomsTitle: '🍄 Spodziewane gatunki',

    forestEmptyNotice: 'Nie jesteś w lesie państwowym lub brak zasięgu API.<br><small>Dane LP dostępne tylko w lasach zarządzanych przez Lasy Państwowe.</small>',
    forestEmptyPrompt: 'Kliknij przycisk lokalizacji, aby wykryć las i sprawdzić warunki do grzybobrania.',
    badgePin: '📌 Próbka ręczna',
    badgeGps: '📡 GPS na żywo',
    badgeLp: 'Lasy Państwowe (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Brak danych LP (dane szacunkowe)',

    terrainUrban: 'Teren miejski / zabudowany',
    terrainWater: 'Zbiornik / Ciek wodny',
    terrainMeadow: 'Teren otwarty / Łąka',
    statusExcluded: 'Wyłączony ze zbiorów',
    statusNonForest: 'Teren niezalesiony',
    statusTerrLabel: 'Status terenu:',

    terrainUrbanDesc: 'Obszar zurbanizowany (miasto / wieś zabudowana) — wyłączony ze zbiorów leśnych. Brak naturalnej ściółki i leśnych partnerów mikoryzowych. Na miejskich skwerach rzadko rosną pieczarki miejskie czy czernidłaki, lecz ich zbiór w miastach jest odradzany ze względu na zanieczyszczenia i metale ciężkie.',
    terrainWaterDesc: 'Akwen lub teren stale podmokły — brak warunków do wzrostu grzybów naziemnych.',
    terrainMeadowDesc: 'Brak drzew leśnych wyklucza grzyby mikoryzowe (borowiki, podgrzybki, maślaki, kurki, rydze). W tym miejscu rosnąć mogą wyłącznie wybrane saprotrofy łąkowe (np. pieczarki, czasznice, twardzioszki).',

    compositionTitle: 'Skład drzewostanu',
    compositionApproxTitle: 'Przypuszczalny skład drzewostanu',
    compositionNoData: 'Brak danych o szczegółowym składzie',
    chipAge: '🌱 Wiek: <strong>{age}</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Poza ewidencją Lasów Państwowych',

    approxNoticeTitle: '🌲 Brak danych urzędowych na temat tego lasu:',
    approxNoticeNationalPark: 'Teren leży w granicach Parku Narodowego (poza ewidencją Lasów Państwowych).',
    approxNoticeOsm: 'Teren stanowi las według mapy OpenStreetMap (las prywatny, komunalny lub zadrzewienie), lecz nie posiada ewidencji LP ani planu urządzania lasu.',
    approxNoticeSpecies: 'Przypuszczalnie występują tu gatunki grzybów:',
    approxNoticeDesc: 'Lokalne warunki i typowe zadrzewienie sprzyjają takim grzybom jak: <em>Borowik szlachetny, Podgrzybek brunatny, Pieprznik jadalny (Kurka), Koźlarz, Maślak oraz Czubajka kania</em>. Indeks zbiorów obliczono przypuszczalnie na bazie wilgotności gleby, opadów i mikroklimatu.',

    // Weather
    weatherNoData: 'Brak danych — włącz lokalizację',
    weatherStatsNoData: 'Brak danych pogodowych',
    statRain14: 'Deszcz 14 dni',
    statAvgTemp: 'Śr. temperatura',
    statLastRain: 'Ostatni deszcz',
    statDrought: 'Susza',
    daysAgo: '{n} dni temu',
    today: 'Dziś',
    daysUnit: '{n} dni',
    forecastTitle: '📅 Prognoza 7-dniowa & Szanse na grzyby',
    forecastSub: 'Model wzrostu grzybni: opad × bilans wilgoci × temperatura',

    // Diagnosis & Scores
    scoreNoData: 'Brak danych',
    scoreSummaryPrompt: 'Włącz lokalizację GPS, aby otrzymać ocenę warunków do grzybobrania w Twoim lesie.',
    diagnosisHeader: '🔍 Dlaczego taki wynik w tym punkcie?',
    diagnosisTacticalTipTitle: 'Wskazówka taktyczna:',
    diagnosisTacticalTipText: 'Heatmapa na mapie odzwierciedla wiek i gatunki poszczególnych wydzieleń LP. Jeśli jesteś w młodej uprawie lub suchym borze, przejdź kilkaset metrów do sąsiedniego starodrzewu (40–100 lat) na siedlisku świeżym (BŚW/BMŚW).',

    // Mushrooms list
    mushroomGroupEdible: '🍄 Jadalne ({count})',
    mushroomGroupCaution: '⚠️ Uwaga / niejadalne ({count})',
    mushroomGroupToxic: '☠️ Trujące — ostrzeżenie ({count})',
    mushroomsEmptyList: 'Brak grzybów dla tego terenu w obecnym sezonie.<br><small>Wybierz inny punkt w lesie lub na łące, aby zobaczyć dopasowane gatunki.</small>',
    meadowBannerTitle: 'Teren otwarty / łąka (brak lasu)',
    meadowBannerDesc: 'Wykluczono wszystkie grzyby mikoryzowe (borowiki, kurki, maślaki, podgrzybki). Poniżej prezentowane są wyłącznie gatunki łąkowe, trawiaste i saprotrofy przydrożne.',
    dangerWarning: '⚠️ Ten gatunek jest śmiertelnie niebezpieczny!',
    ecoWhyTitle: '🔍 Dlaczego ten grzyb w tym wydzieleniu?',
    ecoTrees: 'Drzewa / Podłoże:',
    ecoAge: 'Wiek drzewostanu:',
    ecoHabitat: 'Siedlisko:',
    scTree: '🌳 Drzewostan',
    scSeason: '📅 Sezon',
    scWeather: '🌦️ Pogoda',
    scPrevalence: '🌏 Pospolitość',
    daysAfterRain: '+{min}–{max} dni po deszczu',
    wikiLinkText: 'Wikipedia — {latin}',
    footerNote: 'Dane: Lasy Państwowe BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Nigdy nie jedz grzyba bez 100% pewności co do gatunku.',

    // Labels
    labelEdible: 'Jadalne',
    labelToxic: 'Trujący!',
    labelInedible: 'Niejadalne',
    labelCaution: 'Uwaga!',
    scoreHigh: 'Wysokie',
    scoreModerate: 'Umiarkowane',
    scoreLow: 'Niskie',
    scoreVeryLow: 'Bardzo niskie',
    scorePoor: 'Fatalne',
    saprotroph: 'Saprotrof',
    meadowSaprotroph: 'Saprotrof łąkowy',
    mycorrhizalPartner: 'partner mikoryzowy',
  },

  en: {
    appTitle: 'GrzyboMapa 🍄 – Foraging Assistant',
    appSub: 'Your forest compass',
    btnTreeSpecies: 'Tree species',
    btnTreeSpeciesTitle: 'Forest tree species (broadleaved, coniferous, mixed)',
    btnHeatmap: 'Chances',
    btnHeatmapTitle: 'Mushroom foraging conditions heatmap',
    btnTrails: 'Trails',
    btnTrailsTitle: 'Hiking trails and forest paths',
    btnPin: 'Sampler',
    btnPinTitle: 'Terrain Sampler — drop or move pin',
    btnGps: 'GPS',
    btnGpsTitle: 'Live GPS location',
    btnRefresh: 'Refresh data',
    btnClosePanel: 'Close panel',
    fabShowResults: '🍄 Show results',
    pinHint: '👆 Click anywhere on the map',
    pinMarkerTitle: 'Sampler: drag or click to inspect this spot',

    gpsFetching: 'Acquiring GPS location…',
    forestDetecting: 'Detecting forest stand…',
    gpsErr1: 'Location permission denied. Enable GPS in settings.',
    gpsErr2: 'Unable to determine location. Check GPS.',
    gpsErr3: 'GPS request timed out.',
    gpsErrUnknown: 'GPS error: {msg}',
    dataFetchError: 'Failed to fetch data. Check connection.',
    heatmapNeedWeather: 'Load location first — heatmap requires weather data',
    urbanStatusWarn: 'Urban / built-up area — no forest or wild mushrooms.',
    waterStatusWarn: 'Water body — no mushrooms.',
    meadowStatusWarn: 'Open ground / meadow — forest mycorrhizal mushrooms excluded.',

    heatmapTitle: '🌡️ Mushroom Conditions',
    heatmapLo: 'Unfavorable',
    heatmapHi: 'Optimal',
    heatmapFormula: 'Terrain × Weather × Season',
    heatmapPromptLoc: 'set location to activate',
    heatmapCalcDone: 'Conditions calculation completed',
    heatmapFetching: 'Fetching forest polygons and terrain elevation…',
    heatmapLpCount: '🌲 {count} forest stands',
    heatmapOsmLpCount: '🌲 Forests outside State registry',
    heatmapOsmAdded: ' + OSM forests (estimated)',
    heatmapStatusText: '{temp}°C night · {rain}mm/14d · {days}d after rain · {status}',

    ftlTitle: '🌿 Stand Type',
    ftlDeciduous: '🌳 Broadleaved',
    ftlConiferous: '🌲 Coniferous',
    ftlMixed: '🌿 Mixed',
    ftlNote: 'Forest data · Zoom in (>zoom 11)',

    trailsTitle: '🥾 Forest Trails & Paths',
    trailsLines: 'Forest compartments & tracks',
    trailsHiking: 'Marked tourist trails',
    trailsDidactic: 'Nature educational trails',
    trailsHorse: 'Bridleways (horse trails)',
    trailsNote: 'Data: State Forests BDL · Waymarked Trails',

    panelTitleSampler: '📌 Terrain Sampler',
    panelSubSample: '📍 Sample: {coords}',
    panelTitleGps: '📡 Live GPS Analysis',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Live GPS location',
    pointOnMap: 'Point on the map',

    secForestTitle: '🌲 Forest Information',
    secWeatherTitle: '🌦️ Weather Conditions',
    secScoreTitle: '📊 Conditions Evaluation',
    secMushroomsTitle: '🍄 Expected Species',

    forestEmptyNotice: 'You are outside a registered forest or API range.<br><small>Forest data is only available for managed forestry areas.</small>',
    forestEmptyPrompt: 'Click the location button to detect the forest and check mushroom picking conditions.',
    badgePin: '📌 Manual sample',
    badgeGps: '📡 Live GPS',
    badgeLp: 'State Forests (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ No official registry data (estimated)',

    terrainUrban: 'Urban / Built-up area',
    terrainWater: 'Water body / River',
    terrainMeadow: 'Open ground / Meadow',
    statusExcluded: 'Excluded from foraging',
    statusNonForest: 'Non-forested area',
    statusTerrLabel: 'Terrain status:',

    terrainUrbanDesc: 'Urbanized zone (city / built-up village) — excluded from wild foraging. Absence of natural forest floor and tree mycorrhizal partners. Foraging in cities is strongly discouraged due to heavy metals and road pollution.',
    terrainWaterDesc: 'Water reservoir or flooded area — no terrestrial mushrooms grow here.',
    terrainMeadowDesc: 'Lack of forest trees excludes mycorrhizal mushrooms (porcini, bay boletes, chanterelles). Only meadow saprotrophs (e.g. field mushrooms, giant puffballs, fairy ring mushrooms) can fruit here.',

    compositionTitle: 'Tree stand composition',
    compositionApproxTitle: 'Estimated stand composition',
    compositionNoData: 'No detailed tree species data',
    chipAge: '🌱 Age: <strong>{age} yrs</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Outside State Forest registry',

    approxNoticeTitle: '🌲 No official forestry inventory for this area:',
    approxNoticeNationalPark: 'This area is located within a National Park (nature reserve rules apply).',
    approxNoticeOsm: 'Identified as forest in OpenStreetMap, but has no official State Forest management plan.',
    approxNoticeSpecies: 'Likely occurring mushroom species:',
    approxNoticeDesc: 'Local habitat and tree cover typically support: <em>King bolete (porcini), Bay bolete, Chanterelle, Birch bolete, Slippery jack, and Parasol mushroom</em>. Index calculated from soil moisture, rain, and microclimate.',

    weatherNoData: 'No data — turn on location',
    weatherStatsNoData: 'No weather data available',
    statRain14: '14-day rain',
    statAvgTemp: 'Avg temperature',
    statLastRain: 'Last rain',
    statDrought: 'Drought',
    daysAgo: '{n} days ago',
    today: 'Today',
    daysUnit: '{n} days',
    forecastTitle: '📅 7-Day Forecast & Mushroom Chances',
    forecastSub: 'Mycelium growth model: rain × moisture balance × temperature',

    scoreNoData: 'No data',
    scoreSummaryPrompt: 'Turn on GPS to evaluate mushroom foraging conditions in your forest.',
    diagnosisHeader: '🔍 Why this score at this location?',
    diagnosisTacticalTipTitle: 'Tactical tip:',
    diagnosisTacticalTipText: 'The map heatmap reflects the age and species of individual forest stands. If you are in young plantation or dry pine heath, move a few hundred meters to adjacent mature forest (40–100 years) on fresh soil.',

    mushroomGroupEdible: '🍄 Edible ({count})',
    mushroomGroupCaution: '⚠️ Caution / Inedible ({count})',
    mushroomGroupToxic: '☠️ Poisonous — Warning ({count})',
    mushroomsEmptyList: 'No matching mushrooms for this area in current season.<br><small>Select another location in the forest or meadow.</small>',
    meadowBannerTitle: 'Open land / meadow (no forest)',
    meadowBannerDesc: 'All mycorrhizal woodland mushrooms (boletes, chanterelles) are excluded. Only meadow saprotrophs and grass species are shown.',
    dangerWarning: '⚠️ This species is deadly poisonous!',
    ecoWhyTitle: '🔍 Why this mushroom in this stand?',
    ecoTrees: 'Trees / Substrate:',
    ecoAge: 'Stand age:',
    ecoHabitat: 'Habitat:',
    scTree: '🌳 Tree stand',
    scSeason: '📅 Season',
    scWeather: '🌦️ Weather',
    scPrevalence: '🌏 Abundance',
    daysAfterRain: '+{min}–{max} days after rain',
    wikiLinkText: 'Wikipedia — {latin}',
    footerNote: 'Data: State Forests BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Never consume a mushroom without 100% positive identification.',

    labelEdible: 'Edible',
    labelToxic: 'Poisonous!',
    labelInedible: 'Inedible',
    labelCaution: 'Caution!',
    scoreHigh: 'High',
    scoreModerate: 'Moderate',
    scoreLow: 'Low',
    scoreVeryLow: 'Very low',
    scorePoor: 'Poor',
    saprotroph: 'Saprotroph',
    meadowSaprotroph: 'Meadow saprotroph',
    mycorrhizalPartner: 'mycorrhizal partner',
  },

  de: {
    appTitle: 'GrzyboMapa 🍄 – Pilzsammler-Assistent',
    appSub: 'Dein Waldkompass',
    btnTreeSpecies: 'Baumarten',
    btnTreeSpeciesTitle: 'Waldbestand-Baumarten (Laub-, Nadel-, Mischwald)',
    btnHeatmap: 'Chancen',
    btnHeatmapTitle: 'Wärmekarte der Pilzsammler-Bedingungen',
    btnTrails: 'Wege',
    btnTrailsTitle: 'Wanderwege und Waldpfade',
    btnPin: 'Probenehmer',
    btnPinTitle: 'Geländeprobenehmer — Stecknadel setzen oder ziehen',
    btnGps: 'GPS',
    btnGpsTitle: 'Live-GPS-Standort',
    btnRefresh: 'Daten aktualisieren',
    btnClosePanel: 'Panel schließen',
    fabShowResults: '🍄 Ergebnisse anzeigen',
    pinHint: '👆 Klicke an eine beliebige Stelle auf der Karte',
    pinMarkerTitle: 'Probenehmer: ziehen oder klicken zum Prüfen',

    gpsFetching: 'GPS-Standort wird ermittelt…',
    forestDetecting: 'Waldbestand wird analysiert…',
    gpsErr1: 'Standortzugriff verweigert. GPS in den Einstellungen aktivieren.',
    gpsErr2: 'Standort konnte nicht ermittelt werden. GPS prüfen.',
    gpsErr3: 'GPS-Zeitüberschreitung.',
    gpsErrUnknown: 'GPS-Fehler: {msg}',
    dataFetchError: 'Fehler beim Laden der Daten. Verbindung prüfen.',
    heatmapNeedWeather: 'Zuerst Standort laden — Heatmap benötigt Wetterdaten',
    urbanStatusWarn: 'Siedlungsgebiet / Stadt — kein Wald und keine Speisepilze.',
    waterStatusWarn: 'Gewässer — keine Pilze.',
    meadowStatusWarn: 'Offenes Gelände / Wiese — Waldpilze ausgeschlossen.',

    heatmapTitle: '🌡️ Pilzwachstums-Bedingungen',
    heatmapLo: 'Ungünstig',
    heatmapHi: 'Ideal',
    heatmapFormula: 'Gelände × Wetter × Saison',
    heatmapPromptLoc: 'Standort festlegen zum Aktivieren',
    heatmapCalcDone: 'Berechnung abgeschlossen',
    heatmapFetching: 'Lade Waldbestände und Geländerelief…',
    heatmapLpCount: '🌲 {count} Waldbestände',
    heatmapOsmLpCount: '🌲 Wälder außerhalb des Staatsregisters',
    heatmapOsmAdded: ' + OSM-Wälder (Schätzung)',
    heatmapStatusText: '{temp}°C nachts · {rain}mm/14T · {days}T nach Regen · {status}',

    ftlTitle: '🌿 Bestandesart',
    ftlDeciduous: '🌳 Laubwald',
    ftlConiferous: '🌲 Nadelwald',
    ftlMixed: '🌿 Mischwald',
    ftlNote: 'Wald-Daten · Karte vergrößern (>Zoom 11)',

    trailsTitle: '🥾 Waldwege & Pfade',
    trailsLines: 'Waldabteilungen & Schneisen',
    trailsHiking: 'Markierte Wanderwege',
    trailsDidactic: 'Lehrpfade',
    trailsHorse: 'Reitwege',
    trailsNote: 'Daten: Staatsforsten BDL · Waymarked Trails',

    panelTitleSampler: '📌 Geländeprobenehmer',
    panelSubSample: '📍 Probe: {coords}',
    panelTitleGps: '📡 Live-GPS-Analyse',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Live-Standort',
    pointOnMap: 'Punkt auf der Karte wählen',

    secForestTitle: '🌲 Waldinformationen',
    secWeatherTitle: '🌦️ Wetterbedingungen',
    secScoreTitle: '📊 Bewertung der Bedingungen',
    secMushroomsTitle: '🍄 Erwartete Arten',

    forestEmptyNotice: 'Sie befinden sich außerhalb eines registrierten Waldes.<br><small>Forstdaten sind nur für verwaltete Waldgebiete verfügbar.</small>',
    forestEmptyPrompt: 'Klicken Sie auf den Standort-Button, um den Wald und die Bedingungen zu prüfen.',
    badgePin: '📌 Manuelle Probe',
    badgeGps: '📡 Live-GPS',
    badgeLp: 'Staatsforsten (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Keine offiziellen Forstdaten (geschätzt)',

    terrainUrban: 'Städtisches / bebautes Gebiet',
    terrainWater: 'Gewässer / Fluss',
    terrainMeadow: 'Offenes Gelände / Wiese',
    statusExcluded: 'Vom Sammeln ausgeschlossen',
    statusNonForest: 'Nicht bewaldetes Gebiet',
    statusTerrLabel: 'Geländestatus:',

    terrainUrbanDesc: 'Städtischer Bereich — vom Pilzsammeln ausgeschlossen. Keine natürliche Waldstreu und Mykorrhiza-Partner. Pilze in Städten sammeln ist wegen Schwermetall- und Abgasbelastung streng abzuraten.',
    terrainWaterDesc: 'Gewässer oder überflutetes Gebiet — keine Bodenpilze.',
    terrainMeadowDesc: 'Fehlende Waldbäume schließen Mykorrhizapilze (Steinpilze, Maronen, Pfifferlinge) aus. Nur Wiesensaprotrope (z. B. Champignons, Riesenboviste) können hier wachsen.',

    compositionTitle: 'Baumbestand',
    compositionApproxTitle: 'Geschätzter Baumbestand',
    compositionNoData: 'Keine detaillierten Baumartendaten',
    chipAge: '🌱 Alter: <strong>{age} J.</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Außerhalb des Staatsforst-Registers',

    approxNoticeTitle: '🌲 Keine amtlichen Forstdaten für diesen Wald:',
    approxNoticeNationalPark: 'Gebiet liegt in einem Nationalpark (Naturschutzbestimmungen beachten).',
    approxNoticeOsm: 'In OpenStreetMap als Wald verzeichnet, aber ohne forstwirtschaftliche Erfassung.',
    approxNoticeSpecies: 'Wahrscheinlich vorkommende Pilzarten:',
    approxNoticeDesc: 'Lokale Bedingungen und Baumbestand begünstigen: <em>Steinpilz, Maronen-Röhrling, Echter Pfifferling, Birkenpilz, Butterpilz und Parasol</em>. Index basiert auf Bodenfeuchte und Wetter.',

    weatherNoData: 'Keine Daten — Standort aktivieren',
    weatherStatsNoData: 'Keine Wetterdaten verfügbar',
    statRain14: 'Regen 14 Tage',
    statAvgTemp: 'Durchschn. Temp.',
    statLastRain: 'Letzter Regen',
    statDrought: 'Trockenheit',
    daysAgo: 'vor {n} Tagen',
    today: 'Heute',
    daysUnit: '{n} Tage',
    forecastTitle: '📅 7-Tage-Prognose & Pilzchancen',
    forecastSub: 'Myzelwachstumsmodell: Niederschlag × Feuchtebilanz × Temperatur',

    scoreNoData: 'Keine Daten',
    scoreSummaryPrompt: 'GPS aktivieren, um Pilzbedingungen im Wald zu bewerten.',
    diagnosisHeader: '🔍 Warum dieses Ergebnis an diesem Punkt?',
    diagnosisTacticalTipTitle: 'Taktischer Tipp:',
    diagnosisTacticalTipText: 'Die Wärmekarte spiegelt Alter und Baumarten wider. Wenn Sie sich in einer Schonung oder trockenem Kiefernwald befinden, wechseln Sie in benachbarten Altholzbestand (40–100 Jahre) auf frischem Standort.',

    mushroomGroupEdible: '🍄 Essbar ({count})',
    mushroomGroupCaution: '⚠️ Achtung / Ungenießbar ({count})',
    mushroomGroupToxic: '☠️ Giftig — Warnung ({count})',
    mushroomsEmptyList: 'Keine passenden Pilzarten in dieser Saison.<br><small>Wählen Sie einen anderen Punkt im Wald oder auf der Wiese.</small>',
    meadowBannerTitle: 'Offenes Land / Wiese (kein Wald)',
    meadowBannerDesc: 'Alle Wald-Mykorrhizapilze (Steinpilze, Pfifferlinge) sind ausgeschlossen. Nur Wiesensaprotrope werden angezeigt.',
    dangerWarning: '⚠️ Diese Art ist tödlich giftig!',
    ecoWhyTitle: '🔍 Warum dieser Pilz in diesem Bestand?',
    ecoTrees: 'Bäume / Substrat:',
    ecoAge: 'Bestandesalter:',
    ecoHabitat: 'Standorttyp:',
    scTree: '🌳 Baumbestand',
    scSeason: '📅 Saison',
    scWeather: '🌦️ Wetter',
    scPrevalence: '🌏 Häufigkeit',
    daysAfterRain: '+{min}–{max} Tage nach Regen',
    wikiLinkText: 'Wikipedia — {latin}',
    footerNote: 'Daten: Staatsforsten BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Essen Sie niemals einen Pilz ohne 100%ige Sicherheit über die Art.',

    labelEdible: 'Essbar',
    labelToxic: 'Giftig!',
    labelInedible: 'Ungenießbar',
    labelCaution: 'Achtung!',
    scoreHigh: 'Hoch',
    scoreModerate: 'Mäßig',
    scoreLow: 'Niedrig',
    scoreVeryLow: 'Sehr niedrig',
    scorePoor: 'Schlecht',
    saprotroph: 'Saprotroph',
    meadowSaprotroph: 'Wiesensaprotroph',
    mycorrhizalPartner: 'Mykorrhizapartner',
  },

  uk: {
    appTitle: 'GrzyboMapa 🍄 – Помічник Грибника',
    appSub: 'Твій лісовий компас',
    btnTreeSpecies: 'Види дерев',
    btnTreeSpeciesTitle: 'Види дерев лісостану (листяні, хвойні, мішані)',
    btnHeatmap: 'Шанси',
    btnHeatmapTitle: 'Теплова карта умов для збору грибів',
    btnTrails: 'Стежки',
    btnTrailsTitle: 'Туристичні стежки та лісові дороги',
    btnPin: 'Пробник',
    btnPinTitle: 'Пробник місцевості — поставте або пересуньте шпильку',
    btnGps: 'GPS',
    btnGpsTitle: 'GPS у реальному часі',
    btnRefresh: 'Оновити дані',
    btnClosePanel: 'Закрити панель',
    fabShowResults: '🍄 Показати результати',
    pinHint: '👆 Клацніть у будь-якому місці карти',
    pinMarkerTitle: 'Пробник: перетягніть або клацніть для аналізу',

    gpsFetching: 'Отримання координат GPS…',
    forestDetecting: 'Визначення лісостану…',
    gpsErr1: 'Немає дозволу на геолокацію. Увімкніть GPS у налаштуваннях.',
    gpsErr2: 'Неможливо визначити місцезнаходження. Перевірте GPS.',
    gpsErr3: 'Час очікування GPS вичерпано.',
    gpsErrUnknown: 'Помилка GPS: {msg}',
    dataFetchError: 'Помилка завантаження даних. Перевірте інтернет.',
    heatmapNeedWeather: 'Спочатку вкажіть місце — карті потрібні дані погоди',
    urbanStatusWarn: 'Забудова / місто — ліс та гриби відсутні.',
    waterStatusWarn: 'Водойма — ліс відсутній.',
    meadowStatusWarn: 'Відкрита місцевість / луг — лісові гриби виключено.',

    heatmapTitle: '🌡️ Умови для грибів',
    heatmapLo: 'Несприятливі',
    heatmapHi: 'Ідеальні',
    heatmapFormula: 'Місцевість × Погода × Сезон',
    heatmapPromptLoc: 'встановіть локацію для активації',
    heatmapCalcDone: 'Розрахунок завершено',
    heatmapFetching: 'Завантаження виділів лісу та рельєфу…',
    heatmapLpCount: '🌲 {count} лісових ділянок',
    heatmapOsmLpCount: '🌲 Ліси поза держреєстром',
    heatmapOsmAdded: ' + ліси OSM (оцінка)',
    heatmapStatusText: '{temp}°C вночі · {rain}мм/14д · {days}д після дощу · {status}',

    ftlTitle: '🌿 Тип деревостану',
    ftlDeciduous: '🌳 Листяні',
    ftlConiferous: '🌲 Хвойні',
    ftlMixed: '🌿 Мішані',
    ftlNote: 'Дані лісівництва · Збільште карту (>zoom 11)',

    trailsTitle: '🥾 Стежки та лісові дороги',
    trailsLines: 'Лісові квартали та просіки',
    trailsHiking: 'Марковані туристичні стежки',
    trailsDidactic: 'Екологічні стежки',
    trailsHorse: 'Кінні стежки',
    trailsNote: 'Дані: Держліси BDL · Waymarked Trails',

    panelTitleSampler: '📌 Пробник Місцевості',
    panelSubSample: '📍 Проба: {coords}',
    panelTitleGps: '📡 GPS Аналіз (Наживо)',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Локація наживо',
    pointOnMap: 'Вкажіть точку на карті',

    secForestTitle: '🌲 Інформація про ліс',
    secWeatherTitle: '🌦️ Погодні умови',
    secScoreTitle: '📊 Оцінка умов',
    secMushroomsTitle: '🍄 Очікувані види',

    forestEmptyNotice: 'Ви перебуваєте поза межами державного лісу.<br><small>Дані доступні лише для облікованих лісових масивів.</small>',
    forestEmptyPrompt: 'Натисніть кнопку геолокації, щоб визначити ліс і перевірити умови для грибів.',
    badgePin: '📌 Ручний вибір',
    badgeGps: '📡 GPS наживо',
    badgeLp: 'Державні ліси (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Без держреєстру (оцінка)',

    terrainUrban: 'Міська / забудована зона',
    terrainWater: 'Водойма / річка',
    terrainMeadow: 'Відкрита місцевість / луг',
    statusExcluded: 'Збір неможливий',
    statusNonForest: 'Нелісиста місцевість',
    statusTerrLabel: 'Статус території:',

    terrainUrbanDesc: 'Урбанізована зона — виключена зі збору лісових грибів. Відсутня лісова підстилка і мікориза. Збирання грибів у містах небезпечне через накопичення важких металів.',
    terrainWaterDesc: 'Акваторія або затоплена зона — наземні гриби не ростуть.',
    terrainMeadowDesc: 'Відсутність дерев виключає мікоризні гриби (білі, польські, лисички, маслюки). Можливі лише лучні сапротрофи (печериці, дощовики).',

    compositionTitle: 'Склад деревостану',
    compositionApproxTitle: 'Ймовірний склад деревостану',
    compositionNoData: 'Немає детальних даних про склад порід',
    chipAge: '🌱 Вік: <strong>{age} р.</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Поза держреєстром лісів',

    approxNoticeTitle: '🌲 Відсутні офіційні дані про цей ліс:',
    approxNoticeNationalPark: 'Територія в межах Національного парку (діють заповідні обмеження).',
    approxNoticeOsm: 'Ліс за даними OpenStreetMap (приватний або комунальний), без планів лісовпорядкування.',
    approxNoticeSpecies: 'Ймовірні види грибів:',
    approxNoticeDesc: 'Умови та породний склад сприятливі для: <em>Білий гриб, Польський гриб, Лисичка справжня, Підберезовик, Маслюк та Гриб-зонтик</em>. Індекс розраховано за вологістю ґрунту і мікрокліматом.',

    weatherNoData: 'Немає даних — увімкніть GPS',
    weatherStatsNoData: 'Погодні дані відсутні',
    statRain14: 'Дощ 14 днів',
    statAvgTemp: 'Сер. температура',
    statLastRain: 'Останній дощ',
    statDrought: 'Посуха',
    daysAgo: '{n} дн. тому',
    today: 'Сьогодні',
    daysUnit: '{n} дн.',
    forecastTitle: '📅 7-денний прогноз і шанси на гриби',
    forecastSub: 'Модель росту грибниці: опади × баланс вологи × температура',

    scoreNoData: 'Немає даних',
    scoreSummaryPrompt: 'Увімкніть GPS для оцінки умов збору грибів у вашому лісі.',
    diagnosisHeader: '🔍 Чому такий результат у цій точці?',
    diagnosisTacticalTipTitle: 'Тактична порада:',
    diagnosisTacticalTipText: 'Теплова карта показує вік і породи виділів. Якщо ви в молодій посадці чи сухому бору, перейдіть на кількасот метрів до сусіднього дорослого лісу (40–100 років) на свіжому ґрунті.',

    mushroomGroupEdible: '🍄 Їстівні ({count})',
    mushroomGroupCaution: '⚠️ Увага / Неїстівні ({count})',
    mushroomGroupToxic: '☠️ Отруйні — попередження ({count})',
    mushroomsEmptyList: 'Немає відповідних грибів для цієї зони у поточному сезоні.<br><small>Оберіть іншу точку в лісі або на лузі.</small>',
    meadowBannerTitle: 'Відкрита місцевість / луг (без лісу)',
    meadowBannerDesc: 'Усі лісові мікоризні гриби (боровики, лисички) виключено. Показано лише лучні види та сапротрофи.',
    dangerWarning: '⚠️ Цей вид смертельно небезпечний!',
    ecoWhyTitle: '🔍 Чому цей гриб у цьому лісостані?',
    ecoTrees: 'Дерева / Субстрат:',
    ecoAge: 'Вік деревостану:',
    ecoHabitat: 'Тип оселища:',
    scTree: '🌳 Деревостан',
    scSeason: '📅 Сезон',
    scWeather: '🌦️ Погода',
    scPrevalence: '🌏 Поширеність',
    daysAfterRain: '+{min}–{max} дн. після дощу',
    wikiLinkText: 'Вікіпедія — {latin}',
    footerNote: 'Дані: Держліси BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Ніколи не вживайте гриб без 100% впевненості у його виді.',

    labelEdible: 'Їстівний',
    labelToxic: 'Отруйний!',
    labelInedible: 'Неїстівний',
    labelCaution: 'Увага!',
    scoreHigh: 'Високі',
    scoreModerate: 'Помірні',
    scoreLow: 'Низькі',
    scoreVeryLow: 'Дуже низькі',
    scorePoor: 'Погані',
    saprotroph: 'Сапротроф',
    meadowSaprotroph: 'Лучний сапротроф',
    mycorrhizalPartner: 'мікоризний партнер',
  },

  sk: {
    appTitle: 'GrzyboMapa 🍄 – Pomocník Hubára',
    appSub: 'Váš lesný kompas',
    btnTreeSpecies: 'Druhy stromov',
    btnTreeSpeciesTitle: 'Druhy lesného porastu (listnaté, ihličnaté, zmiešané)',
    btnHeatmap: 'Šance',
    btnHeatmapTitle: 'Teplotná mapa hubárskych podmienok',
    btnTrails: 'Chodníky',
    btnTrailsTitle: 'Turistické trasy a lesné chodníky',
    btnPin: 'Vzorkovač',
    btnPinTitle: 'Vzorkovač terénu — umiestnite alebo presuňte špendlík',
    btnGps: 'GPS',
    btnGpsTitle: 'Živé GPS',
    btnRefresh: 'Obnoviť dáta',
    btnClosePanel: 'Zatvoriť panel',
    fabShowResults: '🍄 Zobraziť výsledky',
    pinHint: '👆 Kliknite kdekoľvek na mape',
    pinMarkerTitle: 'Vzorkovač: potiahnite alebo kliknite na preskúmanie',

    gpsFetching: 'Zisťovanie GPS polohy…',
    forestDetecting: 'Detekcia lesného porastu…',
    gpsErr1: 'Prístup k polohe zamietnutý. Zapnite GPS v nastaveniach.',
    gpsErr2: 'Nepodarilo sa určiť polohu. Skontrolujte GPS.',
    gpsErr3: 'Časový limit GPS vypršal.',
    gpsErrUnknown: 'Chyba GPS: {msg}',
    dataFetchError: 'Chyba sťahovania dát. Skontrolujte pripojenie.',
    heatmapNeedWeather: 'Najprv načítajte polohu — mapa potrebuje údaje o počasí',
    urbanStatusWarn: 'Zastavané územie / mesto — les ani huby tu nerastú.',
    waterStatusWarn: 'Vodná plocha — bez lesa.',
    meadowStatusWarn: 'Otvorený terén / lúka — lesné huby sú vylúčené.',

    heatmapTitle: '🌡️ Hubárske podmienky',
    heatmapLo: 'Nevhodné',
    heatmapHi: 'Ideálne',
    heatmapFormula: 'Terén × Počasie × Sezóna',
    heatmapPromptLoc: 'nastavte polohu pre aktiváciu',
    heatmapCalcDone: 'Výpočet podmienok dokončený',
    heatmapFetching: 'Sťahovanie lesných porastov a reliéfu…',
    heatmapLpCount: '🌲 {count} lesných porastov',
    heatmapOsmLpCount: '🌲 Lesy mimo štátnej evidencie',
    heatmapOsmAdded: ' + lesy OSM (odhad)',
    heatmapStatusText: '{temp}°C v noci · {rain}mm/14d · {days}d po daždi · {status}',

    ftlTitle: '🌿 Typ porastu',
    ftlDeciduous: '🌳 Listnaté',
    ftlConiferous: '🌲 Ihličnaté',
    ftlMixed: '🌿 Zmiešané',
    ftlNote: 'Lesnícke dáta · Priblížte mapu (>zoom 11)',

    trailsTitle: '🥾 Chodníky a lesné cesty',
    trailsLines: 'Lesné oddelenia a prieseky',
    trailsHiking: 'Značené turistické trasy',
    trailsDidactic: 'Náučné chodníky',
    trailsHorse: 'Jazdecké trasy',
    trailsNote: 'Dáta: Štátne lesy BDL · Waymarked Trails',

    panelTitleSampler: '📌 Vzorkovač Terénu',
    panelSubSample: '📍 Vzorka: {coords}',
    panelTitleGps: '📡 Živá GPS Analýza',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Živá poloha',
    pointOnMap: 'Vyberte bod na mape',

    secForestTitle: '🌲 Informácie o lese',
    secWeatherTitle: '🌦️ Počasie a zrážky',
    secScoreTitle: '📊 Hodnotenie podmienok',
    secMushroomsTitle: '🍄 Očakávané druhy',

    forestEmptyNotice: 'Nachádzate sa mimo evidovaného lesa.<br><small>Lesnícke dáta sú dostupné len v spravovaných lesných porastoch.</small>',
    forestEmptyPrompt: 'Kliknite na tlačidlo polohy pre zistenie lesa a hubárskych podmienok.',
    badgePin: '📌 Manuálna vzorka',
    badgeGps: '📡 Živé GPS',
    badgeLp: 'Štátne lesy (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Chýbajú úradné dáta (odhad)',

    terrainUrban: 'Mestská / zastavaná oblasť',
    terrainWater: 'Vodná plocha / rieka',
    terrainMeadow: 'Otvorený terén / lúka',
    statusExcluded: 'Vylúčené zo zberu',
    statusNonForest: 'Nezalesnený terén',
    statusTerrLabel: 'Stav terénu:',

    terrainUrbanDesc: 'Zastavané územie — vylúčené zo zberu lesných húb. Chýba lesná hrabanka a mykorízni partneri. Zber v mestách sa neodporúča kvôli ťažkým kovom.',
    terrainWaterDesc: 'Vodná plocha alebo trvalo zamokrený terén — huby tu nerastú.',
    terrainMeadowDesc: 'Absencia lesných stromov vylučuje mykorízne huby (hríby, suchohríby, kuriatka). Môžu tu rásť len lúčne saprotrofy (pečiarky, rozpadavce).',

    compositionTitle: 'Druhové zloženie porastu',
    compositionApproxTitle: 'Predpokladané zloženie porastu',
    compositionNoData: 'Chýbajú detailné dáta o zložení',
    chipAge: '🌱 Vek: <strong>{age} r.</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Mimo štátneho lesného registra',

    approxNoticeTitle: '🌲 Pre tento les chýbajú úradné lesnícke dáta:',
    approxNoticeNationalPark: 'Územie leží v Národnom parku (platia pravidlá ochrany prírody).',
    approxNoticeOsm: 'Les podľa OpenStreetMap (súkromný alebo obecný), bez plánu starostlivosti o les.',
    approxNoticeSpecies: 'Pravdepodobný výskyt húb:',
    approxNoticeDesc: 'Miestne podmienky a dreviny prajú druhom ako: <em>Hríb smrekový, Hríb hnedý, Kuriatko jedlé, Kozák, Masliak a Bedľa vysoká</em>. Index vypočítaný z pôdnej vlhkosti a mikroklímy.',

    weatherNoData: 'Žiadne dáta — zapnite GPS',
    weatherStatsNoData: 'Dáta o počasí nie sú k dispozícii',
    statRain14: 'Dážď 14 dní',
    statAvgTemp: 'Priem. teplota',
    statLastRain: 'Posledný dážď',
    statDrought: 'Sucho',
    daysAgo: 'pred {n} dňami',
    today: 'Dnes',
    daysUnit: '{n} dní',
    forecastTitle: '📅 7-dňová predpoveď & Šance na huby',
    forecastSub: 'Model rastu mycélia: zrážky × bilancia vlhkosti × teplota',

    scoreNoData: 'Žiadne dáta',
    scoreSummaryPrompt: 'Zapnite GPS pre vyhodnotenie hubárskych podmienok vo vašom lese.',
    diagnosisHeader: '🔍 Prečo takýto výsledok v tomto bode?',
    diagnosisTacticalTipTitle: 'Taktický tip:',
    diagnosisTacticalTipText: 'Teplotná mapa odráža vek a zloženie porastov. Ak ste v mladine alebo v suchom borovicovom lese, prejdite pár sto metrov do staršieho lesa (40–100 rokov) na sviežej pôde.',

    mushroomGroupEdible: '🍄 Jedlé ({count})',
    mushroomGroupCaution: '⚠️ Pozor / Nejedlé ({count})',
    mushroomGroupToxic: '☠️ Jedovaté — varovanie ({count})',
    mushroomsEmptyList: 'V tejto sezóne tu nerastú žiadne zodpovedajúce huby.<br><small>Vyberte iné miesto v lese alebo na lúke.</small>',
    meadowBannerTitle: 'Otvorený terén / lúka (bez lesa)',
    meadowBannerDesc: 'Všetky lesné mykorízne huby sú vylúčené. Zobrazujú sa len lúčne a trávne druhy.',
    dangerWarning: '⚠️ Tento druh je smrteľne jedovatý!',
    ecoWhyTitle: '🔍 Prečo táto huba v tomto poraste?',
    ecoTrees: 'Stromy / Substrát:',
    ecoAge: 'Vek porastu:',
    ecoHabitat: 'Typ stanovišťa:',
    scTree: '🌳 Porast',
    scSeason: '📅 Sezóna',
    scWeather: '🌦️ Počasie',
    scPrevalence: '🌏 Hojnosť',
    daysAfterRain: '+{min}–{max} dní po daždi',
    wikiLinkText: 'Wikipédia — {latin}',
    footerNote: 'Dáta: Štátne lesy BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Nikdy nekonzumujte hubu bez 100% istoty o jej druhu.',

    labelEdible: 'Jedlá',
    labelToxic: 'Jedovatá!',
    labelInedible: 'Nejedlá',
    labelCaution: 'Pozor!',
    scoreHigh: 'Vysoké',
    scoreModerate: 'Mierne',
    scoreLow: 'Nízke',
    scoreVeryLow: 'Veľmi nízke',
    scorePoor: 'Zlé',
    saprotroph: 'Saprotrof',
    meadowSaprotroph: 'Lúčny saprotrof',
    mycorrhizalPartner: 'mykorízny partner',
  },

  cs: {
    appTitle: 'GrzyboMapa 🍄 – Pomocník Houbaře',
    appSub: 'Váš lesní kompas',
    btnTreeSpecies: 'Druhy stromů',
    btnTreeSpeciesTitle: 'Druhy lesního porostu (listnaté, jehličnaté, smíšené)',
    btnHeatmap: 'Šance',
    btnHeatmapTitle: 'Teplotní mapa houbařských podmínek',
    btnTrails: 'Stezky',
    btnTrailsTitle: 'Turistické trasy a lesní stezky',
    btnPin: 'Vzorkovač',
    btnPinTitle: 'Vzorkovač terénu — umístěte nebo posuňte špendlík',
    btnGps: 'GPS',
    btnGpsTitle: 'Živé GPS',
    btnRefresh: 'Obnovit data',
    btnClosePanel: 'Zavřít panel',
    fabShowResults: '🍄 Zobrazit výsledky',
    pinHint: '👆 Klikněte kamkoliv na mapě',
    pinMarkerTitle: 'Vzorkovač: přetáhněte nebo klikněte k prozkoumání',

    gpsFetching: 'Zjišťování GPS polohy…',
    forestDetecting: 'Detekce lesního porostu…',
    gpsErr1: 'Přístup k poloze odepřen. Povolte GPS v nastavení.',
    gpsErr2: 'Nelze určit polohu. Zkontrolujte GPS.',
    gpsErr3: 'Časový limit GPS vypršel.',
    gpsErrUnknown: 'Chyba GPS: {msg}',
    dataFetchError: 'Chyba stahování dat. Zkontrolujte připojení.',
    heatmapNeedWeather: 'Nejprve zadejte polohu — mapa vyžaduje údaje o počasí',
    urbanStatusWarn: 'Zastavěná oblast / město — les a houby chybí.',
    waterStatusWarn: 'Vodní plocha — bez lesa.',
    meadowStatusWarn: 'Otevřený terén / louka — lesní houby vyloučeny.',

    heatmapTitle: '🌡️ Houbařské podmínky',
    heatmapLo: 'Nevhodné',
    heatmapHi: 'Ideální',
    heatmapFormula: 'Terén × Počasí × Sezóna',
    heatmapPromptLoc: 'nastavte polohu pro aktivaci',
    heatmapCalcDone: 'Výpočet podmínek dokončen',
    heatmapFetching: 'Stahování lesních porostů a reliéfu…',
    heatmapLpCount: '🌲 {count} lesních porostů',
    heatmapOsmLpCount: '🌲 Lesy mimo státní evidenci',
    heatmapOsmAdded: ' + lesy OSM (odhad)',
    heatmapStatusText: '{temp}°C v noci · {rain}mm/14d · {days}d po dešti · {status}',

    ftlTitle: '🌿 Typ porostu',
    ftlDeciduous: '🌳 Listnaté',
    ftlConiferous: '🌲 Jehličnaté',
    ftlMixed: '🌿 Smíšené',
    ftlNote: 'Lesnická data · Přibližte mapu (>zoom 11)',

    trailsTitle: '🥾 Stezky a lesní cesty',
    trailsLines: 'Lesní oddělení a průseky',
    trailsHiking: 'Značené turistické trasy',
    trailsDidactic: 'Naučné stezky',
    trailsHorse: 'Jezdecké stezky',
    trailsNote: 'Data: Státní lesy BDL · Waymarked Trails',

    panelTitleSampler: '📌 Vzorkovač Terénu',
    panelSubSample: '📍 Vzorek: {coords}',
    panelTitleGps: '📡 Živá GPS Analýza',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Živá poloha',
    pointOnMap: 'Zvolte bod na mapě',

    secForestTitle: '🌲 Informace o lese',
    secWeatherTitle: '🌦️ Povětrnostní podmínky',
    secScoreTitle: '📊 Hodnocení podmínek',
    secMushroomsTitle: '🍄 Očekávané druhy',

    forestEmptyNotice: 'Nacházíte se mimo evidovaný les.<br><small>Lesnická data jsou dostupná pouze v hospodářských lesích.</small>',
    forestEmptyPrompt: 'Klikněte na tlačítko polohy pro detekci lesa a houbařských podmínek.',
    badgePin: '📌 Manuální vzorek',
    badgeGps: '📡 Živé GPS',
    badgeLp: 'Státní lesy (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Chybí úřední data (odhad)',

    terrainUrban: 'Městská / zastavěná oblast',
    terrainWater: 'Vodní plocha / řeka',
    terrainMeadow: 'Otevřený terén / louka',
    statusExcluded: 'Vyloučeno ze sběru',
    statusNonForest: 'Nezalesněný terén',
    statusTerrLabel: 'Stav terénu:',

    terrainUrbanDesc: 'Zastavěná zóna — vyloučeno ze sběru lesních hub. Absence přirozené lesní půdy a mykorhizních partnerů. Sběr ve městech je nevhodný kvůli těžkým kovům.',
    terrainWaterDesc: 'Vodní plocha nebo mokřad — suchozemské houby zde nerostou.',
    terrainMeadowDesc: 'Nepřítomnost lesních dřevin vylučuje mykorhizní houby (hřiby, suchohřiby, lišky). Vyskytovat se mohou pouze luční saprotrofy (žampiony, pýchavky).',

    compositionTitle: 'Druhová skladba porostu',
    compositionApproxTitle: 'Předpokládaná skladba porostu',
    compositionNoData: 'Chybí detailní data o dřevinách',
    chipAge: '🌱 Věk: <strong>{age} let</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Mimo státní lesní evidenci',

    approxNoticeTitle: '🌲 Pro tento les chybí úřední lesnická data:',
    approxNoticeNationalPark: 'Území leží v Národním parku (platí pravidla ochrany přírody).',
    approxNoticeOsm: 'Les podle OpenStreetMap (soukromý nebo obecní), bez lesního hospodářského plánu.',
    approxNoticeSpecies: 'Pravděpodobný výskyt hub:',
    approxNoticeDesc: 'Místní podmínky a dřeviny svědčí druhům jako: <em>Hřib smrkový, Hřib hnědý, Liška obecná, Kozák, Klouzek a Bedla vysoká</em>. Index vypočten z vlhkosti půdy a mikroklimatu.',

    weatherNoData: 'Žádná data — zapněte GPS',
    weatherStatsNoData: 'Data o počasí nejsou k dispozici',
    statRain14: 'Déšť 14 dní',
    statAvgTemp: 'Prům. teplota',
    statLastRain: 'Poslední déšť',
    statDrought: 'Sucho',
    daysAgo: 'před {n} dny',
    today: 'Dnes',
    daysUnit: '{n} dní',
    forecastTitle: '📅 7denní předpověď & Šance na houby',
    forecastSub: 'Model růstu podhoubí: srážky × bilance vláhy × teplota',

    scoreNoData: 'Žádná data',
    scoreSummaryPrompt: 'Zapněte GPS pro vyhodnocení podmínek pro sběr hub ve vašem lese.',
    diagnosisHeader: '🔍 Proč takový výsledek v tomto bodě?',
    diagnosisTacticalTipTitle: 'Taktický tip:',
    diagnosisTacticalTipText: 'Teplotní mapa zobrazuje stáří a skladbu dřevin. Pokud jste v mlazině nebo suchém boru, přejděte o pár set metrů do sousedního vzrostlého lesa (40–100 let) na svěží půdě.',

    mushroomGroupEdible: '🍄 Jedlé ({count})',
    mushroomGroupCaution: '⚠️ Pozor / Nejedlé ({count})',
    mushroomGroupToxic: '☠️ Jedovaté — varování ({count})',
    mushroomsEmptyList: 'V této sezóně zde nerostou žádné odpovídající houby.<br><small>Zvolte jiné místo v lese nebo na louce.</small>',
    meadowBannerTitle: 'Otevřený terén / louka (bez lesa)',
    meadowBannerDesc: 'Veškeré lesní mykorhizní houby jsou vyloučeny. Zobrazeny jsou pouze luční a travní druhy.',
    dangerWarning: '⚠️ Tento druh je smrtelně jedovatý!',
    ecoWhyTitle: '🔍 Proč tato houba v tomto porostu?',
    ecoTrees: 'Stromy / Substrát:',
    ecoAge: 'Věk porostu:',
    ecoHabitat: 'Typ stanoviště:',
    scTree: '🌳 Porost',
    scSeason: '📅 Sezóna',
    scWeather: '🌦️ Počasí',
    scPrevalence: '🌏 Hojnost',
    daysAfterRain: '+{min}–{max} dní po dešti',
    wikiLinkText: 'Wikipedie — {latin}',
    footerNote: 'Data: Státní lesy BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Nikdy nekonzumujte houbu bez 100% jistoty o jejím druhu.',

    labelEdible: 'Jedlá',
    labelToxic: 'Jedovatá!',
    labelInedible: 'Nejedlá',
    labelCaution: 'Pozor!',
    scoreHigh: 'Vysoké',
    scoreModerate: 'Mírné',
    scoreLow: 'Nízké',
    scoreVeryLow: 'Velmi nízké',
    scorePoor: 'Špatné',
    saprotroph: 'Saprotrof',
    meadowSaprotroph: 'Luční saprotrof',
    mycorrhizalPartner: 'mykorhizní partner',
  },

  lt: {
    appTitle: 'GrzyboMapa 🍄 – Grybautojo Padėjėjas',
    appSub: 'Jūsų miško kompasas',
    btnTreeSpecies: 'Medžių rūšys',
    btnTreeSpeciesTitle: 'Miško medžių rūšys (lapuočiai, spygliuočiai, mišrūs)',
    btnHeatmap: 'Šansai',
    btnHeatmapTitle: 'Grybavimo sąlygų šilumos žemėlapis',
    btnTrails: 'Takai',
    btnTrailsTitle: 'Turistiniai takai ir miško keliukai',
    btnPin: 'Zondas',
    btnPinTitle: 'Vietovės zondas — padėkite arba perkelkite smeigtuką',
    btnGps: 'GPS',
    btnGpsTitle: 'Tiesioginis GPS',
    btnRefresh: 'Atnaujinti duomenis',
    btnClosePanel: 'Uždaryti skydelį',
    fabShowResults: '🍄 Rodyti rezultatus',
    pinHint: '👆 Spustelėkite bet kur žemėlapyje',
    pinMarkerTitle: 'Zondas: tempkite arba spustelėkite analizei',

    gpsFetching: 'Nustatoma GPS vieta…',
    forestDetecting: 'Nustatomas miško medynas…',
    gpsErr1: 'Vietos nustatymas atmestas. Įjunkite GPS nustatymuose.',
    gpsErr2: 'Nepavyko nustatyti vietos. Patikrinkite GPS.',
    gpsErr3: 'Baigėsi GPS laukimo laikas.',
    gpsErrUnknown: 'GPS klaida: {msg}',
    dataFetchError: 'Nepavyko gauti duomenų. Patikrinkite ryšį.',
    heatmapNeedWeather: 'Pirmiausia nustatykite vietą — žemėlapiui reikia orų duomenų',
    urbanStatusWarn: 'Užstatyta teritorija / miestas — miško ir grybų nėra.',
    waterStatusWarn: 'Vandens telkinys — miško nėra.',
    meadowStatusWarn: 'Atvira vietovė / pieva — miško grybai atmesti.',

    heatmapTitle: '🌡️ Grybavimo sąlygos',
    heatmapLo: 'Nepalankios',
    heatmapHi: 'Idealios',
    heatmapFormula: 'Vietovė × Orai × Sezonas',
    heatmapPromptLoc: 'nustatykite vietą norėdami aktyvuoti',
    heatmapCalcDone: 'Sąlygų skaičiavimas baigtas',
    heatmapFetching: 'Atsiunčiami miško medynai ir reljefas…',
    heatmapLpCount: '🌲 {count} miško sklypų',
    heatmapOsmLpCount: '🌲 Miškai už valstybinio registro ribų',
    heatmapOsmAdded: ' + OSM miškai (apytiksliai)',
    heatmapStatusText: '{temp}°C naktį · {rain}mm/14d · {days}d po lietaus · {status}',

    ftlTitle: '🌿 Medyno tipas',
    ftlDeciduous: '🌳 Lapuočiai',
    ftlConiferous: '🌲 Spygliuočiai',
    ftlMixed: '🌿 Mišrūs',
    ftlNote: 'Miškų duomenys · Priartinkite žemėlapį (>zoom 11)',

    trailsTitle: '🥾 Miško takai ir keliukai',
    trailsLines: 'Miško kvartalai ir proskynos',
    trailsHiking: 'Pažymėti turistiniai takai',
    trailsDidactic: 'Pažintiniai takai',
    trailsHorse: 'Jojimo takai',
    trailsNote: 'Duomenys: Valstybiniai miškai BDL · Waymarked Trails',

    panelTitleSampler: '📌 Vietovės Zondas',
    panelSubSample: '📍 Mėginys: {coords}',
    panelTitleGps: '📡 Tiesioginė GPS Analizė',
    panelSubGps: 'GPS: {coords}',
    panelSubGpsLive: 'Tiesioginė vieta',
    pointOnMap: 'Pasirinkite tašką žemėlapyje',

    secForestTitle: '🌲 Miško informacija',
    secWeatherTitle: '🌦️ Oro sąlygos',
    secScoreTitle: '📊 Sąlygų vertinimas',
    secMushroomsTitle: '🍄 Tikėtinos rūšys',

    forestEmptyNotice: 'Esate už registruoto miško ribų.<br><small>Miškininkystės duomenys teikiami tik valstybiniams miškams.</small>',
    forestEmptyPrompt: 'Paspauskite vietos mygtuką, kad nustatytumėte mišką ir grybavimo sąlygas.',
    badgePin: '📌 Rankinis taškas',
    badgeGps: '📡 Tiesioginis GPS',
    badgeLp: 'Valstybiniai miškai (BDL)',
    badgeOsm: 'OpenStreetMap',
    badgeLpMissing: '⚠️ Nėra oficialių duomenų (apytiksliai)',

    terrainUrban: 'Miesto / užstatyta teritorija',
    terrainWater: 'Vandens telkinys / upė',
    terrainMeadow: 'Atvira vietovė / pieva',
    statusExcluded: 'Grybavimas negalimas',
    statusNonForest: 'Nemiškinga vietovė',
    statusTerrLabel: 'Teritorijos būsena:',

    terrainUrbanDesc: 'Užstatyta teritorija — grybauti netinkama. Nėra natūralios miško paklotės ir mikorizės partnerių. Mieste rinkti grybų nerekomenduojama dėl sunkiųjų metalų.',
    terrainWaterDesc: 'Vandens telkinys ar užmirkusi vieta — antžeminiai grybai čia neauga.',
    terrainMeadowDesc: 'Be miško medžių neauga mikoriziniai grybai (baravykai, voveraitės, kazlėkai). Gali augti tik pievų saprotrofai (pievagrybiai, kukurdvelkiai).',

    compositionTitle: 'Medyno sudėtis',
    compositionApproxTitle: 'Nuspėjama medyno sudėtis',
    compositionNoData: 'Nėra išsamių duomenų apie rūšinę sudėtį',
    chipAge: '🌱 Amžius: <strong>{age} m.</strong>',
    chipAdrFor: '📌 {adr}',
    chipHabitat: '🏷️ {habitat}',
    chipOutsideLp: 'ℹ️ Neįtraukta į valstybinį miškų registrą',

    approxNoticeTitle: '🌲 Nėra oficialių miškininkystės duomenų apie šį mišką:',
    approxNoticeNationalPark: 'Teritorija patenka į Nacionalinį parką (galioja gamtosaugos taisyklės).',
    approxNoticeOsm: 'Pagal OpenStreetMap tai miškas, tačiau neturi valstybinio miškotvarkos plano.',
    approxNoticeSpecies: 'Tikėtinos grybų rūšys:',
    approxNoticeDesc: 'Vietos sąlygos tinka šiems grybams: <em>Tikrinis baravykas, Šilbaravykis, Valgomoji voveraitė, Beržinis baravykėlis, Kazlėkas ir Skėtinė žvynabudė</em>. Indeksas apskaičiuotas pagal dirvožemio drėgmę ir mikroklimatą.',

    weatherNoData: 'Nėra duomenų — įjunkite GPS',
    weatherStatsNoData: 'Orų duomenys nepasiekiami',
    statRain14: 'Lietus 14 d.',
    statAvgTemp: 'Vid. temperatūra',
    statLastRain: 'Paskutinis lietus',
    statDrought: 'Sausra',
    daysAgo: 'prieš {n} d.',
    today: 'Šiandien',
    daysUnit: '{n} d.',
    forecastTitle: '📅 7 dienų prognozė ir grybų tikimybė',
    forecastSub: 'Grybienos augimo modelis: krituliai × drėgmės balansas × temperatūra',

    scoreNoData: 'Nėra duomenų',
    scoreSummaryPrompt: 'Įjunkite GPS, kad įvertintumėte grybavimo sąlygas savo miške.',
    diagnosisHeader: '🔍 Kodėl toks rezultatas šiame taške?',
    diagnosisTacticalTipTitle: 'Taktinis patarimas:',
    diagnosisTacticalTipText: 'Šilumos žemėlapis atspindi medynų amžių ir rūšis. Jei esate jaunuolyne ar sausame šile, paėjėkite kelis šimtus metrų į brandesnį mišką (40–100 m.) šviežioje dirvoje.',

    mushroomGroupEdible: '🍄 Valgomi ({count})',
    mushroomGroupCaution: '⚠️ Dėmesio / Nevalgomi ({count})',
    mushroomGroupToxic: '☠️ Nuodingi — įspėjimas ({count})',
    mushroomsEmptyList: 'Šiuo sezonu šioje vietovėje tinkamų grybų nėra.<br><small>Pasirinkite kitą tašką miške ar pievoje.</small>',
    meadowBannerTitle: 'Atvira vietovė / pieva (ne miškas)',
    meadowBannerDesc: 'Visi miško mikoriziniai grybai (baravykai, voveraitės) atmesti. Rodomi tik pievų ir žolynų grybai.',
    dangerWarning: '⚠️ Ši rūšis mirtinai nuodinga!',
    ecoWhyTitle: '🔍 Kodėl šis grybas šiame medyne?',
    ecoTrees: 'Medžiai / Substratas:',
    ecoAge: 'Medyno amžius:',
    ecoHabitat: 'Buveinės tipas:',
    scTree: '🌳 Medynas',
    scSeason: '📅 Sezonas',
    scWeather: '🌦️ Orai',
    scPrevalence: '🌏 Gausumas',
    daysAfterRain: '+{min}–{max} d. po lietaus',
    wikiLinkText: 'Vikipedija — {latin}',
    footerNote: 'Duomenys: Valstybiniai miškai BDL · GBIF · Open-Meteo',
    footerWarning: '⚠️ Niekada nevalgykite grybo, jei nesate 100% tikri dėl jo rūšies.',

    labelEdible: 'Valgomas',
    labelToxic: 'Nuodingas!',
    labelInedible: 'Nevalgomas',
    labelCaution: 'Dėmesio!',
    scoreHigh: 'Dideli',
    scoreModerate: 'Vidutiniški',
    scoreLow: 'Maži',
    scoreVeryLow: 'Labai maži',
    scorePoor: 'Prasti',
    saprotroph: 'Saprotrofas',
    meadowSaprotroph: 'Pievinis saprotrofas',
    mycorrhizalPartner: 'mikorizinis partneris',
  }
};

export function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.pl;
  let text = dict[key] || TRANSLATIONS.pl[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────
// DRZEWA / TREE SPECIES
// ─────────────────────────────────────────────────────────────────
const TREE_NAMES = {
  So:   { pl: 'Sosna', en: 'Scots Pine', de: 'Waldkiefer', uk: 'Сосна звичайна', sk: 'Borovica lesná', cs: 'Borovice lesní', lt: 'Paprastoji pušis' },
  Sw:   { pl: 'Świerk', en: 'Norway Spruce', de: 'Gemeine Fichte', uk: 'Ялина звичайна', sk: 'Smrek obyčajný', cs: 'Smrk ztepilý', lt: 'Paprastoji eglė' },
  Jd:   { pl: 'Jodła', en: 'Silver Fir', de: 'Weißtanne', uk: 'Ялиця біла', sk: 'Jedľa biela', cs: 'Jedle bělokorá', lt: 'Paprastasis kėnis' },
  Md:   { pl: 'Modrzew', en: 'European Larch', de: 'Europäische Lärche', uk: 'Модрина європейська', sk: 'Smrekovec opadavý', cs: 'Modřín opadavý', lt: 'Europinis maumedis' },
  Db:   { pl: 'Dąb', en: 'Oak', de: 'Stieleiche', uk: 'Дуб звичайний', sk: 'Dub letný', cs: 'Dub letní', lt: 'Paprastasis ąžuolas' },
  Dbcz: { pl: 'Dąb czerwony', en: 'Northern Red Oak', de: 'Roteiche', uk: 'Дуб червоний', sk: 'Dub červený', cs: 'Dub červený', lt: 'Raudonasis ąžuolas' },
  Bk:   { pl: 'Buk', en: 'European Beech', de: 'Rotbuche', uk: 'Бук європейський', sk: 'Buk lesný', cs: 'Buk lesní', lt: 'Paprastasis bukas' },
  Gb:   { pl: 'Grab', en: 'European Hornbeam', de: 'Hainbuche', uk: 'Граб звичайний', sk: 'Hrab obyčajný', cs: 'Habr obecný', lt: 'Paprastasis skroblas' },
  Brz:  { pl: 'Brzoza', en: 'Silver Birch', de: 'Hängebirke', uk: 'Береза повисла', sk: 'Breza previsnutá', cs: 'Bříza bělokorá', lt: 'Karpotasis beržas' },
  Lp:   { pl: 'Lipa', en: 'Small-leaved Lime', de: 'Winterlinde', uk: 'Липа серцелиста', sk: 'Lipa malolistá', cs: 'Lípa srdčitá', lt: 'Mažalapė liepa' },
  Js:   { pl: 'Jesion', en: 'European Ash', de: 'Gemeine Esche', uk: 'Ясен звичайний', sk: 'Jaseň štíhly', cs: 'Jasan ztepilý', lt: 'Paprastasis uosis' },
  Kl:   { pl: 'Klon', en: 'Norway Maple', de: 'Spitzahorn', uk: 'Клен звичайний', sk: 'Javor mliečny', cs: 'Javor mléč', lt: 'Paprastasis klevas' },
  Ol:   { pl: 'Olsza', en: 'Black Alder', de: 'Schwarzerle', uk: 'Вільха чорна', sk: 'Jelša lepkavá', cs: 'Olše lepkavá', lt: 'Juodalksnis' },
  Os:   { pl: 'Osika', en: 'Common Aspen', de: 'Zitterpappel', uk: 'Осика', sk: 'Topoľ osikový', cs: 'Topol osika', lt: 'Drebulė' },
  Tp:   { pl: 'Topola', en: 'Poplar', de: 'Pappel', uk: 'Тополя', sk: 'Topoľ', cs: 'Topol', lt: 'Tuopa' },
  Wz:   { pl: 'Wiąz', en: 'Wych Elm', de: 'Bergulme', uk: 'В\'яз', sk: 'Brest', cs: 'Jilm', lt: 'Guoba' },
  Lsz:  { pl: 'Leszczyna', en: 'Common Hazel', de: 'Gemeine Hasel', uk: 'Ліщина звичайна', sk: 'Lieska obyčajná', cs: 'Líska obecná', lt: 'Paprastasis lazdynas' },
  Wb:   { pl: 'Wierzba', en: 'Willow', de: 'Weide', uk: 'Верба', sk: 'Vŕba', cs: 'Vrba', lt: 'Gluosnis' },
  Jw:   { pl: 'Jawor', en: 'Sycamore Maple', de: 'Bergahorn', uk: 'Явір', sk: 'Javor horský', cs: 'Javor klen', lt: 'Kalninis klevas' },
  Czr:  { pl: 'Czereśnia', en: 'Wild Cherry', de: 'Vogelkirsche', uk: 'Черешня', sk: 'Čerešňa vtáčia', cs: 'Třešeň ptačí', lt: 'Trešnė' },
};

export function getTreeSpeciesName(code, lang = currentLang) {
  const item = TREE_NAMES[code];
  if (!item) return code;
  return item[lang] || item.pl || code;
}

// ─────────────────────────────────────────────────────────────────
// SIEDLISKA / HABITATS
// ─────────────────────────────────────────────────────────────────
const HABITATS = {
  'BŚW': { pl: 'Bór świeży', en: 'Fresh coniferous forest', de: 'Frischer Nadelwald', uk: 'Свіжий бір', sk: 'Čerstvý bor', cs: 'Svěží bor', lt: 'Šviežias šilas' },
  'BSW': { pl: 'Bór świeży', en: 'Fresh coniferous forest', de: 'Frischer Nadelwald', uk: 'Свіжий бір', sk: 'Čerstvý bor', cs: 'Svěží bor', lt: 'Šviežias šilas' },
  'BW':  { pl: 'Bór wilgotny', en: 'Moist coniferous forest', de: 'Feuchter Nadelwald', uk: 'Вологий бір', sk: 'Vlhký bor', cs: 'Vlhký bor', lt: 'Drėgnas šilas' },
  'BB':  { pl: 'Bór bagienny', en: 'Bog coniferous forest', de: 'Moornadelwald', uk: 'Болотистий бір', sk: 'Močiarny bor', cs: 'Rašelinný bor', lt: 'Pelkinis šilas' },
  'BMŚ': { pl: 'Bór mieszany świeży', en: 'Fresh mixed coniferous forest', de: 'Frischer Kiefern-Mischwald', uk: 'Свіжий субір', sk: 'Čerstvý zmiešaný bor', cs: 'Svěží smíšený bor', lt: 'Šviežias mišrus šilas' },
  'BMŚW':{ pl: 'Bór mieszany świeży', en: 'Fresh mixed coniferous forest', de: 'Frischer Kiefern-Mischwald', uk: 'Свіжий субір', sk: 'Čerstvý zmiešaný bor', cs: 'Svěží smíšený bor', lt: 'Šviežias mišrus šilas' },
  'BMW': { pl: 'Bór mieszany wilgotny', en: 'Moist mixed coniferous forest', de: 'Feuchter Kiefern-Mischwald', uk: 'Вологий субір', sk: 'Vlhký zmiešaný bor', cs: 'Vlhký smíšený bor', lt: 'Drėgnas mišrus šilas' },
  'BMB': { pl: 'Bór mieszany bagienny', en: 'Bog mixed coniferous forest', de: 'Moormischwald', uk: 'Болотистий субір', sk: 'Močiarny zmiešaný bor', cs: 'Rašelinný smíšený bor', lt: 'Pelkinis mišrus šilas' },
  'LMŚ': { pl: 'Las mieszany świeży', en: 'Fresh mixed forest', de: 'Frischer Mischwald', uk: 'Свіжа судіброва', sk: 'Čerstvý zmiešaný les', cs: 'Svěží smíšený les', lt: 'Šviežias mišrus miškas' },
  'LMŚW':{ pl: 'Las mieszany świeży', en: 'Fresh mixed forest', de: 'Frischer Mischwald', uk: 'Свіжа судіброва', sk: 'Čerstvý zmiešaný les', cs: 'Svěží smíšený les', lt: 'Šviežias mišrus miškas' },
  'LMW': { pl: 'Las mieszany wilgotny', en: 'Moist mixed forest', de: 'Feuchter Mischwald', uk: 'Волога судіброва', sk: 'Vlhký zmiešaný les', cs: 'Vlhký smíšený les', lt: 'Drėgnas mišrus miškas' },
  'LMB': { pl: 'Las mieszany bagienny', en: 'Bog mixed forest', de: 'Moor-Laubmischwald', uk: 'Болотиста судіброва', sk: 'Močiarny zmiešaný les', cs: 'Rašelinný smíšený les', lt: 'Pelkinis mišrus miškas' },
  'LŚW': { pl: 'Las świeży', en: 'Fresh broadleaved forest', de: 'Frischer Laubwald', uk: 'Свіжа діброва', sk: 'Čerstvý listnatý les', cs: 'Svěží listnatý les', lt: 'Šviežias lapuočių miškas' },
  'LW':  { pl: 'Las wilgotny', en: 'Moist broadleaved forest', de: 'Feuchter Laubwald', uk: 'Волога діброва', sk: 'Vlhký listnatý les', cs: 'Vlhký listnatý les', lt: 'Drėgnas lapuočių miškas' },
  'LL':  { pl: 'Las łęgowy', en: 'Riparian forest', de: 'Auwald', uk: 'Заплавний ліс', sk: 'Lužný les', cs: 'Lužní les', lt: 'Užliejamas miškas' },
  'LŁ':  { pl: 'Las łęgowy', en: 'Riparian forest', de: 'Auwald', uk: 'Заплавний ліс', sk: 'Lužný les', cs: 'Lužní les', lt: 'Užliejamas miškas' },
  'OL':  { pl: 'Ols', en: 'Alder carr', de: 'Erlenbruchwald', uk: 'Вільшаник', sk: 'Jelšový les', cs: 'Olšina', lt: 'Juodalksnynas' },
  'OLJ': { pl: 'Ols jesionowy', en: 'Ash-alder carr', de: 'Eschen-Erlen-Bruchwald', uk: 'Ясенево-вільховий ліс', sk: 'Jaseňovo-jelšový les', cs: 'Jasanová olšina', lt: 'Uosinis juodalksnynas' },
  'BR':  { pl: 'Bór chrobotkowy', en: 'Cladonia pine forest', de: 'Flechten-Kiefernwald', uk: 'Лишайниковий бір', sk: 'Lišajníkový bor', cs: 'Lišejníkový bor', lt: 'Kerpinis šilas' },
  'BS':  { pl: 'Bór suchy', en: 'Dry coniferous forest', de: 'Trockener Kiefernwald', uk: 'Сухий бір', sk: 'Suchý bor', cs: 'Suchý bor', lt: 'Sausas šilas' },
};

export function decodeHabitat(code, lang = currentLang) {
  const key = (code || '').toUpperCase().replace(/\s/g, '');
  const item = HABITATS[key];
  if (!item) return code;
  return item[lang] || item.pl || code;
}

// ─────────────────────────────────────────────────────────────────
// POGODA / WEATHER (WMO)
// ─────────────────────────────────────────────────────────────────
const WMO_TEXTS = {
  0:  { pl: 'Bezchmurnie', en: 'Clear sky', de: 'Klar', uk: 'Ясно', sk: 'Jasno', cs: 'Jasno', lt: 'Giedra' },
  1:  { pl: 'Głównie czyste', en: 'Mainly clear', de: 'Überwiegend klar', uk: 'Переважно ясно', sk: 'Prevažne jasno', cs: 'Převážně jasno', lt: 'Mažai debesuota' },
  2:  { pl: 'Częściowe zachmurzenie', en: 'Partly cloudy', de: 'Teilweise bewölkt', uk: 'Мінлива хмарність', sk: 'Polooblačno', cs: 'Polojasno', lt: 'Debesuota su pragiedruliais' },
  3:  { pl: 'Zachmurzenie', en: 'Overcast', de: 'Bedeckt', uk: 'Хмарно', sk: 'Zamračené', cs: 'Zataženo', lt: 'Debesuota' },
  45: { pl: 'Mgła', en: 'Fog', de: 'Nebel', uk: 'Туман', sk: 'Hmla', cs: 'Mlha', lt: 'Rūkas' },
  48: { pl: 'Mgła oszraniająca', en: 'Depositing rime fog', de: 'Raureifnebel', uk: 'Паморозь', sk: 'Mrznúca hmla', cs: 'Mrznoucí mlha', lt: 'Šerkšnas' },
  51: { pl: 'Mżawka słaba', en: 'Light drizzle', de: 'Leichter Nieselregen', uk: 'Слабка мряка', sk: 'Slabé mrholenie', cs: 'Slabé mrholení', lt: 'Silpna dulksna' },
  53: { pl: 'Mżawka', en: 'Drizzle', de: 'Nieselregen', uk: 'Мряка', sk: 'Mrholenie', cs: 'Mrholení', lt: 'Dulksna' },
  55: { pl: 'Mżawka silna', en: 'Heavy drizzle', de: 'Starker Nieselregen', uk: 'Густа мряка', sk: 'Husté mrholenie', cs: 'Husté mrholení', lt: 'Tiršta dulksna' },
  61: { pl: 'Deszcz słaby', en: 'Slight rain', de: 'Leichter Regen', uk: 'Невеликий дощ', sk: 'Slabý dážď', cs: 'Slabý déšť', lt: 'Nedidelis lietus' },
  63: { pl: 'Deszcz', en: 'Moderate rain', de: 'Regen', uk: 'Дощ', sk: 'Dážď', cs: 'Déšť', lt: 'Lietus' },
  65: { pl: 'Deszcz ulewny', en: 'Heavy rain', de: 'Starker Regen', uk: 'Сильний дощ', sk: 'Silný dážď', cs: 'Silný déšť', lt: 'Smarkus lietus' },
  71: { pl: 'Śnieg słaby', en: 'Slight snow', de: 'Leichter Schneefall', uk: 'Слабкий сніг', sk: 'Slabé sneženie', cs: 'Slabé sněžení', lt: 'Nedidelis sniegas' },
  73: { pl: 'Śnieg', en: 'Moderate snow', de: 'Schneefall', uk: 'Снігопад', sk: 'Sneženie', cs: 'Sněžení', lt: 'Sniegas' },
  75: { pl: 'Śnieg intensywny', en: 'Heavy snow', de: 'Starker Schneefall', uk: 'Сильний снігопад', sk: 'Husté sneženie', cs: 'Husté sněžení', lt: 'Smarkus sniegas' },
  80: { pl: 'Przelotny deszcz', en: 'Rain showers', de: 'Regenschauer', uk: 'Короткочасний дощ', sk: 'Prehánky', cs: 'Přeháňky', lt: 'Trumpi lietūs' },
  81: { pl: 'Przelotne opady', en: 'Moderate showers', de: 'Mäßige Schauer', uk: 'Злива', sk: 'Mierne prehánky', cs: 'Mírné přeháňky', lt: 'Trumpi lietūs' },
  82: { pl: 'Gwałtowna ulewa', en: 'Violent showers', de: 'Heftige Schauer', uk: 'Сильна злива', sk: 'Prudké prehánky', cs: 'Prudké přeháňky', lt: 'Liūtis' },
  95: { pl: 'Burza', en: 'Thunderstorm', de: 'Gewitter', uk: 'Гроза', sk: 'Búrka', cs: 'Bouřka', lt: 'Perkūnija' },
  96: { pl: 'Burza z gradem', en: 'Thunderstorm with hail', de: 'Gewitter mit Hagel', uk: 'Гроза з градом', sk: 'Búrka s krupobitím', cs: 'Bouřka s krupobitím', lt: 'Perkūnija su kruša' },
  99: { pl: 'Silna burza z gradem', en: 'Severe storm with hail', de: 'Schweres Gewitter mit Hagel', uk: 'Сильна гроза з градом', sk: 'Silná búrka s krupobitím', cs: 'Silná bouřka s krupobitím', lt: 'Stipri perkūnija su kruša' },
};

export function weatherCodeToLocalizedText(code, lang = currentLang) {
  const item = WMO_TEXTS[code];
  if (!item) return TRANSLATIONS[lang]?.scoreNoData || 'Unknown';
  return item[lang] || item.pl;
}

// ─────────────────────────────────────────────────────────────────
// NAZWY GATUNKÓW GRZYBÓW / MUSHROOM NAMES
// ─────────────────────────────────────────────────────────────────
const MUSHROOM_NAMES = {
  boletus_edulis: {
    pl: 'Borowik szlachetny (prawdziwek)', en: 'King bolete (porcini)', de: 'Steinpilz (Herrenpilz)',
    uk: 'Білий гриб (боровик)', sk: 'Hríb smrekový', cs: 'Hřib smrkový', lt: 'Tikrinis baravykas'
  },
  imleria_badia: {
    pl: 'Podgrzybek brunatny', en: 'Bay bolete', de: 'Maronen-Röhrling',
    uk: 'Польський гриб', sk: 'Hríb hnedý (suchohríb)', cs: 'Hřib hnědý', lt: 'Raukšlėtasis aksombaravykis'
  },
  boletus_reticulatus: {
    pl: 'Borowik siatkowaty', en: 'Summer bolete', de: 'Sommer-Steinpilz',
    uk: 'Білий гриб сітчастий', sk: 'Hríb dubový', cs: 'Hřib dubový', lt: 'Vasarinis baravykas'
  },
  boletus_pinophilus: {
    pl: 'Borowik sosnowy', en: 'Pine bolete', de: 'Kiefern-Steinpilz',
    uk: 'Білий гриб сосновий', sk: 'Hríb sosnový', cs: 'Hřib borový', lt: 'Pušyninis baravykas'
  },
  boletus_aereus: {
    pl: 'Borowik ciemnobrązowy', en: 'Dark cep (bronze bolete)', de: 'Schwarzhütiger Steinpilz',
    uk: 'Боровик бронзовий', sk: 'Hríb bronzový', cs: 'Hřib bronzový', lt: 'Bronzinis baravykas'
  },
  cantharellus_cibarius: {
    pl: 'Pieprznik jadalny (kurka)', en: 'Golden chanterelle', de: 'Echter Pfifferling',
    uk: 'Лисичка справжня', sk: 'Kuriatko jedlé', cs: 'Liška obecná', lt: 'Valgomoji voveraitė'
  },
  craterellus_tubaeformis: {
    pl: 'Pieprznik trąbkowy', en: 'Yellow foot (trumpet chanterelle)', de: 'Trompetenpfifferling',
    uk: 'Лисичка трубчаста', sk: 'Lievik trubkovitý', cs: 'Liška nálevkovitá', lt: 'Tauftinė voveraitė'
  },
  craterellus_cornucopioides: {
    pl: 'Lejkowiec dęty', en: 'Black trumpet (horn of plenty)', de: 'Herbsttrompete (Totentrompete)',
    uk: 'Вороночник ріжкоподібний', sk: 'Lievik trubkovitý', cs: 'Stroček trubkovitý', lt: 'Paprastoji tauriabudė'
  },
  macrolepiota_procera: {
    pl: 'Czubajka kania (sowa)', en: 'Parasol mushroom', de: 'Parasol (Gemeiner Riesenschirmling)',
    uk: 'Гриб-зонтик великий', sk: 'Bedľa vysoká', cs: 'Bedla vysoká', lt: 'Skėtinė žvynabudė'
  },
  chlorophyllum_rhacodes: {
    pl: 'Czubajka czerwieniejąca', en: 'Shaggy parasol', de: 'Safran-Schirmling',
    uk: 'Гриб-зонтик червоніючий', sk: 'Bedľa červenejúca', cs: 'Bedla červenající', lt: 'Šiurkščioji žvynabudėlė'
  },
  suillus_luteus: {
    pl: 'Maślak zwyczajny', en: 'Slippery jack', de: 'Butterpilz',
    uk: 'Маслюк звичайний', sk: 'Masliak obyčajný', cs: 'Klouzek obecný', lt: 'Tikrasis kazlėkas'
  },
  suillus_grevillei: {
    pl: 'Maślak żółty (modrzewiowy)', en: 'Larch bolete', de: 'Gold-Röhrling',
    uk: 'Маслюк модриновий', sk: 'Masliak smrekovcový', cs: 'Klouzek sličný', lt: 'Gelsvasis kazlėkas'
  },
  suillus_granulatus: {
    pl: 'Maślak ziarnisty', en: 'Weeping bolete', de: 'Körnchen-Röhrling',
    uk: 'Маслюк зернистий', sk: 'Masliak zrnitý', cs: 'Klouzek zrnitý', lt: 'Grūdėtasis kazlėkas'
  },
  suillus_variegatus: {
    pl: 'Maślak pstry (jakubek)', en: 'Velvet bolete', de: 'Sand-Röhrling',
    uk: 'Маслюк строкатий', sk: 'Masliak strakatý', cs: 'Hřib strakoš', lt: 'Gelsvarudis aksombaravykis'
  },
  suillus_bovinus: {
    pl: 'Maślak sitarz', en: 'Bovine bolete', de: 'Kuh-Röhrling',
    uk: 'Козляк', sk: 'Masliak kravský', cs: 'Klouzek kravský', lt: 'Jaučio kazlėkas'
  },
  leccinum_scabrum: {
    pl: 'Koźlarz babka', en: 'Brown birch bolete', de: 'Birkenpilz',
    uk: 'Підберезовик', sk: 'Kozák brezový', cs: 'Kozák březový', lt: 'Beržinis baravykėlis'
  },
  leccinum_aurantiacum: {
    pl: 'Koźlarz czerwony', en: 'Red-capped scaber stalk', de: 'Rothaut-Röhrling',
    uk: 'Підосиковик червоний', sk: 'Kozák osikový', cs: 'Křemenáč osikový', lt: 'Raudongalvis baravykėlis'
  },
  leccinum_versipelle: {
    pl: 'Koźlarz pomarańczowożółty', en: 'Orange birch bolete', de: 'Birken-Rotkappe',
    uk: 'Підосиковик жовто-бурий', sk: 'Kozák žltooranžový', cs: 'Křemenáč březový', lt: 'Raudonviršis baravykėlis'
  },
  lactarius_deliciosus: {
    pl: 'Mleczaj rydz', en: 'Saffron milk cap', de: 'Echter Reizker',
    uk: 'Рижик справжній', sk: 'Rýdzik pravý', cs: 'Ryzec pravý', lt: 'Tikroji rudmėsė'
  },
  lactarius_deterrimus: {
    pl: 'Mleczaj świerkowy', en: 'Spruce milkcap', de: 'Fichten-Reizker',
    uk: 'Рижик ялиновий', sk: 'Rýdzik smrekový', cs: 'Ryzec smrkový', lt: 'Eglinė rudmėsė'
  },
  lactarius_torminosus: {
    pl: 'Mleczaj wełnianka', en: 'Woolly milkcap', de: 'Birken-Reizker',
    uk: 'Вовнянка', sk: 'Rýdzik kravský', cs: 'Ryzec kravský', lt: 'Pūkuotasis piengrybis'
  },
  amanita_muscaria: {
    pl: 'Muchomor czerwony', en: 'Fly agaric', de: 'Fliegenpilz',
    uk: 'Мухомор червоний', sk: 'Muchotrávka červená', cs: 'Muchomůrka červená', lt: 'Paprastoji musmirė'
  },
  amanita_phalloides: {
    pl: 'Muchomor sromotnikowy (zielonawy)', en: 'Death cap', de: 'Grüner Knollenblätterpilz',
    uk: 'Бліда поганка', sk: 'Muchotrávka zelená', cs: 'Muchomůrka zelená', lt: 'Žalsvoji musmirė'
  },
  amanita_pantherina: {
    pl: 'Muchomor plamisty', en: 'Panther cap', de: 'Pantherpilz',
    uk: 'Мухомор пантерний', sk: 'Muchotrávka tigrovaná', cs: 'Muchomůrka panterová', lt: 'Margoji musmirė'
  },
  amanita_rubescens: {
    pl: 'Muchomor czerwonawy', en: 'The blusher', de: 'Perlpilz',
    uk: 'Мухомор сіро-рожевий', sk: 'Muchotrávka červenkastá', cs: 'Muchomůrka růžovka', lt: 'Rausvoji musmirė'
  },
  amanita_virosa: {
    pl: 'Muchomor jadowity', en: 'Destroying angel', de: 'Kegelhütiger Knollenblätterpilz',
    uk: 'Мухомор білий смердючий', sk: 'Muchotrávka biela', cs: 'Muchomůrka jízlivá', lt: 'Smailiakepurė musmirė'
  },
  agaricus_campestris: {
    pl: 'Pieczarka polna', en: 'Field mushroom', de: 'Wiesen-Champignon',
    uk: 'Печериця звичайна', sk: 'Pečiarka poľná', cs: 'Pečárka polní', lt: 'Dirvinis pievagrybis'
  },
  agaricus_arvensis: {
    pl: 'Pieczarka biaława (owcza)', en: 'Horse mushroom', de: 'Schaf-Champignon',
    uk: 'Печериця польова', sk: 'Pečiarka ovčia', cs: 'Pečárka ovčí', lt: 'Gelsvasis pievagrybis'
  },
  agaricus_xanthodermus: {
    pl: 'Pieczarka karbolowa', en: 'Yellow-staining mushroom', de: 'Karbol-Champignon',
    uk: 'Печериця рудіюca', sk: 'Pečiarka zápašná', cs: 'Pečárka zápašná', lt: 'Nuodingasis pievagrybis'
  },
  armillaria_mellea: {
    pl: 'Opieńka miodowa', en: 'Honey fungus', de: 'Honiggelber Hallimasch',
    uk: 'Опеньок осінній', sk: 'Podpňovka obyčajná', cs: 'Václavka obecná', lt: 'Paprastasis kelmutis'
  },
  armillaria_ostoyae: {
    pl: 'Opieńka ciemna', en: 'Dark honey fungus', de: 'Dunkler Hallimasch',
    uk: 'Опеньок темний', sk: 'Podpňovka tmavá', cs: 'Václavka smrková', lt: 'Tamsusis kelmutis'
  },
  marasmius_oreades: {
    pl: 'Twardzioszek przydrożny (przydrożka)', en: 'Fairy ring champignon', de: 'Nelken-Schwindling',
    uk: 'Опеньок луговий', sk: 'Špička trávová', cs: 'Špička obecná', lt: 'Pievinis mažūnis'
  },
  pleurotus_ostreatus: {
    pl: 'Boczniak ostrygowaty', en: 'Oyster mushroom', de: 'Austern-Seitling',
    uk: 'Глива звичайна', sk: 'Hliva ustricovitá', cs: 'Hlíva ústřičná', lt: 'Paprastoji kreivabudė'
  },
  flammulina_velutipes: {
    pl: 'Płomiennica zimowa (zimówka)', en: 'Velvet shank (enoki)', de: 'Gemeiner Samtfußrübling',
    uk: 'Опеньок зимовий', sk: 'Plamienka zimná', cs: 'Penízovka sametonohá', lt: 'Žieminis kelmutis'
  },
  calvatia_gigantea: {
    pl: 'Czasznica olbrzymia', en: 'Giant puffball', de: 'Riesenbovist',
    uk: 'Дощовик велетенський', sk: 'Rozpadavec obrovský', cs: 'Pýchavka obrovská', lt: 'Didysis kukurdvelkis'
  },
  lycoperdon_perlatum: {
    pl: 'Purchawka chropowata', en: 'Common puffball', de: 'Flaschenbovist',
    uk: 'Дощовик їстівний', sk: 'Prášnica bradavičnatá', cs: 'Pýchavka obecná', lt: 'Karpotasis pumpotaukšlis'
  },
  morchella_esculenta: {
    pl: 'Smardz jadalny', en: 'Yellow morel', de: 'Speise-Morchel',
    uk: 'Зморшок їстівний', sk: 'Smrčok jedlý', cs: 'Smrž obecný', lt: 'Valgomasis briedžiukas'
  },
  gyromitra_esculenta: {
    pl: 'Piestrzenica kasztanowata', en: 'False morel', de: 'Frühjahrslorchel',
    uk: 'Строчок звичайний', sk: 'Ušiak obyčajný', cs: 'Ucháč obecný', lt: 'Valgomoji bobausė'
  },
  coprinus_comatus: {
    pl: 'Czernidłak kołpakowaty', en: 'Shaggy inkcap', de: 'Schopftintling',
    uk: 'Гнойовик білий', sk: 'Hnojník obyčajný', cs: 'Hnojník obecný', lt: 'Gauruotasis mėšlagrybis'
  },
  laetiporus_sulphureus: {
    pl: 'Żółciak siarkowy (\'leśny kurczak\')', en: 'Chicken of the woods', de: 'Schwefelporling',
    uk: 'Трутовик сірчано-жовтий', sk: 'Sírovec obyčajný', cs: 'Sírovec žlutooranžový', lt: 'Valgomoji geltonpintė'
  },
  sparassis_crispa: {
    pl: 'Siedzuń sosnowy (szmaciak)', en: 'Cauliflower mushroom', de: 'Krause Glucke',
    uk: 'Спарасис кучерявий', sk: 'Kučierka veľká', cs: 'Kotrč kadeřavý', lt: 'Kopūstgalvis raukšlius'
  },
  hydnum_repandum: {
    pl: 'Kolczak obłączasty', en: 'Wood hedgehog', de: 'Semmel-Stoppelpilz',
    uk: 'Їжовик жовтуватий', sk: 'Jelenkovec poprehýbaný', cs: 'Lišák zprohýbaný', lt: 'Raukšlėtasis dyglutis'
  },
  russula_vesca: {
    pl: 'Gołąbek wyborny', en: 'Bare-toothed russula', de: 'Fleischroter Täubling',
    uk: 'Сироїжка їстівна', sk: 'Plávka mandľová', cs: 'Holubinka mandlová', lt: 'Valgomoji ūmėdė'
  },
  russula_cyanoxantha: {
    pl: 'Gołąbek zielonawofioletowy', en: 'Charcoal burner', de: 'Frauentäubling',
    uk: 'Сироїжка синьо-зелена', sk: 'Plávka modrastá', cs: 'Holubinka namodralá', lt: 'Melsvažalė ūmėdė'
  },
  russula_emetica: {
    pl: 'Gołąbek wymiotny', en: 'The sickener', de: 'Spei-Täubling',
    uk: 'Сироїжка блювотна', sk: 'Plávka vrhavá', cs: 'Holubinka vrhavka', lt: 'Karčioji ūmėdė'
  },
  tricholoma_equestre: {
    pl: 'Gąska zielonka', en: 'Yellow knight', de: 'Grünling',
    uk: 'Зеленушка', sk: 'Čírovnica zelenkastá', cs: 'Čirůvka zelánka', lt: 'Žaliuokė'
  },
  tricholoma_portentosum: {
    pl: 'Gąska niepodzielna (siwa)', en: 'Streaked tricholoma', de: 'Schwarzfaseriger Ritterling',
    uk: 'Рядовка сіра', sk: 'Čírovnica sivá', cs: 'Čirůvka havelka', lt: 'Pilkoji meškabudė'
  },
  lepista_nuda: {
    pl: 'Gąsówka fioletowawa', en: 'Wood blewit', de: 'Violetter Rötelritterling',
    uk: 'Рядовка фіолетова', sk: 'Pôvabnica fialová', cs: 'Rudočišec fialový', lt: 'Melsvoji tauriabudė'
  },
  tylopilus_felleus: {
    pl: 'Goryczak żółciowy (szatan)', en: 'Bitter bolete', de: 'Gallenröhrling',
    uk: 'Жовчний гриб', sk: 'Podhríb žlčový', cs: 'Hřib žlučník', lt: 'Aitrusis baravykas'
  },
  neoboletus_luridiformis: {
    pl: 'Krasnoborowik ceglastopory', en: 'Scarletina bolete', de: 'Flockenstieliger Hexen-Röhrling',
    uk: 'Боровик зернистоногий', sk: 'Hríb zrnitohlúbikový', cs: 'Hřib kovář', lt: 'Dėmėtasis baravykas'
  },
  rubroboletus_satanas: {
    pl: 'Krwistoborowik szatański', en: 'Satan\'s bolete', de: 'Satans-Röhrling',
    uk: 'Сатанинський гриб', sk: 'Hríb satan', cs: 'Hřib satan', lt: 'Šėtoninis baravykas'
  }
};

export function getMushroomName(mushroom, lang = currentLang) {
  if (!mushroom) return '';
  const entry = MUSHROOM_NAMES[mushroom.id];
  if (entry && entry[lang]) return entry[lang];
  return mushroom.name || mushroom.latin;
}
