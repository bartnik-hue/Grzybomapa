/**
 * scoring.js v2.1 (i18n support)
 * ==============================
 * Algorytm prawdopodobieństwa wystąpienia grzybów
 *
 * Formuła końcowa dla każdego gatunku:
 *   score = prevalence × treeMatch × seasonScore × weatherScore
 *
 *   weatherScore = 0.40·tempScore + 0.35·rainScore + 0.25·humidScore
 *
 * Wszystkie komponenty 0..1, wynik końcowy 0..100
 */

import { t, getLang, decodeHabitat, getTreeSpeciesName, LANGUAGES } from './i18n.js';

// ─────────────────────────────────────────────────────────────────
// SCORING GATUNKÓW
// ─────────────────────────────────────────────────────────────────

/**
 * Oblicz wynik (0..100) dla każdego grzyba
 * @param {Array}  mushrooms       — lista z mushroom_knowledge z _treeMatch, _ageFactor, _habitatBonus
 * @param {Object} weatherAnalysis — wynik z weather.js analyzeWeather()
 * @param {number} month           — aktualny miesiąc 1..12
 * @param {Object} forestData      — obiekt danych leśnych
 * @returns {Array} posortowane [{...mushroom, score, components}]
 */
export function scoreAllMushrooms(mushrooms, weatherAnalysis, month = new Date().getMonth() + 1, forestData = null) {
  if (forestData && forestData.isForest === false) {
    if (forestData.terrainType === 'urban' || forestData.terrainType === 'water') {
      return []; // Teren miejski lub wodny — brak jakichkolwiek grzybów
    }
  }

  return mushrooms
    .map(m => {
      // — Sezon
      const seasonScore = calcSeasonScore(m, month);

      // — Warunki pogodowe
      const weatherScore = weatherAnalysis
        ? calcWeatherScore(m, weatherAnalysis)
        : 0.45; // Brak pogody: neutralna wartość

      // — Dopasowanie drzew i wieku (wstrzyknięte przez mushroom_knowledge)
      const treeMatch = m._treeMatch ?? 1.0;
      const ageFactor = m._ageFactor ?? 1.0;
      const habitatBonus = m._habitatBonus ?? 0;

      // — Ekologiczna waga pospolitości
      const prevFactor = 0.55 + 0.45 * (m.prevalence || 0.5);

      // — Wynik końcowy gatunku
      const standFactor = Math.max(0, (treeMatch + habitatBonus) * ageFactor);
      const raw = standFactor * seasonScore * weatherScore * prevFactor;
      const score = Math.min(Math.round(raw * 100), 100);

      return {
        ...m,
        score,
        seasonScore,
        weatherScore,
        treeMatch,
        matchedTreeName: m._matchedTreeName || '',
        ageNote: m._ageNote || '',
        habitatNote: m._habitatNote || '',
        components: {
          prevalence:   Math.round((m.prevalence || 0.5) * 100),
          tree:         Math.min(100, Math.round(standFactor * 100)),
          season:       Math.round(seasonScore * 100),
          weather:      Math.round(weatherScore * 100),
        },
      };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Oblicz prognozowane szanse na grzybobranie na kolejne 7 dni na podstawie prognozy Open-Meteo
 * @param {Object} weatherData — obiekt z getWeatherData ({ current, history14d, forecast7d, analysis })
 * @param {Object} forestData  — obiekt z getForestData
 * @returns {Object|null} { days: [...], bestDay, tacticalTip }
 */
export function calculateDailyForecastScores(weatherData, forestData) {
  const daily = weatherData?.forecast7d;
  if (!daily || !daily.time || !daily.time.length) return null;

  const times = daily.time;
  const rains = daily.precipitation_sum || [];
  const tMaxs = daily.temperature_2m_max || [];
  const tMins = daily.temperature_2m_min || [];
  const probs = daily.precipitation_probability_max || [];
  const codes = daily.weathercode || [];

  const histRain14 = weatherData?.analysis?.totalRain14 ?? 18;
  const days = [];
  let cumRainFuture = 0;
  let bestDayIndex = 0;
  let maxScore = -1;

  const lang = getLang();
  const locale = LANGUAGES[lang]?.locale || 'pl-PL';

  for (let i = 0; i < times.length; i++) {
    const dateStr = times[i];
    const rain = rains[i] ?? 0;
    const tMax = tMaxs[i] ?? 18;
    const tMin = tMins[i] ?? 10;
    const prob = probs[i] ?? 0;
    const code = codes[i] ?? 0;

    cumRainFuture += rain;
    const effRain14 = Math.max(0, histRain14 * Math.pow(0.93, i + 1) + cumRainFuture);
    const avgTemp = (tMax + tMin) / 2;

    const simWeather = {
      avgNightTemp7: tMin,
      avgTemp7: avgTemp,
      totalRain14: effRain14,
      avgHumidity7: rain > 4 ? 82 : (prob > 50 ? 75 : 62),
    };

    const dayScore = calculateOverallScore(simWeather, forestData);

    let trend = 'steady';
    if (i > 0) {
      const prev = days[i - 1].score;
      if (dayScore - prev >= 5) trend = 'up';
      else if (prev - dayScore >= 5) trend = 'down';
    }

    if (dayScore > maxScore) {
      maxScore = dayScore;
      bestDayIndex = i;
    }

    const dateObj = new Date(dateStr);
    const dayName = dateObj.toLocaleDateString(locale, { weekday: 'short' });
    const dayDate = dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });

    days.push({
      date: dateStr,
      dayName: dayName.toUpperCase(),
      dayDate,
      rain: Math.round(rain * 10) / 10,
      prob: Math.round(prob),
      tMax: Math.round(tMax),
      tMin: Math.round(tMin),
      code,
      score: dayScore,
      trend,
    });
  }

  const bestDay = days[bestDayIndex];
  let tacticalTip = '';

  const tips = {
    pl: {
      urbanWater: '🏙️ **Obszar zurbanizowany / woda:** Brak warunków do owocowania grzybów. Wybierz las na mapie.',
      meadow: '🌾 **Teren łąkowy / otwarty:** Grzyby leśne tu nie występują. Po deszczu wypatruj pieczarek polnych i twardzioszka przydrożnego na pastwiskach i łąkach.',
      high: `🎯 **Najlepszy dzień na grzybobranie:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% szans). Znakomity bilans wilgoci i temperatury.`,
      med: `🌦️ **Optymalne okno:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% szans). Umiarkowany wysyp — szukaj w wilgotnych zagłębieniach, zagajnikach i mchu.`,
      low: `🍂 **Suchy okres w prognozie:** Najkorzystniej wypada ${bestDay?.dayName} (${bestDay?.score}%). Brak większych opadów ogranicza wysypy.`,
    },
    en: {
      urbanWater: '🏙️ **Urban area / water:** No mushroom fruiting conditions. Pick a woodland on the map.',
      meadow: '🌾 **Open land / meadow:** Woodland mycorrhizal mushrooms do not grow here. After rain look for field mushrooms and fairy ring champignons.',
      high: `🎯 **Best foraging day:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% chance). Excellent moisture and temperature balance.`,
      med: `🌦️ **Optimal window:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% chance). Moderate flush — look in damp hollows, thickets, and moss.`,
      low: `🍂 **Dry forecast ahead:** Best day is ${bestDay?.dayName} (${bestDay?.score}%). Lack of significant rain limits fruiting.`,
    },
    de: {
      urbanWater: '🏙️ **Siedlungsgebiet / Gewässer:** Keine Pilzwachstums-Bedingungen. Wählen Sie Wald auf der Karte.',
      meadow: '🌾 **Offenes Land / Wiese:** Wald-Mykorrhizapilze wachsen hier nicht. Nach Regen nach Wiesen-Champignons und Nelkenschwindlingen suchen.',
      high: `🎯 **Bester Tag zum Pilzesammeln:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% Chance). Hervorragende Feuchte- und Temperaturwerte.`,
      med: `🌦️ **Optimales Zeitfenster:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% Chance). Mäßiges Aufkommen — in feuchten Senken und Moos suchen.`,
      low: `🍂 **Trockene Periode:** Am günstigsten schneidet ${bestDay?.dayName} (${bestDay?.score}%) ab. Mangelnde Niederschläge hemmen das Wachstum.`,
    },
    uk: {
      urbanWater: '🏙️ **Забудова / водойма:** Умови для грибів відсутні. Оберіть ліс на карті.',
      meadow: '🌾 **Луг / відкрита місцевість:** Лісові мікоризні гриби тут не ростуть. Після дощу шукайте польові печериці та лучні опеньки.',
      high: `🎯 **Найкращий день для збору:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% шансів). Відмінний баланс вологи й тепла.`,
      med: `🌦️ **Оптимальне вікно:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% шансів). Помірний шар — шукайте у вологих низинах і моху.`,
      low: `🍂 **Сухий період:** Найсприятливіший день — ${bestDay?.dayName} (${bestDay?.score}%). Відсутність сильних дощів стримує гриби.`,
    },
    sk: {
      urbanWater: '🏙️ **Zastavané územie / voda:** Podmienky pre huby chýbajú. Zvoľte les na mape.',
      meadow: '🌾 **Lúka / otvorený terén:** Lesné mykorízne huby tu nerastú. Po daždi hľadajte pečiarky a špičky.',
      high: `🎯 **Najlepší deň na huby:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% šanca). Skvelá bilancia vlahy a teploty.`,
      med: `🌦️ **Optimálne okno:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% šanca). Mierny rast — hľadajte vo vlhkejších závrtoch a machu.`,
      low: `🍂 **Suché obdobie v predpovedi:** Najlepšie vychádza ${bestDay?.dayName} (${bestDay?.score}%). Nedostatok zrážok obmedzuje rast.`,
    },
    cs: {
      urbanWater: '🏙️ **Zastavěná oblast / voda:** Podmínky pro růst hub chybí. Zvolte les na mapě.',
      meadow: '🌾 **Louka / otevřený terén:** Lesní mykorhizní houby zde nerostou. Po dešti hledejte žampiony a špičky.',
      high: `🎯 **Nejlepší den na houby:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% šance). Skvělá bilance vláhy a teploty.`,
      med: `🌦️ **Optimální okno:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% šance). Mírný růst — hledejte ve vlhkých úžlabinách a mechu.`,
      low: `🍂 **Suché období v předpovědi:** Nejlépe vychází ${bestDay?.dayName} (${bestDay?.score}%). Nedostatek srážek omezuje růst.`,
    },
    lt: {
      urbanWater: '🏙️ **Miestas / vanduo:** Grybai čia neauga. Pasirinkite mišką žemėlapyje.',
      meadow: '🌾 **Pieva / atvira vietovė:** Miško mikoriziniai grybai čia neauga. Po lietaus ieškokite pievagrybių ar mažūnių.',
      high: `🎯 **Geriausia diena grybauti:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% tikimybė). Puikus drėgmės ir temperatūros balansas.`,
      med: `🌦️ **Optimalus langas:** ${bestDay?.dayName} ${bestDay?.dayDate} (${bestDay?.score}% tikimybė). Vidutinis dygimas — ieškokite drėgnose įdubose ir samanose.`,
      low: `🍂 **Sausas laikotarpis:** Palankiausia diena yra ${bestDay?.dayName} (${bestDay?.score}%). Lietaus trūkumas riboja dygimą.`,
    }
  };

  const curTips = tips[lang] || tips.pl;

  if (forestData && forestData.isForest === false) {
    if (forestData.terrainType === 'urban' || forestData.terrainType === 'water') {
      tacticalTip = curTips.urbanWater;
    } else {
      tacticalTip = curTips.meadow;
    }
  } else if (bestDay) {
    if (bestDay.score >= 70) {
      tacticalTip = curTips.high;
    } else if (bestDay.score >= 45) {
      tacticalTip = curTips.med;
    } else {
      tacticalTip = curTips.low;
    }
  }

  return { days, bestDay, tacticalTip };
}

// ─────────────────────────────────────────────────────────────────
// SCORING SEZONOWY
// ─────────────────────────────────────────────────────────────────

function calcSeasonScore(mushroom, month) {
  const { months = [], peakMonths = [] } = mushroom;
  if (!months.length) return 0.5;
  if (!months.includes(month))  return 0;
  return peakMonths.includes(month) ? 1.0 : 0.55;
}

// ─────────────────────────────────────────────────────────────────
// SCORING POGODOWY
// ─────────────────────────────────────────────────────────────────

function calcWeatherScore(mushroom, wa) {
  const eco = mushroom.ecology;
  if (!eco) return 0.5;

  const tempScore = calcTempScore(eco, wa);
  const rainScore = calcRainScore(eco, wa);
  const humidScore = calcHumidScore(eco, wa);

  return clamp(0.40 * tempScore + 0.35 * rainScore + 0.25 * humidScore, 0, 1);
}

function calcTempScore(eco, wa) {
  const temp = wa.avgNightTemp7 ?? wa.avgNightTemp14 ?? wa.avgTemp7 ?? null;
  if (temp === null) return 0.5;

  const { tempMin = 2, tempMax = 25, tempOpt = 13 } = eco;
  if (temp < tempMin || temp > tempMax) return 0;

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

function calcRainScore(eco, wa) {
  const { rain14min = 15, impulseMin = 8, daysAfter = [3, 8] } = eco;
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

  const rainByDay = wa.rainByDay ?? null;
  let impulseScore = 0.3;

  if (rainByDay) {
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
// STAND SCORING
// ─────────────────────────────────────────────────────────────────

export function scoreStand(props) {
  if (!props || props.isForest === false) return null;
  const age = parseInt(props.spec_age || props.specAge || 0, 10);
  const spec = (props.species_cd || props.speciesCodes?.[0] || props.rawCode || '').toUpperCase().trim();
  const site = (props.site_type || props.habitatCode || '').toUpperCase().trim();
  const lang = getLang();

  // 1. Wiek drzewostanu
  let ageScore = 0.75;
  let ageDescKey = 'mature';
  let ageImpact = '+20%';

  if (age > 0 && age <= 4) {
    ageScore = 0.15;
    ageDescKey = 'sapling';
    ageImpact = '-40%';
  } else if (age > 4 && age <= 15) {
    ageScore = 0.75;
    ageDescKey = 'youngThicket';
    ageImpact = '+20%';
  } else if (age > 15 && age <= 35) {
    ageScore = 0.70;
    ageDescKey = 'poleStage';
    ageImpact = '+15%';
  } else if (age > 35 && age <= 70) {
    ageScore = 0.90;
    ageDescKey = 'maturing';
    ageImpact = '+30%';
  } else if (age > 70 && age <= 130) {
    ageScore = 0.98;
    ageDescKey = 'oldGrowth';
    ageImpact = '+35%';
  } else if (age > 130) {
    ageScore = 0.85;
    ageDescKey = 'ancient';
    ageImpact = '+25%';
  }

  const ageDescriptions = {
    pl: {
      sapling: `Uprawa (${age} l.) — brak rozwiniętej mikoryzy podgrzybków i borowików`,
      youngThicket: `Młodnik (${age} l.) — wysyp maślaków, rydzów i purchawek`,
      poleStage: `Drzewostan młody (${age} l.) — umiarkowane owocowanie`,
      maturing: `Drzewostan dojrzewający (${age} l.) — bogata mikoryza podgrzybkowa i kurkowa`,
      oldGrowth: `Starodrzew (${age} l.) — optymalne siedlisko borowika szlachetnego i podgrzybka`,
      ancient: `Starodrzew sędziwy (${age} l.) — dojrzały ekosystem leśny`,
      mature: 'Drzewostan dojrzały',
    },
    en: {
      sapling: `Young plantation (${age} yrs) — underdeveloped mycorrhizal network`,
      youngThicket: `Thicket (${age} yrs) — flush of slippery jacks, saffron milkcaps`,
      poleStage: `Young stand (${age} yrs) — moderate fruiting`,
      maturing: `Maturing stand (${age} yrs) — rich bay bolete and chanterelle mycorrhiza`,
      oldGrowth: `Old-growth (${age} yrs) — optimal habitat for king bolete and bay bolete`,
      ancient: `Ancient woodland (${age} yrs) — mature forest ecosystem`,
      mature: 'Mature woodland',
    },
    de: {
      sapling: `Schonung (${age} J.) — kaum entwickelte Mykorrhiza`,
      youngThicket: `Dickung (${age} J.) — Aufkommen von Butterpilzen und Reizkern`,
      poleStage: `Jungbestand (${age} J.) — mäßige Fruchtbildung`,
      maturing: `Reifender Bestand (${age} J.) — reiche Maronen- und Pfifferling-Mykorrhiza`,
      oldGrowth: `Altholz (${age} J.) — optimales Steinpilz- und Maronen-Habitat`,
      ancient: `Uralter Wald (${age} J.) — reifes Waldökosystem`,
      mature: 'Reifer Waldbestand',
    },
    uk: {
      sapling: `Лісопосадка (${age} р.) — слаборозвинена мікориза`,
      youngThicket: `Молодняк (${age} р.) — поява маслюків та рижиків`,
      poleStage: `Молодий ліс (${age} р.) — помірний врожай`,
      maturing: `Достигаючий деревостан (${age} р.) — багата мікориза польських і лисичок`,
      oldGrowth: `Стиглий ліс (${age} р.) — оптимум для білих та польських грибів`,
      ancient: `Старовіковий ліс (${age} р.) — зріла екосистема`,
      mature: 'Стиглий ліс',
    },
    sk: {
      sapling: `Výsadba (${age} r.) — nevyvinutá mykoríza hríbov`,
      youngThicket: `Mladina (${age} r.) — výskyt masliakov a rýdzikov`,
      poleStage: `Mladý porast (${age} r.) — mierne plodenie`,
      maturing: `Dozrievajúci porast (${age} r.) — bohatá mykoríza suchohríbov a kuriatok`,
      oldGrowth: `Starý les (${age} r.) — optimálny biotop pre hríb smrekový a suchohríby`,
      ancient: `Pralesný porast (${age} r.) — zrelý ekosystém`,
      mature: 'Dozretý porast',
    },
    cs: {
      sapling: `Výsadba (${age} let) — nevyvinutá mykorhiza hřibů`,
      youngThicket: `Mladina (${age} let) — výskyt klouzků a ryzců`,
      poleStage: `Mladý porost (${age} let) — mírná plodnost`,
      maturing: `Dozrávající porost (${age} let) — bohatá mykorhiza hřibů a lišek`,
      oldGrowth: `Starý les (${age} let) — optimální biotop pro hřib smrkový a hnědý`,
      ancient: `Pralesovitý porost (${age} let) — vyzrálý ekosystém`,
      mature: 'Dozrálý porost',
    },
    lt: {
      sapling: `Jaunuolynas (${age} m.) — neišsivysčiusi baravykų mikorizė`,
      youngThicket: `Bruzgynas (${age} m.) — kazlėkų ir rudmėsių dygimas`,
      poleStage: `Jaunas medynas (${age} m.) — vidutinis derėjimas`,
      maturing: `Bręstantis medynas (${age} m.) — gausi šilbaravykių ir voveraičių mikorizė`,
      oldGrowth: `Brandus miškas (${age} m.) — optimali tikrinių baravykų buveinė`,
      ancient: `Senas miškas (${age} m.) — susiformavusi ekosistema`,
      mature: 'Brandus miškas',
    }
  };

  const ageDesc = (ageDescriptions[lang] || ageDescriptions.pl)[ageDescKey];

  // 2. Gatunek drzewa
  let specScore = 0.65;
  let specDesc = `${t('btnTreeSpecies')}: ${spec || 'Mixed'}`;
  let specImpact = '+15%';

  if (spec.startsWith('SO') || spec.startsWith('ŚW') || spec.startsWith('SW') || spec.startsWith('MD')) {
    specScore = 1.0;
    specDesc = `${t('ftlConiferous')} (${spec.slice(0,2)})`;
    specImpact = '+25%';
  } else if (spec.startsWith('DB') || spec.startsWith('BK')) {
    specScore = 0.95;
    specDesc = `${getTreeSpeciesName('Db', lang)} / ${getTreeSpeciesName('Bk', lang)}`;
    specImpact = '+22%';
  } else if (spec.startsWith('BRZ')) {
    specScore = 0.90;
    specDesc = `${getTreeSpeciesName('Brz', lang)} (${spec.slice(0,3)})`;
    specImpact = '+20%';
  } else if (spec.startsWith('OL') || spec.startsWith('JS')) {
    specScore = 0.25;
    specDesc = `${getTreeSpeciesName('Ol', lang)} / ${getTreeSpeciesName('Js', lang)}`;
    specImpact = '-20%';
  }

  // 3. Siedlisko
  let siteScore = 0.70;
  const decodedHab = decodeHabitat(site, lang);
  let siteDesc = `${t('ecoHabitat')} ${decodedHab || site}`;
  let siteImpact = '+15%';

  if (site.includes('BMŚW') || site.includes('BMSW')) {
    siteScore = 1.0;
    siteImpact = '+25%';
  } else if (site.includes('BŚW') || site.includes('BSW')) {
    siteScore = 0.95;
    siteImpact = '+23%';
  } else if (site.includes('LMŚW') || site.includes('LMSW')) {
    siteScore = 0.90;
    siteImpact = '+20%';
  } else if (site.includes('LŚW') || site.includes('LSW')) {
    siteScore = 0.80;
    siteImpact = '+18%';
  } else if (site.includes('SUCH') || site.includes('BS')) {
    siteScore = 0.30;
    siteImpact = '-20%';
  } else if (site.includes('B') || site.includes('OL')) {
    siteScore = 0.20;
    siteImpact = '-25%';
  }

  const standScore = (age > 0 && age <= 4) ? 0.20 : (0.50 * ageScore + 0.30 * specScore + 0.20 * siteScore);
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

// ─────────────────────────────────────────────────────────────────
// OVERALL SCORE
// ─────────────────────────────────────────────────────────────────

export function calculateOverallScore(weatherAnalysis, forestData) {
  if (!weatherAnalysis && !forestData) return 0;

  if (forestData && forestData.isForest === false) {
    if (forestData.terrainType === 'urban' || forestData.terrainType === 'water') {
      return 0;
    }
    const wa = weatherAnalysis;
    let weatherFactor = 0.40;
    if (wa) {
      const rain14 = wa.totalRain14 ?? wa.totalPrecip14 ?? 0;
      const rainFactor = clamp(rain14 / 35, 0, 1);
      const tempNight = wa.avgNightTemp7 ?? wa.avgTemp7 ?? 12;
      const tempFactor = (tempNight >= 6 && tempNight <= 22) ? 1.0 : 0.3;
      weatherFactor = 0.60 * rainFactor + 0.40 * tempFactor;
    }
    return Math.round(clamp(weatherFactor * 25, 4, 25));
  }

  const wa = weatherAnalysis;
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

  const stand = scoreStand(forestData);
  const standScore = stand ? stand.standScore : 0.65;

  const raw = forestData ? (0.55 * standScore + 0.45 * weatherScore) : weatherScore;
  return Math.round(clamp(raw, 0.05, 1.0) * 100);
}

// ─────────────────────────────────────────────────────────────────
// DIAGNOSIS
// ─────────────────────────────────────────────────────────────────

export function generateDetailedDiagnosis(overallScore, weatherAnalysis, forestData) {
  const factors = [];
  const stand = scoreStand(forestData);
  const wa = weatherAnalysis;
  const lang = getLang();

  const labels = {
    pl: {
      standTitle: 'Drzewostan i wiek',
      siteTitle: 'Typ siedliska leśnego',
      coverTitle: 'Pokrycie terenu',
      rainTitle: 'Suma opadów i wilgoć',
      tempTitle: 'Temperatura nocna',
      rainGood: 'Optymalna wilgotność ściółki leśnej, impuls wzrostowy aktywny',
      rainDry: 'Znaczny niedobór wody — ściółka jest przesuszona',
      rainMod: 'Umiarkowane opady deszczu',
      tempGood: 'Ciepłe noce bez przymrozków stymulują intensywny rozwój owocników',
      tempCold: 'Chłód nocny spowalnia wzrost grzybni',
      tempHot: 'Upały mogą wysuszać małe owocniki',
      daysAgoRain: 'dni od deszczu',
      avg7d: 'średnia 7-dniowa',
      ageYears: 'l.',
    },
    en: {
      standTitle: 'Stand and age',
      siteTitle: 'Forest habitat type',
      coverTitle: 'Land cover',
      rainTitle: 'Rainfall & moisture',
      tempTitle: 'Night temperature',
      rainGood: 'Optimal forest floor moisture, growth impulse active',
      rainDry: 'Significant moisture deficit — dry forest floor',
      rainMod: 'Moderate rainfall',
      tempGood: 'Warm frost-free nights stimulate mushroom fruiting',
      tempCold: 'Cold night temperatures slow down mycelium',
      tempHot: 'Excessive heat dries out young fruitbodies',
      daysAgoRain: 'days since rain',
      avg7d: '7-day avg',
      ageYears: 'yrs',
    },
    de: {
      standTitle: 'Baumbestand und Alter',
      siteTitle: 'Standorttyp des Waldes',
      coverTitle: 'Bodenbedeckung',
      rainTitle: 'Niederschlag & Feuchtigkeit',
      tempTitle: 'Nachttemperatur',
      rainGood: 'Optimale Waldbodenfeuchtigkeit, Wachstumsreiz aktiv',
      rainDry: 'Erheblicher Wassermangel — Waldboden ist ausgetrocknet',
      rainMod: 'Mäßiger Regen',
      tempGood: 'Warme frostfreie Nächte fördern Fruchtkörperbildung',
      tempCold: 'Kühle Nächte verlangsamen das Myzelwachstum',
      tempHot: 'Hitze kann junge Fruchtkörper austrocknen',
      daysAgoRain: 'Tage nach Regen',
      avg7d: '7-Tage-Schnitt',
      ageYears: 'J.',
    },
    uk: {
      standTitle: 'Деревостан і вік',
      siteTitle: 'Тип лісового оселища',
      coverTitle: 'Покрив місцевості',
      rainTitle: 'Сума опадів і волога',
      tempTitle: 'Нічна температура',
      rainGood: 'Оптимальна вологість лісової підстилки, імпульс росту активний',
      rainDry: 'Значний дефіцит вологи — підстилка пересушена',
      rainMod: 'Помірні опади',
      tempGood: 'Теплі ночі без приморозків стимулюють розвиток плодових тіл',
      tempCold: 'Нічний холод уповільнює ріст грибниці',
      tempHot: 'Спека може висушувати молоді гриби',
      daysAgoRain: 'дн. після дощу',
      avg7d: 'сер. 7-денна',
      ageYears: 'р.',
    },
    sk: {
      standTitle: 'Porast a vek',
      siteTitle: 'Typ lesného stanovišťa',
      coverTitle: 'Pokrytie terénu',
      rainTitle: 'Úhrn zrážok a vlaha',
      tempTitle: 'Nočná teplota',
      rainGood: 'Optimálna vlhkosť lesnej hrabanky, rastový impulz aktívny',
      rainDry: 'Výrazný deficit vody — pôda je presušená',
      rainMod: 'Mierne zrážky',
      tempGood: 'Teplé noci bez mrazu stimulujú rast plodníc',
      tempCold: 'Chladné noci spomaľujú rast mycélia',
      tempHot: 'Horúčavy môžu vysušovať mladé plodnice',
      daysAgoRain: 'dní po daždi',
      avg7d: '7-dňový priemer',
      ageYears: 'r.',
    },
    cs: {
      standTitle: 'Porost a věk',
      siteTitle: 'Typ lesního stanoviště',
      coverTitle: 'Pokrytí terénu',
      rainTitle: 'Úhrn srážek a vláha',
      tempTitle: 'Noční teplota',
      rainGood: 'Optimální vlhkost lesní hrabanky, růstový impuls aktivní',
      rainDry: 'Značný deficit vody — podloží je přeschlé',
      rainMod: 'Mírné dešťové srážky',
      tempGood: 'Teplé noci bez mrazu stimulují růst plodnic',
      tempCold: 'Chladné noci zpomalují růst podhoubí',
      tempHot: 'Horka mohou vysušovat mladé plodnice',
      daysAgoRain: 'dní od deště',
      avg7d: '7denní průměr',
      ageYears: 'let',
    },
    lt: {
      standTitle: 'Medynas ir amžius',
      siteTitle: 'Miško buveinės tipas',
      coverTitle: 'Žemės danga',
      rainTitle: 'Kritulių kiekis ir drėgmė',
      tempTitle: 'Nakties temperatūra',
      rainGood: 'Optimali miško paklotės drėgmė, augimo impulsas aktyvus',
      rainDry: 'Didelis vandens trūkumas — paklotė išdžiūvusi',
      rainMod: 'Vidutiniai krituliai',
      tempGood: 'Šiltos naktys be šalnų skatina vaisiakūnių augimą',
      tempCold: 'Šaltos naktys lėtina grybienos vystymąsi',
      tempHot: 'Kaitra gali išdžiovinti jaunus vaisiakūnius',
      daysAgoRain: 'd. po lietaus',
      avg7d: '7 d. vidurkis',
      ageYears: 'm.',
    }
  };

  const l = labels[lang] || labels.pl;

  if (stand) {
    factors.push({
      type: stand.age <= 4 ? 'bad' : 'good',
      icon: stand.age <= 4 ? '⚠️' : '🌲',
      title: l.standTitle,
      val: `${stand.specDesc.split('—')[0].trim()}, ${stand.age} ${l.ageYears}`,
      desc: stand.ageDesc,
      impact: stand.ageImpact,
    });

    factors.push({
      type: stand.siteScore < 0.5 ? 'bad' : 'good',
      icon: '🏷️',
      title: l.siteTitle,
      val: decodeHabitat(stand.site, lang) || stand.site || '—',
      desc: stand.siteDesc,
      impact: stand.siteImpact,
    });
  } else if (forestData && forestData.isForest === false) {
    const isUrban = forestData.terrainType === 'urban';
    const isWater = forestData.terrainType === 'water';
    factors.push({
      type: 'bad',
      icon: isUrban ? '🏙️' : (isWater ? '🌊' : '🌾'),
      title: l.coverTitle,
      val: forestData.forestName || (isUrban ? t('terrainUrban') : t('terrainMeadow')),
      desc: isUrban ? t('terrainUrbanDesc') : (isWater ? t('terrainWaterDesc') : t('terrainMeadowDesc')),
      impact: isUrban || isWater ? '-100%' : '-75%',
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
      title: l.rainTitle,
      val: `${Math.round(rain)} mm / 14d (${days} ${l.daysAgoRain})`,
      desc: rainGood ? l.rainGood : (rain < 12 ? l.rainDry : l.rainMod),
      impact: rainGood ? '+25%' : (rain < 12 ? '-30%' : '+10%'),
    });

    // 3. Temperatura
    const temp = wa.avgNightTemp7 ?? wa.avgTemp7 ?? 13;
    const tempGood = temp >= 9 && temp <= 16;
    factors.push({
      type: tempGood ? 'good' : (temp < 4 || temp > 22 ? 'bad' : 'neutral'),
      icon: '🌡️',
      title: l.tempTitle,
      val: `${temp.toFixed(1)}°C (${l.avg7d})`,
      desc: tempGood ? l.tempGood : (temp < 4 ? l.tempCold : l.tempHot),
      impact: tempGood ? '+18%' : (temp < 4 ? '-25%' : '+5%'),
    });
  }

  return factors;
}

// ─────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────

export function generateSummary(overallScore, weatherAnalysis, forestName, forestData = null) {
  const lang = getLang();

  if (forestData && forestData.isForest === false) {
    if (forestData.terrainType === 'urban') {
      return {
        main: t('terrainUrban'),
        tip: t('terrainUrbanDesc')
      };
    }
    if (forestData.terrainType === 'water') {
      return {
        main: t('terrainWater'),
        tip: t('terrainWaterDesc')
      };
    }
    return {
      main: t('terrainMeadow'),
      tip: t('terrainMeadowDesc')
    };
  }

  const wa = weatherAnalysis;
  const name = forestName ? ` (${forestName})` : '';
  const temp = wa?.avgNightTemp7 ?? wa?.avgTemp7 ?? null;
  const rain = wa?.totalRain14 ?? wa?.totalPrecip14 ?? null;

  const msgs = {
    pl: {
      excellent: `Znakomite warunki grzybiarskie${name}! Dojrzały drzewostan, temperatura nocna${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} i opady${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} idealnie sprzyjają owocowaniu.`,
      good: `Dobre warunki${name}. Grzyby są aktywne, a mikoryza funkcjonuje prawidłowo.`,
      moderate: `Umiarkowane warunki${name}. Zwróć uwagę na wiek drzewostanu lub wilgotność podłoża.`,
      bad: `Niekorzystne warunki${name}. Młoda uprawa lub sucha gleba ograniczają owocowanie.`,
      tipPeak: `🌱 Ostatni deszcz ${wa?.daysSinceRain} dni temu — trwa szczyt fali wysypu grzybów.`,
      tipFresh: `💧 Świeży deszcz — daj grzybni 2-3 dni na wykształcenie owocników.`,
      tipDry: `🏜️ Długo bez deszczu. Szukaj w obniżeniach terenu, przy rowach i ciekach wodnych.`,
    },
    en: {
      excellent: `Excellent mushroom foraging conditions${name}! Mature forest, night temp${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} and rain${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} are optimal.`,
      good: `Good conditions${name}. Mushrooms are active and mycorrhizal symbiosis is thriving.`,
      moderate: `Moderate conditions${name}. Check stand age and soil moisture in hollows.`,
      bad: `Unfavorable conditions${name}. Young trees or dry soil limit fruiting.`,
      tipPeak: `🌱 Last rain ${wa?.daysSinceRain} days ago — mushroom flush is currently peaking.`,
      tipFresh: `💧 Fresh rain — allow 2–3 days for mycelium to form fruitbodies.`,
      tipDry: `🏜️ Dry spell. Look in valley bottoms, damp hollows, and stream banks.`,
    },
    de: {
      excellent: `Ausgezeichnete Pilzbedingungen${name}! Reifer Waldbestand, Nachttemperatur${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} und Niederschlag${rain !== null ? ` ${rain.toFixed(0)} mm/14T` : ''} sind optimal.`,
      good: `Gute Bedingungen${name}. Pilze sind aktiv und das Myzel gedeiht gut.`,
      moderate: `Mäßige Bedingungen${name}. Auf Bestandesalter und Bodenfeuchte achten.`,
      bad: `Ungünstige Bedingungen${name}. Junger Wald oder Trockenheit hemmen das Wachstum.`,
      tipPeak: `🌱 Letzter Regen vor ${wa?.daysSinceRain} Tagen — Höhepunkt der Pilzwelle.`,
      tipFresh: `💧 Frischer Regen — dem Myzel 2–3 Tage Zeit zur Fruchtkörperbildung geben.`,
      tipDry: `🏜️ Längere Trockenheit. In Talsenken, an Gräben und Wasserläufen suchen.`,
    },
    uk: {
      excellent: `Чудові грибні умови${name}! Зрілий лісостан, нічна температура${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} та опади${rain !== null ? ` ${rain.toFixed(0)} мм/14д` : ''} оптимальні.`,
      good: `Добрі умови${name}. Гриби активні, мікориза працює стабільно.`,
      moderate: `Помірні умови${name}. Зверніть увагу на вік лісу та вологість ґрунту.`,
      bad: `Несприятливі умови${name}. Молодник або сухий ґрунт стримують плодоношення.`,
      tipPeak: `🌱 Останній дощ ${wa?.daysSinceRain} дн. тому — пік грибної хвилі.`,
      tipFresh: `💧 Свіжий дощ — зачекайте 2-3 дні для росту плодових тіл.`,
      tipDry: `🏜️ Тривала посуха. Шукайте в низинах, біля струмків та канав.`,
    },
    sk: {
      excellent: `Vynikajúce hubárske podmienky${name}! Dospelý porast, nočná teplota${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} a zrážky${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} sú ideálne.`,
      good: `Dobré podmienky${name}. Huby sú aktívne a mykoríza funguje správne.`,
      moderate: `Mierne podmienky${name}. Zamerajte sa na vek porastu a vlhkosť v závrtoch.`,
      bad: `Nevhodné podmienky${name}. Mladina alebo sucho obmedzujú plodenie.`,
      tipPeak: `🌱 Posledný dážď pred ${wa?.daysSinceRain} dňami — prebieha vrchol hubovej vlny.`,
      tipFresh: `💧 Čerstvý dážď — doprajte podhubiu 2–3 dni na vytvorenie plodníc.`,
      tipDry: `🏜️ Dlhšie sucho. Hľadajte v terénnych zníženinách a pri potokoch.`,
    },
    cs: {
      excellent: `Vynikající houbařské podmínky${name}! Vzrostlý les, noční teplota${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} a srážky${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} jsou ideální.`,
      good: `Dobré podmínky${name}. Houby jsou aktivní a podhoubí se daří.`,
      moderate: `Mírné podmínky${name}. Pozor na věk porostu a vlhkost půdy.`,
      bad: `Nepříznivé podmínky${name}. Mládí lesa nebo sucho omezují růst.`,
      tipPeak: `🌱 Poslední déšť před ${wa?.daysSinceRain} dny — vrcholí houbařská vlna.`,
      tipFresh: `💧 Čerstvý déšť — nechte podhoubí 2–3 dny na vývoj plodnic.`,
      tipDry: `🏜️ Dlouho bez deště. Hledejte v úžlabinách a podél potoků.`,
    },
    lt: {
      excellent: `Puikios grybavimo sąlygos${name}! Brandus medynas, nakties temperatūra${temp !== null ? ` ${temp.toFixed(1)}°C` : ''} ir lietus${rain !== null ? ` ${rain.toFixed(0)} mm/14d` : ''} yra idealūs.`,
      good: `Geros sąlygos${name}. Grybai aktyvūs, mikorizė veikia sklandžiai.`,
      moderate: `Vidutiniškos sąlygos${name}. Atkreipkite dėmesį į medyno amžių ir drėgmę.`,
      bad: `Nepalankios sąlygos${name}. Jaunuolynas ar sausa dirva riboja dygimą.`,
      tipPeak: `🌱 Paskutinis lietus prieš ${wa?.daysSinceRain} d. — šiuo metu pats dygimo pikis.`,
      tipFresh: `💧 Šviežias lietus — duokite grybienai 2–3 dienas vaisiakūniams išaugti.`,
      tipDry: `🏜️ Sausra. Ieškokite daubose, prie upelių ir griovių.`,
    }
  };

  const m = msgs[lang] || msgs.pl;
  let main = '';
  if (overallScore >= 75) main = m.excellent;
  else if (overallScore >= 50) main = m.good;
  else if (overallScore >= 25) main = m.moderate;
  else main = m.bad;

  let tip = '';
  if (wa?.daysSinceRain !== undefined && wa.daysSinceRain >= 3 && wa.daysSinceRain <= 8) {
    tip = m.tipPeak;
  } else if (wa?.daysSinceRain !== undefined && wa.daysSinceRain < 2) {
    tip = m.tipFresh;
  } else if (wa?.daysSinceRain !== undefined && wa.daysSinceRain > 10) {
    tip = m.tipDry;
  }

  return { main, tip };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS UI
// ─────────────────────────────────────────────────────────────────

export function edibleLabel(edible, lang = getLang()) {
  const map = {
    'jadalne':   { text: t('labelEdible'), cls: 'edible-yes'  },
    'trujące':   { text: t('labelToxic'), cls: 'edible-no'   },
    'niejadalne':{ text: t('labelInedible'), cls: 'edible-warn' },
    'uwaga':     { text: t('labelCaution'), cls: 'edible-warn' },
  };
  return map[edible] || { text: edible, cls: 'edible-info' };
}

export function scoreToColor(score) {
  if (score >= 65) return '#22c55e';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

export function scoreToLabel(score, lang = getLang()) {
  if (score >= 65) return t('scoreHigh');
  if (score >= 40) return t('scoreModerate');
  if (score >= 20) return t('scoreLow');
  return t('scoreVeryLow');
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
