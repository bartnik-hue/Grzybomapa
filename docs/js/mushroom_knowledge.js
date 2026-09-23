/**
 * mushroom_knowledge.js v2.0
 * ===========================
 * Kompletna baza mikologiczna — 60+ gatunków
 * Każdy gatunek zawiera pełne dane ekologiczne:
 *  - wymagania temperaturowe, wilgotnościowe, opadowe
 *  - drzewa gospodarcze i siedliska
 *  - okno wzrostu po deszczu
 *  - sezonowość (miesiące, szczyt)
 *
 * Źródła: Grzywacz (2011), Łuszczyński (2007), Skirgiełło et al.,
 *         Atlas Grzybów Polski, bazy GBIF/iNaturalist PL
 */

// ─────────────────────────────────────────────────────────────────
// SŁOWNIK GATUNKÓW DRZEW
// ─────────────────────────────────────────────────────────────────
export const TREE_SPECIES = {
  So:  { name: 'Sosna',        latin: 'Pinus sylvestris',      type: 'needleleaved' },
  Sw:  { name: 'Świerk',       latin: 'Picea abies',           type: 'needleleaved' },
  Jd:  { name: 'Jodła',        latin: 'Abies alba',            type: 'needleleaved' },
  Md:  { name: 'Modrzew',      latin: 'Larix decidua',         type: 'needleleaved' },
  Db:  { name: 'Dąb',          latin: 'Quercus robur',         type: 'broadleaved'  },
  Dbcz:{ name: 'Dąb czerwony', latin: 'Quercus rubra',         type: 'broadleaved'  },
  Bk:  { name: 'Buk',          latin: 'Fagus sylvatica',       type: 'broadleaved'  },
  Gb:  { name: 'Grab',         latin: 'Carpinus betulus',      type: 'broadleaved'  },
  Brz: { name: 'Brzoza',       latin: 'Betula pendula',        type: 'broadleaved'  },
  Lp:  { name: 'Lipa',         latin: 'Tilia cordata',         type: 'broadleaved'  },
  Js:  { name: 'Jesion',       latin: 'Fraxinus excelsior',    type: 'broadleaved'  },
  Kl:  { name: 'Klon',         latin: 'Acer platanoides',      type: 'broadleaved'  },
  Ol:  { name: 'Olsza',        latin: 'Alnus glutinosa',       type: 'broadleaved'  },
  Os:  { name: 'Osika',        latin: 'Populus tremula',       type: 'broadleaved'  },
  Tp:  { name: 'Topola',       latin: 'Populus spp.',          type: 'broadleaved'  },
  Wz:  { name: 'Wiąz',         latin: 'Ulmus glabra',          type: 'broadleaved'  },
  Lsz: { name: 'Leszczyna',    latin: 'Corylus avellana',      type: 'broadleaved'  },
};

// ─────────────────────────────────────────────────────────────────
// BAZA GRZYBÓW
// Pola ekologiczne:
//  tempMin/Max  — przedział temperatur nocnych sprzyjający wzrostowi [°C]
//  tempDayMax   — maksymalna temperatura dzienna do wzrostu [°C]
//  rain14min    — minimalna suma opadów 14-dniowa [mm]
//  impulseMin   — minimalny opad 2-5 dni temu (impuls wzrostu) [mm]
//  daysAfter    — [min, max] dni po deszczu, kiedy grzyb wyrasta
//  soilMin/Opt  — wilgotność gleby (0-1 vol/vol)
//  humidityMin  — minimalna wilgotność powietrza [%]
//  trees        — drzewa mikoryzowe/saprotroficzne (puste = wszędzie)
//  treeStrict   — true: TYLKO wymienione drzewa; false: preferuje, ale nie ściśle
//  habitats     — kody siedlisk LP (puste = wszystkie)
//  months       — aktywne miesiące
//  peakMonths   — szczyt owocowania
//  prevalence   — naturalny wskaźnik pospolitości (0-1)
// ─────────────────────────────────────────────────────────────────
export const MUSHROOM_DATABASE = [

  // ══════════════════════════════════════════════
  // BOROWIKI I PODGRZYBKI (Boletaceae)
  // ══════════════════════════════════════════════
  {
    id: 'boletus_edulis',
    name: 'Borowik szlachetny',
    latin: 'Boletus edulis',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Król polskich lasów. Brązowy aksamitny kapelusz, biały trzon z delikatną siateczką. Rośnie pod sosnami, świerkami, dębami i bukami w dojrzałych drzewostanach (>40 lat).',
    trees: ['So', 'Sw', 'Db', 'Bk', 'Gb', 'Md', 'Jd'], treeStrict: false,
    agePref: 'old',
    habitats: ['BŚW','BMŚ','LMŚ','LŚW','BW','BMW'],
    months: [6,7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 8, tempMax: 22, tempDayMax: 26,
      rain14min: 20, impulseMin: 8, daysAfter: [3,9],
      soilMin: 0.20, soilOpt: 0.32, humidityMin: 65 },
    prevalence: 0.78,
  },
  {
    id: 'imleria_badia',
    name: 'Podgrzybek brunatny',
    latin: 'Imleria badia',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Czekoladowobrązowy kapelusz, rurki błękitnieją po uszkodzeniu. Bardziej odporny na suszę niż borowik. Jeden z najobficiej owocujących gatunków lasów iglastych.',
    trees: ['So', 'Sw', 'Md', 'Jd'], treeStrict: false,
    agePref: 'mature',
    habitats: ['BŚW','Bw','BMŚ','BMW'],
    months: [7,8,9,10,11], peakMonths: [8,9,10],
    ecology: { tempMin: 5, tempMax: 24, tempDayMax: 28,
      rain14min: 12, impulseMin: 5, daysAfter: [2,8],
      soilMin: 0.15, soilOpt: 0.28, humidityMin: 58 },
    prevalence: 0.88,
  },
  {
    id: 'boletus_reticulatus',
    name: 'Borowik siatkowaty',
    latin: 'Boletus reticulatus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Letni borowik lasów liściastych — pojawia się jako jeden z pierwszych. Jaśniejszy kapelusz niż borowik szlachetny, wyraźna siateczka na całym trzonie. Lubi ciepłe lata.',
    trees: ['Db', 'Bk', 'Gb', 'Lp'], treeStrict: false,
    agePref: 'mature',
    habitats: ['LŚW','LMŚ','LW'],
    months: [5,6,7,8,9], peakMonths: [6,7],
    ecology: { tempMin: 12, tempMax: 26, tempDayMax: 30,
      rain14min: 18, impulseMin: 10, daysAfter: [3,7],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 62 },
    prevalence: 0.60,
  },
  {
    id: 'boletus_pinophilus',
    name: 'Borowik sosnowy',
    latin: 'Boletus pinophilus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Wczesnoletni borowik typowy dla borów sosnowych. Ciemnobrązowy kapelusz z czerwonawym odcieniem, trzon z delikatną siateczką u góry. Jeden z pierwszych borowików sezonu.',
    trees: ['So'], treeStrict: true,
    agePref: 'old',
    habitats: ['BŚW','Bw','BB','BMŚ','BS','BR'],
    months: [5,6,7,8,9,10], peakMonths: [6,7,8],
    ecology: { tempMin: 6, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 8, daysAfter: [3,8],
      soilMin: 0.18, soilOpt: 0.28, humidityMin: 60 },
    prevalence: 0.65,
  },
  {
    id: 'rubroboletus_satanas',
    name: 'Borowik szatański',
    latin: 'Rubroboletus satanas',
    edible: 'trujące', danger: true, icon: '☠️', relation: 'mikoryzowy',
    description: 'TRUJĄCY — powoduje silne zatrucia. Biały kapelusz, czerwono-pomarańczowy trzon, silnie niebieskieje. Rośnie wyłącznie pod dębami i bukami na ciepłych, wapiennych stanowiskach. Rzadki.',
    trees: ['Db', 'Bk', 'Lp'], treeStrict: true,
    agePref: 'mature',
    habitats: ['LŚW','LMŚ'],
    months: [6,7,8,9], peakMonths: [7,8],
    ecology: { tempMin: 14, tempMax: 28, tempDayMax: 32,
      rain14min: 15, impulseMin: 8, daysAfter: [3,7],
      soilMin: 0.15, soilOpt: 0.28, humidityMin: 55 },
    prevalence: 0.15,
  },
  {
    id: 'xerocomellus_chrysenteron',
    name: 'Suchogrzybek złotopory (podgrzybek złotawy)',
    latin: 'Xerocomellus chrysenteron',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Bardzo pospolity grzyb o matowym, szarobrązowym kapeluszu, który charakterystycznie pęka w drobne poletka, odsłaniając czerwonawe podbarwienie pod skórką. Rurki żółte do oliwkowożółtych, po uciśnięciu słabo błękitnieją. Trzon żółty u góry, ku dołowi czerwony. Smaczny, najlepszy za młodu.',
    trees: ['Db', 'Bk', 'Gb', 'So', 'Sw', 'Brz'], treeStrict: false,
    agePref: 'mature',
    habitats: ['LŚW','LMŚ','BMŚ','BŚW','LW'],
    months: [6,7,8,9,10,11], peakMonths: [8,9,10],
    ecology: { tempMin: 8, tempMax: 24, tempDayMax: 28,
      rain14min: 14, impulseMin: 6, daysAfter: [3,8],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 60 },
    prevalence: 0.86,
  },
  {
    id: 'xerocomus_subtomentosus',
    name: 'Podgrzybek zajączek (suchogrzybek zielonawy)',
    latin: 'Xerocomus subtomentosus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Aksamitny, oliwkowobrązowy lub żółtobrązowy kapelusz. Pory szerokie, intensywnie złocistożółte, zazwyczaj niebłękitniejące. Rośnie w lasach liściastych i iglastych, często przy ścieżkach leśnych i na skarpach.',
    trees: ['Db', 'Bk', 'So', 'Sw', 'Brz'], treeStrict: false,
    agePref: 'mature',
    habitats: ['BŚW','BMŚ','LMŚ','LŚW','BS'],
    months: [6,7,8,9,10,11], peakMonths: [8,9,10],
    ecology: { tempMin: 7, tempMax: 24, tempDayMax: 28,
      rain14min: 12, impulseMin: 5, daysAfter: [3,8],
      soilMin: 0.16, soilOpt: 0.28, humidityMin: 58 },
    prevalence: 0.82,
  },

  // ══════════════════════════════════════════════
  // MAŚLAKI (Suillus)
  // ══════════════════════════════════════════════
  {
    id: 'suillus_luteus',
    name: 'Maślak zwyczajny',
    latin: 'Suillus luteus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Śluzowaty, lepki kapelusz kasztanowy, wyraźny fioletowy pierścień. WYŁĄCZNIE pod sosnami, zwłaszcza w młodych borach i młodnikach. Dobry do zup po obieraniu skórki.',
    trees: ['So'], treeStrict: true,
    agePref: 'young',
    habitats: ['BŚW','Bw','BMŚ','BMW','BS'],
    months: [7,8,9,10,11], peakMonths: [9,10],
    ecology: { tempMin: 7, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 6, daysAfter: [2,6],
      soilMin: 0.20, soilOpt: 0.32, humidityMin: 68 },
    prevalence: 0.92,
  },
  {
    id: 'suillus_variegatus',
    name: 'Maślak sitarz',
    latin: 'Suillus variegatus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Oliwkowobrązowy kapelusz, bez pierścienia. Porowaty hymenofor zmienia barwę na niebieską. Rośnie pod sosnami i świerkami, bardziej suszy-odporny niż maślak zwyczajny.',
    trees: ['So', 'Sw'], treeStrict: true,
    agePref: 'young',
    habitats: ['BŚW','Bw','BMW','BMŚ','BS','BR'],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 6, tempMax: 22, tempDayMax: 26,
      rain14min: 12, impulseMin: 5, daysAfter: [2,7],
      soilMin: 0.15, soilOpt: 0.28, humidityMin: 60 },
    prevalence: 0.82,
  },
  {
    id: 'suillus_grevillei',
    name: 'Maślak modrzewiowy',
    latin: 'Suillus grevillei',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Żółtopomarańczowy, śluzowaty. Rośnie WYŁĄCZNIE pod modrzewiem — jeden z nielicznych grzybów tak ściśle przywiązanych do jednego drzewa. Smaczny po obieraniu skórki.',
    trees: ['Md'], treeStrict: true,
    agePref: 'young',
    habitats: ['BMŚ','LMŚ','LŚW'],
    months: [6,7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 7, tempMax: 22, tempDayMax: 26,
      rain14min: 12, impulseMin: 6, daysAfter: [2,6],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 62 },
    prevalence: 0.90,
  },
  {
    id: 'suillus_granulatus',
    name: 'Maślak ziarnisty',
    latin: 'Suillus granulatus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Jasnobrązowy bez pierścienia, rurki wydzielają mleczne kropelki. Pojawia się wiosną i latem wcześniej niż inne maślaki. Głównie w młodnikach sosnowych.',
    trees: ['So'], treeStrict: true,
    agePref: 'young',
    habitats: ['BŚW','Bw','BS'],
    months: [5,6,7,8,9], peakMonths: [6,7],
    ecology: { tempMin: 8, tempMax: 22, tempDayMax: 26,
      rain14min: 12, impulseMin: 6, daysAfter: [2,5],
      soilMin: 0.18, soilOpt: 0.28, humidityMin: 60 },
    prevalence: 0.78,
  },

  // ══════════════════════════════════════════════
  // KURKI / PIEPRZNIKI (Cantharellus)
  // ══════════════════════════════════════════════
  {
    id: 'cantharellus_cibarius',
    name: 'Kurka (pieprznik jadalny)',
    latin: 'Cantharellus cibarius',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Złotożółta, fałdziesta hymenofor zamiast blaszek. Zapach moreli. Wymaga wykształconej ściółki mszystej w starszych drzewostanach (>35 lat).',
    trees: ['So', 'Sw', 'Db', 'Bk', 'Gb', 'Brz'], treeStrict: false,
    agePref: 'old',
    habitats: ['LŚW','LMŚ','LW','BŚW','BMW'],
    months: [6,7,8,9], peakMonths: [7,8],
    ecology: { tempMin: 10, tempMax: 22, tempDayMax: 26,
      rain14min: 25, impulseMin: 10, daysAfter: [4,10],
      soilMin: 0.25, soilOpt: 0.38, humidityMin: 70 },
    prevalence: 0.82,
  },
  {
    id: 'craterellus_tubaeformis',
    name: 'Pieprznik trąbkowy',
    latin: 'Craterellus tubaeformis',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Mała trąbka, żółtonogi, brązowy kapelusz z dziurką. Masowo wyrasta późną jesienią w wilgotnych świerczynach i buczyna. Odporny na przymrozki.',
    trees: ['Sw', 'Bk', 'Db'], treeStrict: false,
    agePref: 'mature',
    habitats: ['LŚW','LMŚ','LW','BMW'],
    months: [9,10,11], peakMonths: [10,11],
    ecology: { tempMin: 3, tempMax: 15, tempDayMax: 18,
      rain14min: 20, impulseMin: 8, daysAfter: [3,10],
      soilMin: 0.30, soilOpt: 0.42, humidityMin: 72 },
    prevalence: 0.65,
  },

  // ══════════════════════════════════════════════
  // KOŹLARZE (Leccinum)
  // ══════════════════════════════════════════════
  {
    id: 'leccinum_scabrum',
    name: 'Koźlarz babka',
    latin: 'Leccinum scabrum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Specyficzny towarzysz WYŁĄCZNIE brzóz. Brązowy kapelusz, czarne łuski na jasnym trzonie. Pojawia się zawsze tam, gdzie rosną brzozy.',
    trees: ['Brz'], treeStrict: true,
    agePref: 'mature',
    habitats: ['BW','Bw','BMŚ','LMŚ','LW'],
    months: [6,7,8,9,10], peakMonths: [7,8,9],
    ecology: { tempMin: 7, tempMax: 22, tempDayMax: 26,
      rain14min: 15, impulseMin: 7, daysAfter: [3,8],
      soilMin: 0.20, soilOpt: 0.32, humidityMin: 62 },
    prevalence: 0.85,
  },
  {
    id: 'leccinum_aurantiacum',
    name: 'Koźlarz czerwony',
    latin: 'Leccinum aurantiacum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Pomarańczowoczerwony kapelusz — nie do pomylenia. Rośnie WYŁĄCZNIE pod osikami i topolami.',
    trees: ['Os', 'Tp'], treeStrict: true,
    agePref: 'mature',
    habitats: ['LMŚ','LŚW','LW','BMŚ'],
    months: [6,7,8,9,10], peakMonths: [7,8],
    ecology: { tempMin: 8, tempMax: 23, tempDayMax: 27,
      rain14min: 15, impulseMin: 8, daysAfter: [3,7],
      soilMin: 0.20, soilOpt: 0.30, humidityMin: 62 },
    prevalence: 0.80,
  },
  {
    id: 'leccinum_pseudoscabrum',
    name: 'Koźlarz grabowy',
    latin: 'Leccinum pseudoscabrum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Rośnie WYŁĄCZNIE pod grabem i dębem w lasach liściastych. Pofałdowany szarobrązowy kapelusz.',
    trees: ['Gb', 'Db'], treeStrict: true,
    agePref: 'mature',
    habitats: ['LŚW','LMŚ'],
    months: [6,7,8,9,10], peakMonths: [7,8,9],
    ecology: { tempMin: 8, tempMax: 22, tempDayMax: 26,
      rain14min: 15, impulseMin: 7, daysAfter: [3,8],
      soilMin: 0.22, soilOpt: 0.33, humidityMin: 63 },
    prevalence: 0.62,
  },

  // ══════════════════════════════════════════════
  // RYDZE I MLECZAJE (Lactarius)
  // ══════════════════════════════════════════════
  {
    id: 'lactarius_deliciosus',
    name: 'Rydz (mleczaj rydz)',
    latin: 'Lactarius deliciosus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Pomarańczowy, mleczko marchewkowo-pomarańczowe. Rośnie WYŁĄCZNIE pod sosnami, najliczniej w młodnikach sosnowych na piaszczystym podłożu.',
    trees: ['So'], treeStrict: true,
    agePref: 'young',
    habitats: ['BŚW','Bw','BMŚ','BS'],
    months: [8,9,10], peakMonths: [9,10],
    ecology: { tempMin: 5, tempMax: 18, tempDayMax: 22,
      rain14min: 18, impulseMin: 8, daysAfter: [3,8],
      soilMin: 0.22, soilOpt: 0.35, humidityMin: 68 },
    prevalence: 0.72,
  },
  {
    id: 'lactarius_deterrimus',
    name: 'Rydz smaczny (świerkowy)',
    latin: 'Lactarius deterrimus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Odpowiednik rydza dla świerczynach. Mleczko zielenieje po wycieku. Podobny do rydza, smaczny, dobry do kiszenia.',
    trees: ['Sw'], treeStrict: true,
    habitats: ['BMŚ','BMW','LMŚ'],
    months: [8,9,10], peakMonths: [9,10],
    ecology: { tempMin: 5, tempMax: 17, tempDayMax: 21,
      rain14min: 18, impulseMin: 8, daysAfter: [3,8],
      soilMin: 0.24, soilOpt: 0.36, humidityMin: 70 },
    prevalence: 0.68,
  },
  {
    id: 'lactarius_rufus',
    name: 'Mleczaj rudy',
    latin: 'Lactarius rufus',
    edible: 'niejadalne', danger: false, icon: '⚠️', relation: 'mikoryzowy',
    description: 'Ceglastoczerwony, mleczko białe, smak bardzo ostry (palący). Pospolity pod sosnami i świerkami. Niejadalny surowy. Mylony czasem z rydزem — ostry smak odróżnia.',
    trees: ['So', 'Sw'], treeStrict: false,
    habitats: ['BŚW','Bw','BMŚ'],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 6, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 6, daysAfter: [2,8],
      soilMin: 0.20, soilOpt: 0.30, humidityMin: 62 },
    prevalence: 0.75,
  },

  // ══════════════════════════════════════════════
  // GĄSKI (Tricholoma)
  // ══════════════════════════════════════════════
  {
    id: 'tricholoma_equestre',
    name: 'Gąska zielonka',
    latin: 'Tricholoma equestre',
    edible: 'uwaga', danger: false, icon: '⚠️', relation: 'mikoryzowy',
    description: 'Żółtozielony kapelusz, żółte blaszki. Rośnie WYŁĄCZNIE pod sosnami jesienią. Dawniej jadana — spożywana w dużych ilościach może powodować miopatię. Nie zbierać.',
    trees: ['So'], treeStrict: true,
    habitats: ['BŚW','Bw'],
    months: [9,10,11], peakMonths: [10,11],
    ecology: { tempMin: 2, tempMax: 14, tempDayMax: 18,
      rain14min: 15, impulseMin: 6, daysAfter: [3,10],
      soilMin: 0.18, soilOpt: 0.28, humidityMin: 60 },
    prevalence: 0.55,
  },
  {
    id: 'tricholoma_portentosum',
    name: 'Gąska jadalna',
    latin: 'Tricholoma portentosum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Szarofiloletowy kapelusz z ciemnym środkiem, jasny trzon. Smaczna, jedyna bezpieczna jesienna gąska sosnowa. Wymaga doświadczenia przy zbieraniu — wiele podobnych trujących gatunków.',
    trees: ['So'], treeStrict: true,
    habitats: ['BŚW','BMŚ'],
    months: [9,10,11], peakMonths: [10,11],
    ecology: { tempMin: 1, tempMax: 12, tempDayMax: 16,
      rain14min: 12, impulseMin: 5, daysAfter: [3,12],
      soilMin: 0.15, soilOpt: 0.25, humidityMin: 58 },
    prevalence: 0.45,
  },

  // ══════════════════════════════════════════════
  // OPIEŃKI (Armillaria)
  // ══════════════════════════════════════════════
  {
    id: 'armillaria_mellea',
    name: 'Opieńka miodowa',
    latin: 'Armillaria mellea',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'pasożytniczy',
    description: 'Rośnie gęstymi kępami na drewnie i u nasady drzew we WSZYSTKICH typach lasów. Miodowożółty kapelusz, biały pierścień. Wymaga obgotowania przed spożyciem. Owocuje falami po deszczach.',
    trees: [], treeStrict: false,
    habitats: [],
    months: [8,9,10,11], peakMonths: [9,10],
    ecology: { tempMin: 4, tempMax: 18, tempDayMax: 22,
      rain14min: 18, impulseMin: 8, daysAfter: [2,7],
      soilMin: 0.22, soilOpt: 0.35, humidityMin: 68 },
    prevalence: 0.90,
  },
  {
    id: 'armillaria_ostoyae',
    name: 'Opieńka ciemna',
    latin: 'Armillaria ostoyae',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'pasożytniczy',
    description: 'Ciemniejsza od miodowej, łuski na kapeluszu. Dominuje w lasach iglastych. Identyczna pod względem smaku i wymagań ekologicznych.',
    trees: ['So', 'Sw', 'Jd', 'Md'], treeStrict: false,
    habitats: ['BŚW','Bw','BMŚ','BMW'],
    months: [8,9,10,11], peakMonths: [9,10],
    ecology: { tempMin: 3, tempMax: 17, tempDayMax: 21,
      rain14min: 18, impulseMin: 8, daysAfter: [2,7],
      soilMin: 0.22, soilOpt: 0.35, humidityMin: 68 },
    prevalence: 0.85,
  },

  // ══════════════════════════════════════════════
  // BOCZNIAKI (Pleurotus)
  // ══════════════════════════════════════════════
  {
    id: 'pleurotus_ostreatus',
    name: 'Boczniak ostrygowaty',
    latin: 'Pleurotus ostreatus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Szarobiały wachlarz na martwym drewnie liściastym. Nie jest sezonowy — rośnie od jesieni do wiosny, nawet w temperaturach bliskich zeru. Wyśmienity.',
    trees: ['Bk', 'Db', 'Gb', 'Os', 'Js', 'Ol'], treeStrict: false,
    habitats: ['LŚW','LMŚ','LW','LL'],
    months: [9,10,11,3,4], peakMonths: [10,11],
    ecology: { tempMin: -2, tempMax: 14, tempDayMax: 18,
      rain14min: 15, impulseMin: 5, daysAfter: [2,14],
      soilMin: 0.20, soilOpt: 0.35, humidityMin: 70 },
    prevalence: 0.68,
  },

  // ══════════════════════════════════════════════
  // SMARDZE (Morchella) — wiosenne
  // ══════════════════════════════════════════════
  {
    id: 'morchella_esculenta',
    name: 'Smardz jadalny',
    latin: 'Morchella esculenta',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Niepowtarzalny wygląd — siatkowata głowa. Wyłącznie wiosenny. Rośnie na obrzeżach lasów, w sadach, przy modrzewiach. ZAWSZE wymaga obgotowania przed spożyciem.',
    trees: ['Md', 'Jd', 'Js'], treeStrict: false,
    habitats: [],
    months: [3,4,5], peakMonths: [4],
    ecology: { tempMin: 7, tempMax: 18, tempDayMax: 22,
      rain14min: 12, impulseMin: 5, daysAfter: [3,8],
      soilMin: 0.22, soilOpt: 0.32, humidityMin: 60 },
    prevalence: 0.32,
  },

  // ══════════════════════════════════════════════
  // CZUBAJKI (Macrolepiota)
  // ══════════════════════════════════════════════
  {
    id: 'macrolepiota_procera',
    name: 'Czubajka kania',
    latin: 'Macrolepiota procera',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Duży, parasolowaty kapelusz do 30cm. Rośnie na obrzeżach lasów, polanach, skrajach dróg — NIE w gęstym lesie. Smażona na maśle wybitna. Uwaga na podobny jadowity czubajeczek.',
    trees: [], treeStrict: false,
    habitats: [],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 8, tempMax: 24, tempDayMax: 28,
      rain14min: 15, impulseMin: 7, daysAfter: [3,8],
      soilMin: 0.15, soilOpt: 0.25, humidityMin: 58 },
    prevalence: 0.60,
    openAreaOnly: true, // tylko na skrajach, nie w gęstym lesie
  },

  // ══════════════════════════════════════════════
  // KOLCZAKI I INNE JADALNE
  // ══════════════════════════════════════════════
  {
    id: 'hydnum_repandum',
    name: 'Kolczak obłączasty',
    latin: 'Hydnum repandum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Kremowobiały z kolcami zamiast blaszek. Jesienny grzyb lasów liściastych i mieszanych. Bez trujących sobowtórów — jeden z bezpieczniejszych grzybów do zbierania.',
    trees: ['Db', 'Bk', 'Gb', 'Sw', 'So'], treeStrict: false,
    habitats: ['LŚW','LMŚ','LW','BMW'],
    months: [8,9,10,11], peakMonths: [9,10],
    ecology: { tempMin: 4, tempMax: 16, tempDayMax: 20,
      rain14min: 18, impulseMin: 8, daysAfter: [4,10],
      soilMin: 0.25, soilOpt: 0.38, humidityMin: 68 },
    prevalence: 0.55,
  },
  {
    id: 'sparassis_crispa',
    name: 'Szmaciak gałęzisty',
    latin: 'Sparassis crispa',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'pasożytniczy',
    description: 'Wygląda jak duża gąbka/kalafior do 50cm. Rośnie u podstawy sosen (pasożyt korzeni). Chroniony, ale liczba okazów rośnie. Smaczny, wymaga dokładnego czyszczenia.',
    trees: ['So', 'Jd'], treeStrict: true,
    habitats: ['BŚW','Bw','BMŚ'],
    months: [8,9,10], peakMonths: [9],
    ecology: { tempMin: 8, tempMax: 20, tempDayMax: 24,
      rain14min: 20, impulseMin: 10, daysAfter: [5,12],
      soilMin: 0.22, soilOpt: 0.32, humidityMin: 65 },
    prevalence: 0.22,
  },

  // ══════════════════════════════════════════════
  // PURCHAWKI (Lycoperdon, Calvatia)
  // ══════════════════════════════════════════════
  {
    id: 'lycoperdon_perlatum',
    name: 'Purchawka chropowata',
    latin: 'Lycoperdon perlatum',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Biała kulka z kolcami. Jadalna TYLKO gdy w środku biała i jednolita — stara brązowieje. Rośnie we wszystkich lasach na ściółce i martwym drewnie.',
    trees: [], treeStrict: false,
    habitats: [],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 5, tempMax: 22, tempDayMax: 26,
      rain14min: 12, impulseMin: 5, daysAfter: [2,8],
      soilMin: 0.15, soilOpt: 0.28, humidityMin: 58 },
    prevalence: 0.70,
  },
  {
    id: 'calvatia_gigantea',
    name: 'Purchawica olbrzymia',
    latin: 'Calvatia gigantea',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Ogromna biała kula do 50cm! Rośnie na łąkach, polanach i skrajach lasów. Jadalna tylko w całości biała w środku. Rzadka, niezapomniana.',
    trees: [], treeStrict: false,
    habitats: [],
    months: [8,9,10], peakMonths: [9],
    ecology: { tempMin: 8, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 7, daysAfter: [4,10],
      soilMin: 0.20, soilOpt: 0.32, humidityMin: 65 },
    prevalence: 0.25,
    openAreaOnly: true,
  },

  // ══════════════════════════════════════════════
  // MUCHOMORY — ostrzeżenia (Amanita)
  // ══════════════════════════════════════════════
  {
    id: 'amanita_phalloides',
    name: 'Muchomor sromotnikowy',
    latin: 'Amanita phalloides',
    edible: 'trujące', danger: true, icon: '☠️', relation: 'mikoryzowy',
    description: 'ŚMIERTELNIE TRUJĄCY — odpowiada za 90% śmiertelnych zatruć grzybami w Europie. Zielonkawy kapelusz, biały trzon z pochwą u nasady, białe blaszki. Brak antidotum — zatrucie prowadzi do niewydolności wątroby.',
    trees: ['Db', 'Bk', 'So', 'Sw', 'Gb'], treeStrict: false,
    habitats: [],
    months: [6,7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 8, tempMax: 24, tempDayMax: 28,
      rain14min: 15, impulseMin: 6, daysAfter: [3,8],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 60 },
    prevalence: 0.35,
  },
  {
    id: 'amanita_virosa',
    name: 'Muchomor jadowity (biały)',
    latin: 'Amanita virosa',
    edible: 'trujące', danger: true, icon: '☠️', relation: 'mikoryzowy',
    description: 'ŚMIERTELNIE TRUJĄCY. Cały biały — kapelusz, trzon, blaszki. Rośnie pod świerkami i jodłami w górach i na niżu. Mylony z czubajką kanią — ta ma zawsze brązowy środek kapelusza.',
    trees: ['Sw', 'Jd', 'So'], treeStrict: false,
    habitats: ['BMŚ','BMW','BŚW'],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 5, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 6, daysAfter: [3,8],
      soilMin: 0.20, soilOpt: 0.32, humidityMin: 65 },
    prevalence: 0.22,
  },
  {
    id: 'amanita_muscaria',
    name: 'Muchomor czerwony',
    latin: 'Amanita muscaria',
    edible: 'trujące', danger: true, icon: '🔴', relation: 'mikoryzowy',
    description: 'Silnie trujący (nie śmiertelny, ale powoduje poważne objawy). Charakterystyczny czerwony kapelusz z białymi plamkami. Jeden z symboli lasu. Rośnie pod sosnami, świerkami i brzozami.',
    trees: ['So', 'Sw', 'Brz', 'Jd'], treeStrict: false,
    habitats: [],
    months: [7,8,9,10,11], peakMonths: [8,9],
    ecology: { tempMin: 5, tempMax: 20, tempDayMax: 24,
      rain14min: 12, impulseMin: 5, daysAfter: [2,8],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 60 },
    prevalence: 0.55,
  },
  {
    id: 'amanita_pantherina',
    name: 'Muchomor plamisty',
    latin: 'Amanita pantherina',
    edible: 'trujące', danger: true, icon: '☠️', relation: 'mikoryzowy',
    description: 'SILNIE TRUJĄCY — groźniejszy niż muchomor czerwony, często śmiertelny. Brązowy kapelusz z białymi plamkami. Rośnie pod sosnami, dębami i bukami. Mylony z grzybami jadalnymi.',
    trees: ['So', 'Db', 'Bk'], treeStrict: false,
    habitats: [],
    months: [6,7,8,9,10], peakMonths: [7,8],
    ecology: { tempMin: 8, tempMax: 22, tempDayMax: 26,
      rain14min: 12, impulseMin: 6, daysAfter: [3,8],
      soilMin: 0.18, soilOpt: 0.28, humidityMin: 60 },
    prevalence: 0.38,
  },

  // ══════════════════════════════════════════════
  // ZASŁONAKI — groźne, późnosezonowe
  // ══════════════════════════════════════════════
  {
    id: 'cortinarius_orellanus',
    name: 'Zasłonak rudy',
    latin: 'Cortinarius orellanus',
    edible: 'trujące', danger: true, icon: '☠️', relation: 'mikoryzowy',
    description: 'ŚMIERTELNIE TRUJĄCY — orellina uszkadza nerki z opóźnieniem 2-3 tygodni. Brązowoczerwony kapelusz, rdzawe blaszki. Rośnie pod dębami i buczynami. Grzyb perfidnie opóźniający objawy.',
    trees: ['Db', 'Bk', 'Gb'], treeStrict: false,
    habitats: ['LŚW','LMŚ'],
    months: [8,9,10], peakMonths: [9,10],
    ecology: { tempMin: 6, tempMax: 18, tempDayMax: 22,
      rain14min: 15, impulseMin: 7, daysAfter: [4,10],
      soilMin: 0.20, soilOpt: 0.30, humidityMin: 62 },
    prevalence: 0.20,
  },

  // ══════════════════════════════════════════════
  // GOŁĄBKI (Russula) — duże zróżnicowanie
  // ══════════════════════════════════════════════
  {
    id: 'russula_cyanoxantha',
    name: 'Gołąbek sinozielony',
    latin: 'Russula cyanoxantha',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'mikoryzowy',
    description: 'Zielono-fioletowy kapelusz, białe blaszki elastyczne (nie kruszeją!). Jeden z nielicznych jadalnych gołąbków. Rośnie pod bukami i dębami. Smaczny, często zbierany.',
    trees: ['Bk', 'Db', 'Gb'], treeStrict: false,
    habitats: ['LŚW','LMŚ'],
    months: [6,7,8,9,10], peakMonths: [7,8],
    ecology: { tempMin: 8, tempMax: 22, tempDayMax: 26,
      rain14min: 15, impulseMin: 7, daysAfter: [3,8],
      soilMin: 0.22, soilOpt: 0.33, humidityMin: 63 },
    prevalence: 0.58,
  },
  {
    id: 'russula_emetica',
    name: 'Gołąbek wymiotny',
    latin: 'Russula emetica',
    edible: 'niejadalne', danger: false, icon: '⚠️', relation: 'mikoryzowy',
    description: 'Jaskrawoczerwony kapelusz, smak palący. Powoduje wymioty. Bardzo podobny do jadalnych gołąbków czerwonych — odróżnia palący smak i środowisko (sosny/świerki, nie liściaste).',
    trees: ['So', 'Sw'], treeStrict: false,
    habitats: ['BŚW','Bw','BMW'],
    months: [7,8,9,10], peakMonths: [8,9],
    ecology: { tempMin: 6, tempMax: 20, tempDayMax: 24,
      rain14min: 15, impulseMin: 6, daysAfter: [3,8],
      soilMin: 0.22, soilOpt: 0.35, humidityMin: 65 },
    prevalence: 0.65,
  },

  // ══════════════════════════════════════════════
  // PNIARKA I SPECJALNE
  // ══════════════════════════════════════════════
  {
    id: 'flammulina_velutipes',
    name: 'Płomiennica zimowa (enoki)',
    latin: 'Flammulina velutipes',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Rośnie zimą i wczesną wiosną na martwym drewnie liściastym. Żółtobrązowy kapelusz, ciemnobrązowe włókna na trzonie. Jedyny grzyb zbierany w grudniu-lutym.',
    trees: ['Db', 'Wz', 'Os', 'Tp'], treeStrict: false,
    habitats: [],
    months: [10,11,12,1,2,3], peakMonths: [12,1],
    ecology: { tempMin: -5, tempMax: 10, tempDayMax: 14,
      rain14min: 10, impulseMin: 4, daysAfter: [2,14],
      soilMin: 0.18, soilOpt: 0.30, humidityMin: 70 },
    prevalence: 0.55,
  },
  {
    id: 'hericium_erinaceus',
    name: 'Soplówka jeżowata',
    latin: 'Hericium erinaceus',
    edible: 'jadalne', danger: false, icon: '🍄', relation: 'saprotroficzny',
    description: 'Wygląda jak biały jeż — rośnie na żywych starych bukach. PRAWNIE CHRONIONA w Polsce. Nie zbierać! Pamiętaj aby ją sfotografować i zgłosić.',
    trees: ['Bk', 'Db'], treeStrict: true,
    habitats: ['LŚW','LMŚ'],
    months: [8,9,10], peakMonths: [9],
    ecology: { tempMin: 8, tempMax: 20, tempDayMax: 24,
      rain14min: 20, impulseMin: 8, daysAfter: [5,14],
      soilMin: 0.25, soilOpt: 0.38, humidityMin: 70 },
    prevalence: 0.12,
  },
];

// ─────────────────────────────────────────────────────────────────
// API PUBLICZNE
// ─────────────────────────────────────────────────────────────────

/**
 * Wnioskuj prawdopodobny skład drzewostanu na podstawie typu siedliskowego lasu (gdy brak kodu w OGC)
 */
export function inferSpeciesFromHabitat(habitatCode) {
  if (!habitatCode) {
    return [{ code: 'So', pct: 60 }, { code: 'Db', pct: 25 }, { code: 'Brz', pct: 15 }];
  }
  const code = habitatCode.toUpperCase().replace(/\s/g, '');
  if (code.includes('BS') || code.includes('BR')) {
    return [{ code: 'So', pct: 90 }, { code: 'Brz', pct: 10 }];
  }
  if (code.includes('BŚW') || code.includes('BSW')) {
    return [{ code: 'So', pct: 85 }, { code: 'Brz', pct: 15 }];
  }
  if (code.includes('BMŚ') || code.includes('BMSW')) {
    return [{ code: 'So', pct: 60 }, { code: 'Db', pct: 25 }, { code: 'Brz', pct: 15 }];
  }
  if (code.includes('BMW') || code.includes('BW') || code.includes('BB')) {
    return [{ code: 'So', pct: 55 }, { code: 'Sw', pct: 30 }, { code: 'Brz', pct: 15 }];
  }
  if (code.includes('LMŚ') || code.includes('LMSW')) {
    return [{ code: 'Db', pct: 40 }, { code: 'Bk', pct: 30 }, { code: 'So', pct: 20 }, { code: 'Gb', pct: 10 }];
  }
  if (code.includes('LŚW') || code.includes('LSW')) {
    return [{ code: 'Db', pct: 45 }, { code: 'Bk', pct: 35 }, { code: 'Gb', pct: 20 }];
  }
  if (code.includes('OL') || code.includes('LŁ') || code.includes('LL')) {
    return [{ code: 'Ol', pct: 75 }, { code: 'Js', pct: 15 }, { code: 'Brz', pct: 10 }];
  }
  return [{ code: 'So', pct: 60 }, { code: 'Db', pct: 25 }, { code: 'Brz', pct: 15 }];
}

/**
 * Pobierz listę grzybów dla konkretnej kompozycji drzewostanu, siedliska i wieku lasu
 * @param {Array} speciesWithPct — [{code:'So',pct:60},{code:'Db',pct:40}]
 * @param {string} habitatCode — np. "BŚW", "LMŚ"
 * @param {number|string} forestAge — wiek drzewostanu w latach (np. 15, 80)
 * @returns {Array} lista grzybów z wagami ekologicznymi
 */
export function getMushroomsForStand(speciesWithPct = [], habitatCode = null, forestAge = null) {
  let specs = speciesWithPct;
  if (!specs || specs.length === 0) {
    specs = inferSpeciesFromHabitat(habitatCode);
  }

  const totalPct = specs.reduce((s, x) => s + (x.pct || 0), 0) || 100;
  const age = forestAge ? parseInt(forestAge, 10) : null;
  const hCode = (habitatCode || '').toUpperCase().replace(/\s/g, '');

  return MUSHROOM_DATABASE
    .map(m => {
      // 1. Dopasowanie mikoryzowe drzewostanu (0..1.2)
      let treeMatch = 0;
      let matchedTreeName = '';

      if (!m.trees || m.trees.length === 0) {
        // Saprotrofy i generaliści
        treeMatch = 0.85;
      } else if (m.treeStrict) {
        // ŚCIŚLE powiązany — musi mieć swojego partnera w drzewostanie!
        const hit = specs.find(s => {
          const norm = (s.code || s).charAt(0).toUpperCase() + (s.code || s).slice(1).toLowerCase();
          return m.trees.includes(norm);
        });

        if (hit) {
          const norm = (hit.code || hit).charAt(0).toUpperCase() + (hit.code || hit).slice(1).toLowerCase();
          const treeInfo = TREE_SPECIES[norm];
          matchedTreeName = treeInfo?.name || norm;
          const share = (hit.pct || 25) / totalPct;
          // Jeśli udział drzewa jest znaczący (>20%), grzyb dostaje niemal pełne dopasowanie
          treeMatch = Math.min(0.4 + share * 0.9, 1.25);
        } else {
          // Brak drzewa żywicielskiego = grzyb ściśle mikoryzowy nie wystąpi!
          treeMatch = 0;
        }
      } else {
        // Preferencja niespecyficzna — suma udziałów ulubionych drzew
        let hitTreeNames = [];
        const matchPct = specs
          .filter(s => {
            const norm = (s.code || s).charAt(0).toUpperCase() + (s.code || s).slice(1).toLowerCase();
            const hit = m.trees.includes(norm);
            if (hit) {
              const tInfo = TREE_SPECIES[norm];
              hitTreeNames.push(tInfo?.name || norm);
            }
            return hit;
          })
          .reduce((sum, s) => sum + (s.pct || 15), 0);

        if (matchPct > 0) {
          matchedTreeName = hitTreeNames.slice(0, 2).join(', ');
          treeMatch = Math.min(0.35 + (matchPct / totalPct) * 0.75, 1.1);
        } else {
          treeMatch = 0.12; // toleruje brak, ale bardzo rzadki
        }
      }

      // Jeśli grzyb ściśle zależy od drzewa i go nie ma — natychmiast odpada
      if (m.treeStrict && treeMatch === 0) {
        return null;
      }

      // 2. Dopasowanie wieku drzewostanu (ageFactor: 0.15 .. 1.4)
      let ageFactor = 1.0;
      let ageNote = '';

      if (age !== null && age > 0) {
        const pref = m.agePref || 'any';
        if (pref === 'young') {
          // Grzyby młodnikowe (maślaki, rydze)
          if (age <= 25) {
            ageFactor = 1.40;
            ageNote = `🌱 Młodnik (${age} l.) — szczyt owocowania`;
          } else if (age <= 45) {
            ageFactor = 0.90;
          } else {
            ageFactor = 0.40;
            ageNote = `Drzewostan dojrzały — maślaki rzadsze`;
          }
        } else if (pref === 'old') {
          // Grzyby starodrzewu (borowik szlachetny, kurka, soplówka, szmaciak)
          if (age <= 15) {
            ageFactor = 0.15;
            ageNote = `⚠️ Za młody las (${age} l.) — brak mikoryzy starodrzewu`;
          } else if (age <= 35) {
            ageFactor = 0.60;
          } else if (age <= 120) {
            ageFactor = 1.35;
            ageNote = `🌲 Starodrzew (${age} l.) — optymalne siedlisko`;
          } else {
            ageFactor = 1.15;
          }
        } else if (pref === 'mature') {
          // Podgrzybki, krasnoborowiki, koźlarze
          if (age <= 15) ageFactor = 0.55;
          else if (age <= 80) ageFactor = 1.25;
          else ageFactor = 1.05;
        }
      }

      // 3. Dopasowanie siedliska (habitatBonus)
      let habitatBonus = 0;
      let habitatNote = '';

      if (hCode && m.habitats?.length) {
        const matches = m.habitats.some(h => hCode.includes(h.replace(/\s/g,'')) || h.replace(/\s/g,'').includes(hCode));
        if (matches) {
          habitatBonus = 0.25;
          habitatNote = `🏷️ Siedlisko ${habitatCode} — optymalne`;
        }
      }

      // Specyficzne wykluczenia/bonusy siedliskowe
      if (hCode.includes('BS') || hCode.includes('BR')) {
        // Bory suche
        if (m.id === 'tricholoma_equestre' || m.id === 'boletus_pinophilus' || m.id === 'suillus_variegatus') {
          habitatBonus += 0.35;
        } else if (m.id === 'cantharellus_cibarius' || m.id === 'leccinum_scabrum') {
          habitatBonus -= 0.30;
        }
      } else if (hCode.includes('OL') || hCode.includes('LL')) {
        // Olsy / łęgi
        if (m.id === 'pleurotus_ostreatus' || m.id === 'flammulina_velutipes' || m.id === 'paxillus_involutus') {
          habitatBonus += 0.40;
        } else if (m.trees && m.trees.includes('So')) {
          habitatBonus -= 0.45;
        }
      }

      return {
        ...m,
        _treeMatch: Math.max(0, treeMatch),
        _ageFactor: ageFactor,
        _habitatBonus: habitatBonus,
        _matchedTreeName: matchedTreeName,
        _ageNote: ageNote,
        _habitatNote: habitatNote,
      };
    })
    .filter(Boolean)
    .filter(m => (m._treeMatch + m._habitatBonus) > 0.05);
}

/**
 * Wersja uproszczona — lista kodów gatunków (kompatybilność wsteczna)
 */
export function getMushroomsForMixedForest(speciesCodes = [], habitatCode = null, forestAge = null) {
  const speciesWithPct = speciesCodes.map(c => ({ code: c, pct: Math.round(100 / Math.max(speciesCodes.length, 1)) }));
  return getMushroomsForStand(speciesWithPct, habitatCode, forestAge);
}

/**
 * Filtruj grzyby według aktualnego miesiąca
 */
export function filterBySeason(mushrooms, month = new Date().getMonth() + 1) {
  return mushrooms.filter(m => !m.months || m.months.includes(month));
}
