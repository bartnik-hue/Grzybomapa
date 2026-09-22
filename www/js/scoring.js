/**
 * scoring.js v2.0
 * ================
 * Algorytm prawdopodobieństwa wystąpienia grzybów
 *
 * Formuła końcowa dla każdego gatunku:
 *   score = prevalence × treeMatch × seasonScore × weatherScore
 *
 *   weatherScore = 0.40·tempScore + 0.35·rainScore + 0.25·humidScore
 *
 * Wszystkie komponenty 0..1, wynik końcowy 0..100
 */

// ─────────────────────────────────────────────────────────────────
// SCORING GATUNKÓW
// ─────────────────────────────────────────────────────────────────

/**
 * Oblicz wynik (0..100) dla każdego grzyba
 * @param {Array}  mushrooms      — lista z mushroom_knowledge z _treeMatch
 * @param {Object} weatherAnalysis — wynik z weather.js analyzeWeather()
 * @param {number} month          — aktualny miesiąc 1..12
 * @returns {Array} posortowane [{...mushroom, score, components}]
 */
export function scoreAllMushrooms(mushrooms, weatherAnalysis, month = new Date().getMonth() + 1) {
  return mushrooms
    .map(m => {
      // — Sezon
      const seasonScore = calcSeasonScore(m, month);

      // — Warunki pogodowe
      const weatherScore = weatherAnalysis
        ? calcWeatherScore(m, weatherAnalysis)
        : 0.45; // Brak pogody: neutralna wartość

      // — Dopasowanie drzew (wstrzyknięte przez mushroom_knowledge)
      const treeMatch = m._treeMatch ?? 1.0;
      const habitatBonus = m._habitatBonus ?? 0;

      // — Wynik końcowy
      const raw = m.prevalence * (treeMatch + habitatBonus) * seasonScore * weatherScore;
      const score = Math.min(Math.round(raw * 100), 100);

      return {
        ...m,
        score,
        seasonScore,
        weatherScore,
        treeMatch,
        components: {
          prevalence:   Math.round(m.prevalence * 100),
          tree:         Math.round((treeMatch + habitatBonus) * 100),
          season:       Math.round(seasonScore * 100),
          weather:      Math.round(weatherScore * 100),
        },
      };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────
// SCORING SEZONOWY
// ─────────────────────────────────────────────────────────────────

function calcSeasonScore(mushroom, month) {
  const { months = [], peakMonths = [] } = mushroom;
  if (!months.length) return 0.5; // brak danych o sezonie
  if (!months.includes(month))  return 0;
  return peakMonths.includes(month) ? 1.0 : 0.55;
}

// ─────────────────────────────────────────────────────────────────
// SCORING POGODOWY — serce algorytmu
// ─────────────────────────────────────────────────────────────────

function calcWeatherScore(mushroom, wa) {
  const eco = mushroom.ecology;
  if (!eco) return 0.5;

  // 1. Temperatura nocna / średnia 7-dniowa
  const tempScore = calcTempScore(eco, wa);

  // 2. Opady — impuls wzrostu + tło wilgoci
  const rainScore = calcRainScore(eco, wa);

  // 3. Wilgotność powietrza
  const humidScore = calcHumidScore(eco, wa);

  return clamp(0.40 * tempScore + 0.35 * rainScore + 0.25 * humidScore, 0, 1);
}

/**
 * Temperatura: grzyb rośnie w przedziale [tempMin, tempMax]
 * Optimum = tempOpt. Poza przedziałem: 0.
 */
function calcTempScore(eco, wa) {
  // Preferuj temperaturę nocną (Tmin ostatnie 7 dni)
  const temp = wa.avgNightTemp7 ?? wa.avgNightTemp14 ?? wa.avgTemp7 ?? null;
  if (temp === null) return 0.5;

  const { tempMin = 2, tempMax = 25, tempOpt = 13 } = eco;

  if (temp < tempMin || temp > tempMax) return 0;

  // Paraboliczne optimum
  const range = tempOpt - tempMin;
  if (range <= 0) return 0.7;

  if (temp <= tempOpt) {
    return 0.4 + 0.6 * ((temp - tempMin) / range);
  } else {
    const downRange = tempMax - tempOpt;
    if (downRange <= 0) return 0.7;
    return 1.0 - 0.5 * ((temp - tempOpt) / downRange);
  }
}

/**
 * Opady: dwa komponenty
 *  A) Tło 14-dniowe (gleba zdążyła się namoczyć)
 *  B) Impuls: opad X dni temu musi wpaść w okno daysAfter [min,max]
 */
function calcRainScore(eco, wa) {
  const { rain14min = 15, impulseMin = 8, daysAfter = [3, 8] } = eco;

  // — Tło 14-dniowe (max wkład 0.35)
  const rain14 = wa.totalRain14 ?? wa.totalPrecip14 ?? null;
  let bgScore = 0;
  if (rain14 !== null) {
    if (rain14 >= rain14min) {
      bgScore = Math.min((rain14 - rain14min) / (rain14min * 1.5) + 0.5, 1.0);
    } else {
      bgScore = rain14 / rain14min * 0.35;
    }
  } else {
    bgScore = 0.45;
  }

  // — Impuls wzrostu (max wkład 0.65)
  // Szukamy opadów w optymalnym oknie (daysAfter[0]..daysAfter[1] dni temu)
  const rainByDay = wa.rainByDay ?? null; // {1: mm, 2: mm, ...} dni wstecz
  let impulseScore = 0.3; // jeśli brak danych — umiarkowanie zakładamy impuls

  if (rainByDay) {
    // Zbierz sumę opadów z okna czasowego
    let windowRain = 0;
    for (let d = daysAfter[0]; d <= daysAfter[1]; d++) {
      windowRain += rainByDay[d] ?? 0;
    }
    if (windowRain >= impulseMin) {
      impulseScore = Math.min(0.5 + 0.5 * (windowRain - impulseMin) / (impulseMin * 2), 1.0);
    } else {
      impulseScore = windowRain / impulseMin * 0.5;
    }
  }

  return clamp(0.35 * bgScore + 0.65 * impulseScore, 0, 1);
}

/**
 * Wilgotność powietrza: grzyb wymaga minimum humidityMin %
 */
function calcHumidScore(eco, wa) {
  const { humidityMin = 60 } = eco;
  const humid = wa.avgHumidity7 ?? wa.avgHumidity14 ?? null;
  if (humid === null) return 0.5;

  if (humid >= humidityMin + 15) return 1.0;
  if (humid >= humidityMin)       return 0.6 + 0.4 * (humid - humidityMin) / 15;
  if (humid >= humidityMin - 15)  return 0.2 + 0.4 * (humid - (humidityMin - 15)) / 15;
  return 0;
}

// ─────────────────────────────────────────────────────────────────
// OGÓLNA OCENA WARUNKÓW GRZYBIARSKICH
// ─────────────────────────────────────────────────────────────────

/**
 * Oblicz ogólny wskaźnik warunków (0..100) niezależny od gatunku
 */
/**
 * Oblicz ocenę ekologiczną drzewostanu na podstawie wieku, gatunku i siedliska (BDL)
 */
export function scoreStand(props) {
  if (!props) return null;
  const age = parseInt(props.spec_age || props.specAge || 0, 10);
  const spec = (props.species_cd || props.speciesCodes?.[0] || props.rawCode || '').toUpperCase().trim();
  const site = (props.site_type || props.habitatCode || '').toUpperCase().trim();

  // 1. Wiek drzewostanu (klucz do wytworzenia mikoryzy z grzybami)
  let ageScore = 0.5;
  let ageDesc = '';
  let ageImpact = '+0%';
  if (age <= 4) {
    ageScore = 0.05;
    ageDesc = `Uprawa (${age} l.) — brak rozwiniętej mikoryzy podgrzybków i borowików`;
    ageImpact = '-40%';
  } else if (age <= 15) {
    ageScore = 0.72;
    ageDesc = `Młodnik (${age} l.) — wysyp maślaków, rydzów i purchawek`;
    ageImpact = '+20%';
  } else if (age <= 35) {
    ageScore = 0.65;
    ageDesc = `Drzewostan młody (${age} l.) — umiarkowane owocowanie`;
    ageImpact = '+15%';
  } else if (age <= 70) {
    ageScore = 0.88;
    ageDesc = `Drzewostan dojrzewający (${age} l.) — bogata mikoryza podgrzybkowa i kurkowa`;
    ageImpact = '+30%';
  } else if (age <= 130) {
    ageScore = 0.98;
    ageDesc = `Starodrzew (${age} l.) — optymalne siedlisko borowika szlachetnego i podgrzybka`;
    ageImpact = '+35%';
  } else {
    ageScore = 0.82;
    ageDesc = `Starodrzew sędziwy (${age} l.) — dojrzały ekosystem leśny`;
    ageImpact = '+25%';
  }

  // 2. Gatunek drzewa
  let specScore = 0.65;
  let specDesc = `Gatunek: ${spec || 'Mieszany'}`;
  let specImpact = '+15%';
  if (spec.startsWith('SO') || spec.startsWith('ŚW') || spec.startsWith('MD')) {
    specScore = 1.0;
    specDesc = `Iglasty (${spec.slice(0,2)}) — kluczowy dla borowików, podgrzybków i maślaków`;
    specImpact = '+25%';
  } else if (spec.startsWith('DB') || spec.startsWith('BK')) {
    specScore = 0.95;
    specDesc = `Dąb / Buk (${spec.slice(0,2)}) — borowiki usiatkowane, kurki, koźlarze`;
    specImpact = '+22%';
  } else if (spec.startsWith('BRZ')) {
    specScore = 0.90;
    specDesc = `Brzoza (${spec.slice(0,3)}) — koźlarze babki i czerwone`;
    specImpact = '+20%';
  } else if (spec.startsWith('OL') || spec.startsWith('JS')) {
    specScore = 0.25;
    specDesc = `Olsza / Jesion (${spec.slice(0,2)}) — siedlisko podmokłe, niska wartość grzybiarska`;
    specImpact = '-20%';
  }

  // 3. Siedlisko (Site Type)
  let siteScore = 0.70;
  let siteDesc = `Siedlisko: ${site || 'Brak danych'}`;
  let siteImpact = '+15%';
  if (site.includes('BMŚW')) {
    siteScore = 1.0;
    siteDesc = `Bór mieszany świeży (${site}) — najwyższa różnorodność grzybów w Polsce`;
    siteImpact = '+25%';
  } else if (site.includes('BŚW')) {
    siteScore = 0.95;
    siteDesc = `Bór świeży (${site}) — klasyczne siedlisko podgrzybka i borowika`;
    siteImpact = '+23%';
  } else if (site.includes('LMŚW')) {
    siteScore = 0.90;
    siteDesc = `Las mieszany świeży (${site}) — bardzo dobre siedlisko runa leśnego`;
    siteImpact = '+20%';
  } else if (site.includes('LŚW')) {
    siteScore = 0.80;
    siteDesc = `Las świeży (${site}) — próchnicze siedlisko liściaste`;
    siteImpact = '+18%';
  } else if (site.includes('SUCH')) {
    siteScore = 0.30;
    siteDesc = `Bór suchy (${site}) — piaszczysta gleba, szybko wysycha`;
    siteImpact = '-20%';
  } else if (site.includes('B') || site.includes('OL')) {
    siteScore = 0.20;
    siteDesc = `Siedlisko bagienne / ols (${site}) — zastoiska wody`;
    siteImpact = '-25%';
  }

  const standScore = age <= 4 ? 0.08 : (0.50 * ageScore + 0.30 * specScore + 0.20 * siteScore);
  return {
    standScore,
    age,
    ageScore,
    ageDesc,
    ageImpact,
    spec,
    specScore,
    specDesc,
    specImpact,
    site,
    siteScore,
    siteDesc,
    siteImpact,
  };
}

/**
 * Oblicz ogólny wskaźnik warunków (0..100) łączący pogodę i jakość drzewostanu
 */
export function calculateOverallScore(weatherAnalysis, forestData) {
  if (!weatherAnalysis && !forestData) return 0;
  const wa = weatherAnalysis;

  // Pogoda
  let weatherScore = 0.50;
  if (wa) {
    const nightTemp = wa.avgNightTemp7 ?? wa.avgNightTemp14 ?? wa.avgTemp7 ?? 12;
    const tempScore = nightTemp >= 4 && nightTemp <= 20
      ? Math.max(0, 1 - Math.abs(nightTemp - 12) / 10)
      : 0;

    const rain14 = wa.totalRain14 ?? wa.totalPrecip14 ?? 0;
    const rainScore = rain14 < 10  ? rain14 / 25
      : rain14 < 40  ? 0.5 + (rain14 - 10) / 60
      : rain14 < 100 ? 1.0
      : Math.max(0, 1 - (rain14 - 100) / 80);

    const humid = wa.avgHumidity7 ?? wa.avgHumidity14 ?? 65;
    const humidScore = clamp((humid - 45) / 40, 0, 1);

    weatherScore = 0.35 * tempScore + 0.40 * rainScore + 0.25 * humidScore;
  }

  // Drzewostan
  const stand = scoreStand(forestData);
  const standScore = stand ? stand.standScore : 0.65;

  const raw = forestData ? (0.55 * standScore + 0.45 * weatherScore) : weatherScore;
  return Math.round(clamp(raw, 0.05, 1.0) * 100);
}

/**
 * Generuje szczegółową, zrozumiałą diagnozę przyczyn oceny warunków w danym punkcie
 */
export function generateDetailedDiagnosis(overallScore, weatherAnalysis, forestData) {
  const factors = [];
  const stand = scoreStand(forestData);
  const wa = weatherAnalysis;

  // 1. Drzewostan
  if (stand) {
    factors.push({
      type: stand.age <= 4 ? 'bad' : 'good',
      icon: stand.age <= 4 ? '⚠️' : '🌲',
      title: 'Drzewostan i wiek',
      val: `${stand.specDesc.split('—')[0].trim()}, wiek ${stand.age} l.`,
      desc: stand.ageDesc,
      impact: stand.ageImpact,
    });

    factors.push({
      type: stand.siteScore < 0.5 ? 'bad' : 'good',
      icon: '🏷️',
      title: 'Typ siedliska leśnego',
      val: stand.site || 'Bór świeży',
      desc: stand.siteDesc,
      impact: stand.siteImpact,
    });
  } else {
    factors.push({
      type: 'neutral',
      icon: '🌲',
      title: 'Drzewostan',
      val: 'Teren otwarty lub las prywatny',
      desc: 'Brak szczegółowej ewidencji wydzielenia LP w bazie BDL',
      impact: '—',
    });
  }

  // 2. Pogoda — opady
  if (wa) {
    const rain = wa.totalRain14 ?? 0;
    const days = wa.daysSinceRain ?? 4;
    const rainGood = rain >= 25 && rain <= 90;
    factors.push({
      type: rainGood ? 'good' : (rain < 12 ? 'bad' : 'neutral'),
      icon: '🌧️',
      title: 'Suma opadów i wilgoć',
      val: `${Math.round(rain)} mm / 14 dni (${days} dni od deszczu)`,
      desc: rainGood
        ? 'Optymalna wilgotność ściółki leśnej, impuls wzrostowy aktywny'
        : (rain < 12 ? 'Znaczny niedobór wody — ściółka jest przesuszona' : 'Umiarkowane opady deszczu'),
      impact: rainGood ? '+25%' : (rain < 12 ? '-30%' : '+10%'),
    });

    // 3. Temperatura
    const temp = wa.avgNightTemp7 ?? wa.avgTemp7 ?? 13;
    const tempGood = temp >= 9 && temp <= 16;
    factors.push({
      type: tempGood ? 'good' : (temp < 4 || temp > 22 ? 'bad' : 'neutral'),
      icon: '🌡️',
      title: 'Temperatura nocna',
      val: `${temp.toFixed(1)}°C (średnia 7-dniowa)`,
      desc: tempGood
        ? 'Ciepłe noce bez przymrozków stymulują intensywny rozwój owocników'
        : (temp < 4 ? 'Chłód nocny spowalnia wzrost grzybni' : 'Upały mogą wysuszać małe owocniki'),
      impact: tempGood ? '+18%' : (temp < 4 ? '-25%' : '+5%'),
    });
  }

  return factors;
}

/**
 * Generuj tekstowe podsumowanie sezonu
 */
export function generateSummary(overallScore, weatherAnalysis, forestName) {
  const wa = weatherAnalysis;
  const name = forestName ? ` w ${forestName}` : '';

  const temp = wa?.avgNightTemp7 ?? wa?.avgTemp7 ?? null;
  const rain = wa?.totalRain14 ?? wa?.totalPrecip14 ?? null;

  let main = '';
  if (overallScore >= 75) {
    main = `Znakomite warunki grzybiarskie${name}! Dojrzały drzewostan, temperatura nocna${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} i opady${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} idealnie sprzyjają owocowaniu.`;
  } else if (overallScore >= 50) {
    main = `Dobre warunki${name}. Grzyby są aktywne, a mikoryza funkcjonuje prawidłowo.`;
  } else if (overallScore >= 25) {
    main = `Umiarkowane lub osłabione warunki${name}. Zwróć uwagę na wiek drzewostanu lub wilgotność podłoża.`;
  } else {
    main = `Niekorzystne warunki${name}. Młoda uprawa, brak mikoryzy lub zbyt sucha gleba uniemożliwiają owocowanie.`;
  }

  // Przydatna wskazówka na bazie konkretnych danych
  let tip = '';
  if (wa?.daysSinceRain !== undefined && wa.daysSinceRain >= 3 && wa.daysSinceRain <= 8) {
    tip = `🌱 Ostatni deszcz ${wa.daysSinceRain} dni temu — trwa szczyt fali wysypu borowików i podgrzybków.`;
  } else if (wa?.daysSinceRain !== undefined && wa.daysSinceRain < 2) {
    tip = `💧 Świeży deszcz — daj grzybni 2-3 dni na wykształcenie owocników.`;
  } else if (wa?.daysSinceRain !== undefined && wa.daysSinceRain > 10) {
    tip = `🏜️ Długo bez deszczu. Szukaj w obniżeniach terenu, przy rowach i ciekach wodnych.`;
  }

  return { main, tip };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS UI
// ─────────────────────────────────────────────────────────────────

export function edibleLabel(edible) {
  const map = {
    'jadalne':   { text: 'Jadalne',        cls: 'edible-yes'  },
    'trujące':   { text: 'Trujący!',       cls: 'edible-no'   },
    'niejadalne':{ text: 'Niejadalne',     cls: 'edible-warn' },
    'uwaga':     { text: 'Uwaga!',         cls: 'edible-warn' },
  };
  return map[edible] || { text: edible, cls: 'edible-info' };
}

export function scoreToColor(score) {
  if (score >= 65) return '#22c55e';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

export function scoreToLabel(score) {
  if (score >= 65) return 'Wysokie';
  if (score >= 40) return 'Umiarkowane';
  if (score >= 20) return 'Niskie';
  return 'Bardzo niskie';
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
