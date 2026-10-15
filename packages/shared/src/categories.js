const CATEGORIES = [
  'politics',
  'business',
  'technology',
  'sports',
  'health',
  'entertainment',
  'other',
];

// A keyword matches every word that starts with it; "kw$" matches only the
// whole word "kw" (after accent folding).
const KEYWORD_MAP = {
  politics: ['politiqu', 'election', 'president', 'government', 'parliament', 'minister'],
  business: ['business', 'economie', 'econom', 'market', 'bourse', 'finance', 'bank'],
  technology: ['tech', 'ntic', 'digital', 'numeriq', 'startup', 'internet'],
  sports: ['sport', 'football', 'footy$', 'cup$', 'cupa$', 'league', 'match', 'foot mercato$'],
  health: ['sante$', 'health', 'hopital', 'medic', 'covid', 'disease'],
  entertainment: ['culture', 'musique', 'music', 'cinema', 'entertainment', 'celebrit'],
};

// Keywords that only count for French-language publishers. "Foot" is French
// for football, but in English headlines it was mostly "25-foot fall",
// "foot-and-mouth disease", "shoot itself in the foot" (30-day audit,
// 2026-10-14: 125 English foot-only sports headlines, ~3/4 not sport; 109
// French, all but "baby-foot" real football). The French site "Foot Mercato"
// is quoted in other languages too, so that phrase is a sports keyword
// everywhere. "Mercato" (transfer window) is French-only: in Italian it is
// "market" ("mercato abitativo"); whole word, so "mercatique" doesn't match.
const FRENCH_KEYWORD_MAP = {
  sports: ['foot$', 'mercato$'],
};

// Words that start with a keyword but are not about its category, from a
// 30-day audit of 978,879 headlines (2026-10-13). Whole-word "foot"/"cup"/
// "sante" above already drop footage, footwear, footprint, cúpula, cupón,
// cupboard, Cupra, Santeri...; these are excluded as word prefixes.
const NOT_KEYWORDS = [
  'matching', 'matcha', 'matched', 'matchbox', 'matchmak', // job matching, matcha tea
  'techo', // Spanish "roof"
  'techiman', // town in Ghana
  'mercato de la mode', // Le Monde: designers changing fashion houses
  'salud, el amor', // Clarín's daily horoscopes: "las predicciones para la salud, el amor y el dinero"
];

// Fallback when no keyword matches: a topical section folder in the article
// URL (".../deportes/...", ".../politik/..."). Only the folders between the
// host and the article slug count. Measured on 30 days of URLs (2026-10-14,
// ops/investigate-erroring/url-seg-*): agrees with the keyword category 94%
// of the time; generic folders (news, world, national, tv, places) and the
// catch-all sections ekonomi (CNN Indonesia), gazdasag (Portfolio) and salud
// (La Nación) were left out after hand review.
const URL_SECTIONS = {
  sports: [
    'sport', 'sports', 'nogomet', 'deportes', 'futbol', 'football', 'sportske', 'voetbal', 'olahraga', 'esportes',
    'futebol', 'fudbal', 'cricket', 'kosarka', 'tenis', 'futbol-mundial', 'urheilu', 'soccer', 'el-deportivo', 'nhl',
    'wielrennen', 'rugby', 'fussball', 'formule-1', 'nfl', 'futebol-internacional', 'smliiga', 'futboll', 'deporte-total',
  ],
  politics: [
    'politics', 'politica', 'politik', 'politika', 'politique', 'politiikka', 'elecciones', 'eleicoes', 'polityka',
    'politiek', 'us-politics', 'foreign-politics', 'izbori26',
  ],
  business: [
    'business', 'economy', 'economia', 'economie', 'wirtschaft', 'finance', 'money', 'ekonomija', 'biznes', 'biznis',
    'ekonomika', 'economics', 'taloussanomat', 'uzlet', 'empresas',
  ],
  technology: ['technology', 'tech', 'tecnologia'],
  health: ['health', 'zdravlje'],
  entertainment: [
    'culture', 'entertainment', 'kultura', 'kultur', 'cultura', 'showbiz', 'espectaculos', 'gente', 'celebridades',
    'musica', 'muzika', 'pop', 'cinemania', 'fama', 'famosos', 'luces', 'viihde', 'viihdeuutiset', 'culture-loisirs',
    'television', 'zabava', 'hiburan', 'zvijezde', 'art',
  ],
};
const URL_SECTION_CATEGORY = new Map(
  Object.entries(URL_SECTIONS).flatMap(([category, folders]) => folders.map((folder) => [folder, category])));

// The category of the first section folder in the URL path, or null.
// "https://x.com/es/deportes/futbol/some-slug?x=1" -> folders es, deportes, futbol -> sports.
function urlSectionCategory(url) {
  if (typeof url !== 'string') return null;
  const path = url.replace(/[?#].*$/, '').replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').toLowerCase().replace(/\/+$/, '');
  const folders = path.split('/').slice(1, -1);
  for (const folder of folders) {
    const category = URL_SECTION_CATEGORY.get(folder);
    if (category) return category;
  }
  return null;
}

// Last pass, after the language-neutral keywords and the URL section folder: keywords in the publisher's own
// language ("gobierno", "regierung", "pemilu", ...), so a headline only goes here when nothing else matched and
// no existing category changes. Keyed by the language code's base ("pt-BR" -> pt). Measured on 30 days of
// headlines (2026-10-14, ops/investigate-erroring/p3-measure*): ~54k articles a month out of other, ~91% right
// by hand review. Left out on purpose: hospital-type words in every language (mostly accident and crime
// stories), es "partido" (also a match) and "deport" (deportación), es/pt "banco" (robberies, the bench),
// es "mercado", es "vacuna" (carne vacuna = beef), pt "gol" (the airline GOL), pt "govern" (governanta),
// nl "partij" (a darts game), id "partai" (a badminton match), fi "yrity" (also "attempt"), fr "acteur"
// (stakeholder), hr "izborn" (izbornik = the national team coach), en "senators" (Ottawa Senators), en "import"
// (important), it banca/azienda (crime stories); and prefixes that misfired in the all-time review: es "salud"
// (saludables), en "shares" (the verb), en "actor" (state actors), en "governor"/fr "gouvern" (governorate,
// gouvernance), hr "strank" (strankinja = a foreign woman).
const SR = {
  politics: ['vlada$', 'vlade$', 'vladi$', 'vladu$', 'ministar', 'ministr', 'izbori$', 'izbora$', 'izborima$', 'izborni$', 'izborna$', 'izborne$', 'izbornu$', 'izbornih$', 'skupstin', 'sabor', 'predsjednik', 'predsednik', 'parlament', 'stranka$', 'stranke$', 'stranku$', 'strankom$', 'strankama$'],
  business: ['ekonom', 'privred', 'inflacij', 'banka$', 'banke$', 'berz', 'investic'],
  technology: ['tehnolog', 'umjetna inteligencija', 'vestacka inteligencija'],
  sports: ['nogomet', 'fudbal', 'kosark', 'rukomet', 'tenis$', 'utakmic', 'trener'],
  health: ['zdravlj', 'ljekar', 'lekar', 'vakcin', 'bolest'],
  entertainment: ['film$', 'koncert', 'pjevac', 'pevac', 'glumic', 'glumac', 'muzik'],
};
const LANGUAGE_KEYWORD_MAP = {
  fr: {
    politics: ['gouvernement', 'ministre', 'assemblee nationale', 'senat$', 'senateur', 'depute', 'legislative', 'presidentiel', 'municipal'],
    business: ['entreprise', 'inflation', 'banque', 'investiss', 'fiscal', 'douane'],
    technology: ['intelligence artificielle', 'cyber', 'logiciel'],
    sports: ['can$', 'coupe du monde', 'ligue', 'championnat', 'entraineur', 'tennis', 'basket', 'olympi', 'athlet'],
    health: ['paludisme', 'vaccin', 'cancer$', 'epidemi', 'cholera', 'ebola', 'maladie'],
    entertainment: ['film$', 'films$', 'concert', 'chanteu', 'comedien', 'actrice', 'festival'],
  },
  en: {
    politics: ['senate', 'senator$', 'congress', 'lawmaker', 'mps$', 'electoral', 'voter', 'governor$', 'governors$'],
    business: ['tariff', 'inflation', 'investor', 'investment', 'gdp$', 'imf$', 'exports$', 'imports$'],
    technology: ['ai$', 'artificial intelligence', 'software', 'cyber', 'smartphone', 'iphone', 'chatgpt', 'openai'],
    sports: ['tournament', 'championship', 'olympi', 'tennis', 'cricket', 'rugby', 'nba$', 'nfl$', 'fifa$', 'afcon$', 'striker', 'goalkeeper', 'athlet'],
    health: ['vaccin', 'cancer$', 'ebola', 'malaria', 'hiv$', 'patient', 'doctor', 'dengue', 'cholera', 'mpox', 'pandemic'],
    entertainment: ['film$', 'movie', 'actor$', 'actress', 'singer', 'album', 'concert', 'hollywood', 'netflix', 'grammy', 'box office'],
  },
  es: {
    politics: ['gobiern', 'ministr', 'eleccion', 'electoral', 'senado$', 'senador', 'diputad', 'parlament', 'alcald', 'votacion'],
    business: ['empresa', 'inflacion', 'finanz', 'exportac', 'importac', 'arancel'],
    technology: ['tecnolog', 'inteligencia artificial', 'ciberseg', 'ciberatac', 'software'],
    sports: ['futbol', 'deporte', 'deportiv', 'liga$', 'golea', 'gol$', 'goles$', 'tenis$', 'baloncesto', 'beisbol', 'boxeo', 'ciclismo', 'atletismo', 'olimpic', 'campeonato', 'torneo', 'entrenador'],
    health: ['salud$', 'enfermedad', 'vacunacion', 'vacunas$', 'pandemi', 'epidemi', 'cancer$', 'dengue', 'sanitari'],
    entertainment: ['pelicula', 'actriz', 'actor$', 'cantante', 'concierto', 'cine$', 'farandula', 'telenovela'],
  },
  pt: {
    politics: ['governo', 'governador', 'governament', 'ministr', 'eleic', 'eleitor', 'senado$', 'senador', 'deputad', 'parlament', 'prefeit', 'vereador'],
    business: ['empresa', 'inflac', 'juros$', 'mercado', 'exportac', 'importac', 'tarifa', 'pib$', 'financ'],
    technology: ['tecnolog', 'inteligencia artificial', 'ciberseg'],
    sports: ['futebol', 'esporte', 'esportiv', 'campeonato', 'brasileirao', 'libertadores', 'golo$', 'tenis$', 'formula 1', 'olimpic'],
    health: ['saude', 'doenc', 'vacin', 'pandemi', 'cancer$', 'dengue'],
    entertainment: ['filme', 'novela$', 'atriz', 'ator$', 'cantor', 'cantora'],
  },
  de: {
    politics: ['regierung', 'wahl$', 'wahlen', 'wahlkampf', 'bundestag', 'bundesrat', 'kanzler', 'partei', 'parlament', 'koalition', 'landtag'],
    business: ['wirtschaft', 'unternehm', 'borse', 'aktie', 'inflation', 'konjunktur', 'zoll$', 'zolle$', 'arbeitsmarkt'],
    technology: ['kunstliche intelligenz', 'ki$', 'software', 'cyber'],
    sports: ['fussball', 'fußball', 'bundesliga', 'trainer$', 'olympi', 'tennis', 'formel 1', 'weltmeister'],
    health: ['gesundheit', 'arzt$', 'arzte', 'medizin', 'impf', 'krebs$', 'pandemie'],
    entertainment: ['kino', 'konzert', 'musik', 'sanger', 'schauspiel', 'film$', 'filme$', 'filmfest'],
  },
  nl: {
    politics: ['regering', 'kabinet', 'verkiezing', 'politieke partij', 'parlement', 'tweede kamer', 'gemeenteraad', 'coalitie'],
    business: ['bedrijf', 'beurs', 'inflatie', 'banken$'],
    technology: ['kunstmatige intelligentie'],
    sports: ['voetbal', 'wielren', 'eredivisie', 'schaats', 'tennis', 'formule 1', 'olympi', 'trainer$'],
    health: ['gezondheid', 'vaccin', 'kanker', 'zorgverzeker', 'huisarts'],
    entertainment: ['muziek', 'concert', 'zanger', 'film$', 'bioscoop', 'acteur', 'actrice'],
  },
  id: {
    politics: ['pemerintah', 'presiden', 'menteri', 'pemilu', 'pilkada', 'partai politik', 'dpr$', 'parlemen', 'gubernur', 'bupati'],
    business: ['ekonomi', 'bisnis', 'saham', 'inflasi', 'investasi', 'rupiah', 'perbankan', 'pajak'],
    technology: ['teknologi', 'kecerdasan buatan', 'siber'],
    sports: ['sepak bola', 'sepakbola', 'timnas', 'liga$', 'olahraga', 'bulu tangkis', 'badminton', 'motogp', 'pelatih$'],
    health: ['kesehatan', 'rumah sakit', 'penyakit', 'vaksin', 'dokter', 'kanker'],
    entertainment: ['musik', 'konser', 'artis$', 'selebriti', 'aktris', 'aktor$', 'film$', 'penyanyi', 'sinetron'],
  },
  it: {
    politics: ['governo', 'elezion', 'ministr', 'parlamento', 'senato$', 'partito$', 'deputat', 'sindaco', 'quirinale', 'palazzo chigi'],
    business: ['mercato$', 'mercati$', 'borsa$', 'inflazion', 'impresa$', 'imprese$'],
    technology: ['tecnolog', 'intelligenza artificiale'],
    sports: ['calcio', 'campionato', 'allenatore', 'olimpi', 'tennis', 'ciclismo'],
    health: ['salute', 'sanita', 'vaccin', 'tumor'],
    entertainment: ['cantante', 'concerto', 'film$', 'attore', 'attrice', 'sanremo'],
  },
  ro: {
    politics: ['guvern', 'ministr', 'alegeri', 'parlament', 'senat$', 'deputat', 'partid', 'presedint'],
    business: ['companii', 'firma', 'inflati', 'bursa', 'banca$', 'bnr$', 'impozit'],
    technology: ['tehnolog', 'inteligenta artificiala'],
    sports: ['fotbal', 'liga$', 'superliga', 'tenis$', 'handbal', 'antrenor', 'campionat'],
    health: ['sanatat', 'boal', 'vaccin', 'cancer$'],
    entertainment: ['film$', 'concert', 'cantaret', 'actor$', 'actrita', 'muzica'],
  },
  sr: SR, hr: SR, bs: SR,
  sq: {
    politics: ['qeveri', 'ministr', 'zgjedhj', 'kuvend', 'parlament', 'partia', 'kryeministr', 'deputet'],
    business: ['ekonomi', 'biznes', 'inflacion', 'banka$', 'investim'],
    technology: ['teknologji', 'inteligjenca artificiale'],
    sports: ['futboll', 'ndeshj', 'trajner', 'kampionat', 'superliga'],
    health: ['shendet', 'mjek', 'semundj', 'vaksin'],
    entertainment: ['film$', 'koncert', 'kengetar', 'aktor', 'muzik'],
  },
  fi: {
    politics: ['hallitu', 'vaali', 'eduskun', 'ministeri', 'puolue'],
    business: ['talou', 'yhtio', 'porssi', 'inflaatio', 'pankki'],
    technology: ['tekoaly', 'teknologi'],
    sports: ['jalkapallo', 'jaakiekko', 'urheilu', 'liiga$', 'valmentaja', 'formula'],
    health: ['tervey', 'laakari', 'rokot', 'syopa'],
    entertainment: ['elokuva', 'musiikki', 'laulaja', 'konsert', 'nayttelija'],
  },
  // Phase 3b (2026-10-15, ops/investigate-erroring/p3b-*): ~16k articles a month out of other, ~88-90% by hand
  // review. Written in folded form: й->и, ё->е, no Greek tonos, no Vietnamese tone marks (whole phrases, since
  // Vietnamese words are single syllables); ł, đ, ð, þ, æ have no decomposition and stay. Left out on purpose:
  // ru "выбор" (also "choice"; plural election forms only), ru "рублей" (lottery and lawsuit stories), ru
  // "партиз" (партизан), el "τραπεζ" (τραπέζι = table), el "επιχείρηση" (also "operation"), hu "forint" (amounts
  // in crime stories) and "rákos" (Rákospalota), lt "seim" (šeima = family), cs/sl "vlad" (Vladimír), hospitals.
  ru: {
    politics: ['правительств', 'министр', 'выборы$', 'выборов$', 'выборах$', 'выборам$', 'избират', 'парламент', 'госдум', 'дума$', 'думы$', 'думе$', 'президент', 'премьер-министр', 'партия$', 'партии$', 'партии$', 'партию$', 'депутат', 'сенатор', 'кремл', 'санкци', 'дипломат'],
    business: ['экономик', 'экономич', 'рубль$', 'рубля$', 'инфляци', 'банк$', 'банка$', 'банки$', 'банков$', 'центробанк', 'бирж', 'налог', 'бизнес', 'ввп$', 'нефт'],
    technology: ['технолог', 'искусственн', 'нейросет', 'кибер', 'смартфон'],
    sports: ['футбол', 'хокке', 'спорт', 'матч', 'сборная$', 'сборнои$', 'сборную$', 'чемпионат', 'тренер', 'теннис', 'олимпи', 'рпл$', 'кхл$', 'нхл$', 'нба$', 'баскетбол', 'волеибол', 'бокс$', 'боксер'],
    health: ['здоровь', 'медицин', 'болезн', 'вакцин', 'рак$', 'эпидеми', 'пандеми'],
    entertainment: ['фильм', 'кино$', 'кинотеатр', 'актер', 'актрис', 'певец', 'певица', 'концерт', 'музык', 'сериал', 'режиссер'],
  },
  el: {
    politics: ['κυβερνησ', 'κυβερνητ', 'υπουργ', 'εκλογ', 'βουλη$', 'βουλης$', 'βουλευτ', 'προεδρ', 'πρωθυπουργ', 'κομμα$', 'κομματος$', 'αντιπολιτευσ'],
    business: ['οικονομ', 'τραπεζα$', 'τραπεζες$', 'τραπεζων$', 'τραπεζικ', 'πληθωρισμ', 'χρηματιστηρ', 'επιχειρηματ', 'επιχειρησεων$', 'φορολογ', 'επενδυ', 'μετοχ'],
    technology: ['τεχνολογ', 'τεχνητη νοημοσυνη', 'τεχνητης νοημοσυνης', 'κυβερνοεπιθ'],
    sports: ['ποδοσφαιρ', 'μπασκετ', 'αθλητ', 'πρωταθλ', 'προπονητ', 'ολυμπιακ', 'παναθηναικ', 'παοκ$', 'αεκ$', 'τενις$', 'εθνικη ομαδα'],
    health: ['υγει', 'εμβολ', 'καρκιν', 'ασθεν'],
    entertainment: ['ταινια', 'σινεμα', 'κινηματογραφ', 'ηθοποι', 'τραγουδιστ', 'συναυλι', 'μουσικ', 'θεατρ'],
  },
  vi: {
    politics: ['chinh phu$', 'quoc hoi$', 'thu tuong$', 'bo truong$', 'tong thong$', 'chu tich nuoc$', 'bau cu$', 'đai bieu$', 'ngoai giao$'],
    business: ['kinh te$', 'ngan hang$', 'lam phat$', 'chung khoan$', 'doanh nghiep$', 'gia vang$', 'xuat khau$', 'đau tu$'],
    technology: ['cong nghe$', 'tri tue nhan tao$', 'chuyen đoi so$'],
    sports: ['bong đa$', 'đoi tuyen$', 'huan luyen vien$', 'the thao$', 'quan vot$', 'bong chuyen$'],
    health: ['suc khoe$', 'vac xin$', 'ung thu$', 'dich benh$', 'y te$'],
    entertainment: ['phim$', 'ca si$', 'dien vien$', 'hoa hau$', 'am nhac$', 'nghe si$'],
  },
  hu: {
    politics: ['kormany', 'miniszter', 'valasztas', 'parlament', 'orszaggyules', 'part$', 'partja$', 'partok$', 'kepviselo', 'allamtitkar'],
    business: ['gazdasag', 'inflacio', 'tozsde', 'ceg$', 'cegek$', 'befektet'],
    technology: ['mesterseges intelligencia', 'kiber'],
    sports: ['foci', 'labdarug', 'valogatott', 'bajnoksag', 'edzo$', 'olimpi', 'kezilabda'],
    health: ['egeszseg', 'betegseg', 'vakcin'],
    entertainment: ['film$', 'filmek', 'mozi', 'szinesz', 'enekes', 'koncert', 'zene'],
  },
  pl: {
    politics: ['rzad$', 'rzadu$', 'rzadzie$', 'rzadow', 'premier$', 'wybory$', 'wyborow$', 'wyborach$', 'wyborcz', 'sejm', 'senat', 'prezydent', 'poseł', 'posł', 'partia$', 'partii$', 'koalicj'],
    business: ['gospodar', 'inflacj', 'giełd', 'złotych$', 'złoty$', 'podatk', 'firma$', 'firmy$', 'inwestyc'],
    technology: ['sztuczna inteligencja', 'sztucznej inteligencji', 'cyber'],
    sports: ['piłk', 'reprezentacj', 'trener', 'mecz$', 'meczu$', 'ekstraklas', 'siatkowk', 'olimpi', 'tenis'],
    health: ['zdrow', 'choroba', 'chorob', 'szczepion', 'nowotwor', 'rak$', 'nfz$'],
    entertainment: ['film$', 'filmu$', 'kino$', 'aktor', 'aktork', 'piosenkar', 'koncert', 'muzyk', 'serial'],
  },
  cs: {
    politics: ['vlada$', 'vlady$', 'vlade$', 'vladu$', 'vladni', 'ministr', 'volby$', 'voleb$', 'volbach$', 'volebni', 'parlament', 'snemovn', 'senat', 'prezident', 'poslan', 'koalic'],
    business: ['ekonom', 'inflac', 'banka$', 'banky$', 'investic'],
    technology: ['umela inteligence', 'umele inteligence', 'umelou inteligenci'],
    sports: ['fotbal', 'hokej', 'reprezentac', 'trener', 'olympi', 'tenis', 'liga$'],
    health: ['zdravot', 'zdravi$', 'nemoc$', 'nemoci$', 'ockov', 'rakovin'],
    entertainment: ['film$', 'filmu$', 'herec', 'herecka', 'zpevak', 'zpevacka', 'koncert', 'hudb'],
  },
  is: {
    politics: ['rikisstjorn', 'raðherra', 'kosning', 'alþing', 'forset'],
    business: ['efnahag', 'verðbolg', 'hlutabref', 'fyrirtæk'],
    technology: ['gervigreind'],
    sports: ['fotbolt', 'handbolt', 'landslið', 'korfubolt'],
    health: ['heilbrigð', 'krabbamein', 'bolusetn'],
    entertainment: ['kvikmynd', 'tonleik', 'songvar'],
  },
  lt: {
    politics: ['vyriausyb', 'ministr', 'rinkim', 'seimas$', 'seimo$', 'seime$', 'seimui$', 'prezident', 'partij'],
    business: ['ekonom', 'infliacij', 'mokesc', 'investic'],
    technology: ['dirbtin'],
    sports: ['krepsin', 'futbol', 'rinktin', 'trener', 'olimpin'],
    health: ['sveikat', 'vakcin', 'vezys$', 'vezio$'],
    entertainment: ['film$', 'filmas', 'filmo$', 'koncert', 'aktor', 'dainin', 'muzik'],
  },
  bg: {
    politics: ['правителств', 'министър', 'министерств', 'избори$', 'изборите$', 'парламент', 'народно събрание', 'президент', 'депутат', 'партия$', 'партията$', 'партии$'],
    business: ['икономи', 'инфлаци', 'банк$', 'банки$', 'банката$', 'борса$', 'борсата$', 'данъ', 'бизнес', 'инвестици'],
    technology: ['изкуствен', 'технологи'],
    sports: ['футбол', 'баскетбол', 'волеибол', 'треньор', 'олимпи', 'тенис', 'шампионат', 'първенств'],
    health: ['здравеопаз', 'здраве$', 'ваксин', 'рак$', 'болест'],
    entertainment: ['филм', 'кино$', 'актьор', 'актриса', 'певец', 'певица', 'концерт', 'музик'],
  },
  sl: {
    politics: ['vlada$', 'vlade$', 'vladi$', 'vlado$', 'ministr', 'volitv', 'parlament', 'drzavni zbor', 'predsednik', 'poslan', 'stranka$', 'stranke$', 'stranko$'],
    business: ['gospodarst', 'inflacij', 'banka$', 'banke$', 'davek', 'davk', 'podjetj', 'investicij'],
    technology: ['umetna inteligenca', 'umetne inteligence'],
    sports: ['nogomet', 'kosark', 'hokej', 'reprezentanc', 'trener', 'olimpij', 'tenis', 'smuc'],
    health: ['zdravj', 'zdravstv', 'bolezn', 'cepiv', 'rak$'],
    entertainment: ['film$', 'filma$', 'koncert', 'pevec', 'pevka', 'igralec', 'igralka', 'glasb'],
  },
};

// rss-parser (via xml2js) represents an attributed <category domain="...">text</category>
// element as an Object.create(null) object {_: "text", $: {domain: "..."}} -- no
// prototype at all, so it has no toString/valueOf and blindly joining it into a
// string throws "Cannot convert object to primitive value" (hit on Guardian/Fox
// News feeds, which use attributed categories; plain-text <category> feeds never
// triggered this). Pull out just the text, for both shapes.
function categoryToText(cat) {
  if (typeof cat === 'string') return cat;
  if (cat && typeof cat === 'object' && typeof cat._ === 'string') return cat._;
  return '';
}

// Keywords are word *prefixes*: matched only at the start of a word, after
// accents are folded. Plain substring matching (until 2026-10-13) filed
// "passport"/"transport"/"eksport" under sports ("sport"), "occupants" too
// ("cup"), "colleague" ("league"), "agriculture" under entertainment
// ("culture") and "supermarket" under business -- ~2,300 wrong categories a
// week, visible in the Africa country pages' sections -- while the French
// stems never matched accented words ("économie", "santé", "élection").
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const WORD_START = '(?:^|[^\\p{L}\\p{N}])';
const NOT_WORD = `(?!${NOT_KEYWORDS.join('|')})`;
const keywordPattern = (kw) => (kw.endsWith('$') ? `${kw.slice(0, -1)}(?![\\p{L}\\p{N}])` : kw);
const buildKeywordRe = (extra) => Object.entries(KEYWORD_MAP).map(([category, keywords]) => [
  category,
  new RegExp(`${WORD_START}${NOT_WORD}(?:${[...keywords, ...(extra[category] || [])].map(keywordPattern).join('|')})`, 'u'),
]);
const KEYWORD_RE = buildKeywordRe({});
const FRENCH_KEYWORD_RE = buildKeywordRe(FRENCH_KEYWORD_MAP);
const LANGUAGE_KEYWORD_RE = new Map(Object.entries(LANGUAGE_KEYWORD_MAP).map(([lang, map]) => [
  lang,
  Object.entries(map).map(([category, keywords]) => [
    category,
    new RegExp(`${WORD_START}${NOT_WORD}(?:${keywords.map(keywordPattern).join('|')})`, 'u'),
  ]),
]));

// language: the publisher's language code ("fr", "fr-CA", ...); anything
// else, or none, gets the language-neutral keywords only.
// url: the article URL; its section folder is used only when no keyword matches.
// The publisher-language keywords come last, only when neither matched.
function categorize(feedCategories, headline, language, url) {
  const categoryTexts = (feedCategories || []).map(categoryToText);
  const haystacks = fold([...categoryTexts, headline || ''].join(' '));
  const keywordRe = /^fr(?:$|[-_])/i.test(language || '') ? FRENCH_KEYWORD_RE : KEYWORD_RE;
  for (const [category, re] of keywordRe) {
    if (re.test(haystacks)) return category;
  }
  const section = urlSectionCategory(url);
  if (section) return section;
  const languageRe = LANGUAGE_KEYWORD_RE.get(String(language || '').toLowerCase().split(/[-_]/)[0]) || [];
  for (const [category, re] of languageRe) {
    if (re.test(haystacks)) return category;
  }
  return 'other';
}

module.exports = { CATEGORIES, categorize, urlSectionCategory };
