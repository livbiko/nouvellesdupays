-- CR-2026-11-25-06 part 2b: dry run of migration 022 on production (rolled back).
SET lock_timeout = '10s';
BEGIN;
-- CR-2026-11-25-06 part 2b: category names in the other interface languages of /youtube.
-- name_fr (reference) and name_en stay where they are; names holds { pt, es, ar, de, it, zh, sw }. A language
-- missing from names falls back to French on the page. Additive and idempotent: a row is filled only while its names
-- are still empty, so a re-run (db/migrate.js re-runs every file) never overwrites later edits.
-- Reverse: ALTER TABLE creator_categories DROP COLUMN names;
ALTER TABLE creator_categories ADD COLUMN IF NOT EXISTS names jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE creator_categories c
   SET names = v.names::jsonb, updated_at = now()
  FROM (VALUES
    ('news-media', '{"pt":"Notícias e media","es":"Noticias y medios","ar":"الأخبار والإعلام","de":"Nachrichten & Medien","it":"Notizie e media","zh":"新闻与媒体","sw":"Habari na vyombo vya habari"}'),
    ('journalism', '{"pt":"Jornalismo","es":"Periodismo","ar":"الصحافة","de":"Journalismus","it":"Giornalismo","zh":"新闻业","sw":"Uandishi wa habari"}'),
    ('national-news', '{"pt":"Notícias nacionais","es":"Noticias nacionales","ar":"الأخبار الوطنية","de":"Inlandsnachrichten","it":"Notizie nazionali","zh":"国内新闻","sw":"Habari za kitaifa"}'),
    ('international-affairs', '{"pt":"Notícias internacionais","es":"Noticias internacionales","ar":"الأخبار الدولية","de":"Internationale Nachrichten","it":"Notizie internazionali","zh":"国际新闻","sw":"Habari za kimataifa"}'),
    ('politics', '{"pt":"Notícias políticas","es":"Noticias políticas","ar":"الأخبار السياسية","de":"Politische Nachrichten","it":"Notizie politiche","zh":"政治新闻","sw":"Habari za siasa"}'),
    ('investigative', '{"pt":"Jornalismo de investigação","es":"Periodismo de investigación","ar":"الصحافة الاستقصائية","de":"Investigativer Journalismus","it":"Giornalismo d’inchiesta","zh":"调查新闻","sw":"Uandishi wa habari za uchunguzi"}'),
    ('breaking-news', '{"pt":"Última hora","es":"Última hora","ar":"عاجل","de":"Eilmeldungen","it":"Ultim’ora","zh":"突发新闻","sw":"Habari za dharura"}'),
    ('tv-radio', '{"pt":"Canais de notícias de TV","es":"Canales de noticias de TV","ar":"القنوات الإخبارية التلفزيونية","de":"TV-Nachrichtensender","it":"Canali TV di informazione","zh":"电视新闻频道","sw":"Chaneli za habari za TV"}'),
    ('independent-media', '{"pt":"Media independentes","es":"Medios independientes","ar":"الإعلام المستقل","de":"Unabhängige Medien","it":"Media indipendenti","zh":"独立媒体","sw":"Vyombo huru vya habari"}'),
    ('radio-stations', '{"pt":"Rádios","es":"Emisoras de radio","ar":"المحطات الإذاعية","de":"Radiosender","it":"Radio","zh":"广播电台","sw":"Vituo vya redio"}'),
    ('interviews-debates', '{"pt":"Entrevistas e debates","es":"Entrevistas y debates","ar":"مقابلات ونقاشات","de":"Interviews & Debatten","it":"Interviste e dibattiti","zh":"访谈与辩论","sw":"Mahojiano na mijadala"}'),
    ('news-current-affairs', '{"pt":"Atualidade","es":"Actualidad","ar":"الشؤون الجارية","de":"Aktuelles","it":"Attualità","zh":"时事","sw":"Mambo ya sasa"}'),
    ('business-news', '{"pt":"Notícias económicas","es":"Noticias económicas","ar":"الأخبار الاقتصادية","de":"Wirtschaftsnachrichten","it":"Notizie economiche","zh":"财经新闻","sw":"Habari za uchumi na biashara"}'),
    ('diaspora', '{"pt":"Notícias da diáspora","es":"Noticias de la diáspora","ar":"أخبار المهجر","de":"Diaspora-Nachrichten","it":"Notizie della diaspora","zh":"海外侨民新闻","sw":"Habari za diaspora"}'),
    ('entertainment', '{"pt":"Entretenimento","es":"Entretenimiento","ar":"الترفيه","de":"Unterhaltung","it":"Intrattenimento","zh":"娱乐","sw":"Burudani"}'),
    ('comedy', '{"pt":"Humor e comédia","es":"Humor y comedia","ar":"الكوميديا والفكاهة","de":"Comedy & Humor","it":"Umorismo e comicità","zh":"喜剧与幽默","sw":"Vichekesho"}'),
    ('movies-cinema', '{"pt":"Filmes e cinema","es":"Películas y cine","ar":"الأفلام والسينما","de":"Filme & Kino","it":"Film e cinema","zh":"电影","sw":"Filamu na sinema"}'),
    ('series-drama', '{"pt":"Séries e ficção","es":"Series y ficción","ar":"المسلسلات والدراما","de":"Serien & Drama","it":"Serie e fiction","zh":"剧集","sw":"Tamthilia na mfululizo"}'),
    ('music', '{"pt":"Música e artistas","es":"Música y artistas","ar":"الموسيقى والفنانون","de":"Musik & Künstler","it":"Musica e artisti","zh":"音乐与艺人","sw":"Muziki na wasanii"}'),
    ('celebrity-news', '{"pt":"Celebridades","es":"Famosos","ar":"أخبار المشاهير","de":"Promi-News","it":"Notizie sui vip","zh":"名人新闻","sw":"Habari za watu mashuhuri"}'),
    ('reality-shows', '{"pt":"Reality shows","es":"Telerrealidad","ar":"تلفزيون الواقع","de":"Reality-Shows","it":"Reality show","zh":"真人秀","sw":"Vipindi vya maisha halisi"}'),
    ('entertainment-shows', '{"pt":"Programas de entretenimento","es":"Programas de entretenimiento","ar":"البرامج الترفيهية","de":"Unterhaltungsshows","it":"Programmi di intrattenimento","zh":"综艺节目","sw":"Vipindi vya burudani"}'),
    ('reactions-commentary', '{"pt":"Reações e comentários","es":"Reacciones y comentarios","ar":"ردود الفعل والتعليقات","de":"Reaktionen & Kommentare","it":"Reazioni e commenti","zh":"反应与评论","sw":"Maoni na miitikio"}'),
    ('podcasts', '{"pt":"Podcasts","es":"Pódcasts","ar":"البودكاست","de":"Podcasts","it":"Podcast","zh":"播客","sw":"Podikasti"}'),
    ('web-series', '{"pt":"Séries web","es":"Series web","ar":"مسلسلات الويب","de":"Webserien","it":"Web serie","zh":"网络剧","sw":"Mfululizo wa mtandaoni"}'),
    ('education-knowledge', '{"pt":"Educação e conhecimento","es":"Educación y conocimiento","ar":"التعليم والمعرفة","de":"Bildung & Wissen","it":"Istruzione e conoscenza","zh":"教育与知识","sw":"Elimu na maarifa"}'),
    ('technology-it', '{"pt":"Tecnologia e informática","es":"Tecnología e informática","ar":"التكنولوجيا والمعلوماتية","de":"Technik & IT","it":"Tecnologia e informatica","zh":"科技与信息技术","sw":"Teknolojia na TEHAMA"}'),
    ('science', '{"pt":"Ciência","es":"Ciencia","ar":"العلوم","de":"Wissenschaft","it":"Scienza","zh":"科学","sw":"Sayansi"}'),
    ('history', '{"pt":"História","es":"Historia","ar":"التاريخ","de":"Geschichte","it":"Storia","zh":"历史","sw":"Historia"}'),
    ('languages', '{"pt":"Línguas","es":"Idiomas","ar":"اللغات","de":"Sprachen","it":"Lingue","zh":"语言","sw":"Lugha"}'),
    ('business-finance', '{"pt":"Finanças e economia","es":"Finanzas y economía","ar":"المال والاقتصاد","de":"Finanzen & Wirtschaft","it":"Finanza ed economia","zh":"金融与经济","sw":"Fedha na uchumi"}'),
    ('entrepreneurship', '{"pt":"Negócios e empreendedorismo","es":"Negocios y emprendimiento","ar":"الأعمال وريادة الأعمال","de":"Business & Unternehmertum","it":"Affari e imprenditoria","zh":"商业与创业","sw":"Biashara na ujasiriamali"}'),
    ('tutorials', '{"pt":"Tutoriais","es":"Tutoriales","ar":"دروس تعليمية","de":"Anleitungen","it":"Tutorial","zh":"教程","sw":"Mafunzo"}'),
    ('education', '{"pt":"Ensino","es":"Enseñanza","ar":"التعليم الأكاديمي","de":"Schule & Studium","it":"Istruzione scolastica","zh":"学校教育","sw":"Elimu ya kitaaluma"}'),
    ('personal-development', '{"pt":"Desenvolvimento pessoal","es":"Desarrollo personal","ar":"التنمية الذاتية","de":"Persönlichkeitsentwicklung","it":"Crescita personale","zh":"个人成长","sw":"Maendeleo binafsi"}'),
    ('politics-society', '{"pt":"Política e sociedade","es":"Política y sociedad","ar":"السياسة والمجتمع","de":"Politik & Gesellschaft","it":"Politica e società","zh":"政治与社会","sw":"Siasa na jamii"}'),
    ('political-analysis', '{"pt":"Análise política","es":"Análisis político","ar":"التحليل السياسي","de":"Politische Analyse","it":"Analisi politica","zh":"政治分析","sw":"Uchambuzi wa siasa"}'),
    ('government-institutions', '{"pt":"Governo e instituições","es":"Gobierno e instituciones","ar":"الحكومة والمؤسسات","de":"Regierung & Institutionen","it":"Governo e istituzioni","zh":"政府与机构","sw":"Serikali na taasisi"}'),
    ('elections', '{"pt":"Eleições","es":"Elecciones","ar":"الانتخابات","de":"Wahlen","it":"Elezioni","zh":"选举","sw":"Uchaguzi"}'),
    ('social-issues', '{"pt":"Debates sociais","es":"Debates sociales","ar":"قضايا المجتمع","de":"Gesellschaftsdebatten","it":"Dibattiti sociali","zh":"社会议题","sw":"Mijadala ya kijamii"}'),
    ('human-rights', '{"pt":"Direitos humanos","es":"Derechos humanos","ar":"حقوق الإنسان","de":"Menschenrechte","it":"Diritti umani","zh":"人权","sw":"Haki za binadamu"}'),
    ('religion-spirituality', '{"pt":"Religião e sociedade","es":"Religión y sociedad","ar":"الدين والمجتمع","de":"Religion & Gesellschaft","it":"Religione e società","zh":"宗教与社会","sw":"Dini na jamii"}'),
    ('community', '{"pt":"Discussões comunitárias","es":"Debates comunitarios","ar":"نقاشات مجتمعية","de":"Gemeinschaftsdiskussionen","it":"Discussioni di comunità","zh":"社区讨论","sw":"Mijadala ya jamii"}'),
    ('public-affairs', '{"pt":"Assuntos públicos","es":"Asuntos públicos","ar":"الشؤون العامة","de":"Öffentliche Angelegenheiten","it":"Affari pubblici","zh":"公共事务","sw":"Masuala ya umma"}'),
    ('lifestyle', '{"pt":"Estilo de vida e influenciadores","es":"Estilo de vida e influencers","ar":"أسلوب الحياة والمؤثرون","de":"Lifestyle & Influencer","it":"Stile di vita e influencer","zh":"生活方式与网红","sw":"Mtindo wa maisha na washawishi"}'),
    ('lifestyle-living', '{"pt":"Estilo de vida","es":"Estilo de vida","ar":"فن العيش","de":"Lebensart","it":"Stile di vita","zh":"生活","sw":"Mtindo wa maisha"}'),
    ('fashion', '{"pt":"Moda e beleza","es":"Moda y belleza","ar":"الموضة والجمال","de":"Mode & Beauty","it":"Moda e bellezza","zh":"时尚与美容","sw":"Mitindo na urembo"}'),
    ('travel', '{"pt":"Viagens e turismo","es":"Viajes y turismo","ar":"السفر والسياحة","de":"Reisen & Tourismus","it":"Viaggi e turismo","zh":"旅行与旅游","sw":"Usafiri na utalii"}'),
    ('food-cooking', '{"pt":"Culinária e gastronomia","es":"Cocina y gastronomía","ar":"الطبخ وفنون الطعام","de":"Kochen & Kulinarik","it":"Cucina e gastronomia","zh":"美食与烹饪","sw":"Mapishi na vyakula"}'),
    ('family-relationships', '{"pt":"Família e relações","es":"Familia y relaciones","ar":"الأسرة والعلاقات","de":"Familie & Beziehungen","it":"Famiglia e relazioni","zh":"家庭与情感","sw":"Familia na mahusiano"}'),
    ('fitness-wellness', '{"pt":"Fitness e bem-estar","es":"Forma física y bienestar","ar":"اللياقة والعافية","de":"Fitness & Wohlbefinden","it":"Fitness e benessere","zh":"健身与健康","sw":"Mazoezi na ustawi"}'),
    ('personal-vlogs', '{"pt":"Vlogs","es":"Vlogs","ar":"المدونات المرئية","de":"Vlogs","it":"Vlog","zh":"个人视频日志","sw":"Vlogu"}'),
    ('motivational', '{"pt":"Influenciadores motivacionais","es":"Influencers de motivación","ar":"مؤثرو التحفيز","de":"Motivations-Influencer","it":"Influencer motivazionali","zh":"励志博主","sw":"Washawishi wa motisha"}'),
    ('sports', '{"pt":"Desporto","es":"Deportes","ar":"الرياضة","de":"Sport","it":"Sport","zh":"体育","sw":"Michezo"}'),
    ('football', '{"pt":"Futebol","es":"Fútbol","ar":"كرة القدم","de":"Fußball","it":"Calcio","zh":"足球","sw":"Soka"}'),
    ('basketball', '{"pt":"Basquetebol","es":"Baloncesto","ar":"كرة السلة","de":"Basketball","it":"Pallacanestro","zh":"篮球","sw":"Mpira wa kikapu"}'),
    ('athletics', '{"pt":"Atletismo","es":"Atletismo","ar":"ألعاب القوى","de":"Leichtathletik","it":"Atletica","zh":"田径","sw":"Riadha"}'),
    ('boxing-combat', '{"pt":"Desportos de combate","es":"Deportes de combate","ar":"رياضات القتال","de":"Kampfsport","it":"Sport da combattimento","zh":"格斗运动","sw":"Michezo ya mapigano"}'),
    ('sports-news', '{"pt":"Notícias desportivas","es":"Noticias deportivas","ar":"الأخبار الرياضية","de":"Sportnachrichten","it":"Notizie sportive","zh":"体育新闻","sw":"Habari za michezo"}'),
    ('sports-commentary', '{"pt":"Análise desportiva","es":"Análisis deportivo","ar":"التحليل الرياضي","de":"Sportanalyse","it":"Analisi sportiva","zh":"体育分析","sw":"Uchambuzi wa michezo"}'),
    ('clubs-federations', '{"pt":"Clubes e federações","es":"Clubes y federaciones","ar":"الأندية والاتحادات","de":"Vereine & Verbände","it":"Club e federazioni","zh":"俱乐部与协会","sw":"Vilabu na mashirikisho"}'),
    ('athletes', '{"pt":"Atletas","es":"Deportistas","ar":"الرياضيون","de":"Sportler","it":"Atleti","zh":"运动员","sw":"Wanamichezo"}'),
    ('culture-heritage', '{"pt":"Cultura e património","es":"Cultura y patrimonio","ar":"الثقافة والتراث","de":"Kultur & Erbe","it":"Cultura e patrimonio","zh":"文化与遗产","sw":"Utamaduni na urithi"}'),
    ('african-culture', '{"pt":"Cultura africana","es":"Cultura africana","ar":"الثقافة الأفريقية","de":"Afrikanische Kultur","it":"Cultura africana","zh":"非洲文化","sw":"Utamaduni wa Kiafrika"}'),
    ('traditional-music', '{"pt":"Músicas tradicionais","es":"Músicas tradicionales","ar":"الموسيقى التقليدية","de":"Traditionelle Musik","it":"Musica tradizionale","zh":"传统音乐","sw":"Muziki wa jadi"}'),
    ('dance', '{"pt":"Dança","es":"Danza","ar":"الرقص","de":"Tanz","it":"Danza","zh":"舞蹈","sw":"Ngoma"}'),
    ('arts', '{"pt":"Artes","es":"Artes","ar":"الفنون","de":"Kunst","it":"Arti","zh":"艺术","sw":"Sanaa"}'),
    ('literature', '{"pt":"Literatura","es":"Literatura","ar":"الأدب","de":"Literatur","it":"Letteratura","zh":"文学","sw":"Fasihi"}'),
    ('traditional-culture', '{"pt":"Património cultural","es":"Patrimonio cultural","ar":"التراث الثقافي","de":"Kulturerbe","it":"Patrimonio culturale","zh":"文化遗产","sw":"Urithi wa utamaduni"}'),
    ('languages-traditions', '{"pt":"Línguas e tradições","es":"Lenguas y tradiciones","ar":"اللغات والتقاليد","de":"Sprachen & Traditionen","it":"Lingue e tradizioni","zh":"语言与传统","sw":"Lugha na mila"}'),
    ('history-documentary', '{"pt":"História e documentários","es":"Historia y documentales","ar":"التاريخ والوثائقيات","de":"Geschichte & Dokumentationen","it":"Storia e documentari","zh":"历史与纪录片","sw":"Historia na makala"}'),
    ('culture-society', '{"pt":"Cultura e sociedade","es":"Cultura y sociedad","ar":"الثقافة والمجتمع","de":"Kultur & Gesellschaft","it":"Cultura e società","zh":"文化与社会","sw":"Utamaduni na jamii"}'),
    ('digital-gaming', '{"pt":"Tecnologia e videojogos","es":"Tecnología y videojuegos","ar":"التكنولوجيا وألعاب الفيديو","de":"Technik & Gaming","it":"Tecnologia e videogiochi","zh":"科技与游戏","sw":"Teknolojia na michezo ya video"}'),
    ('gaming', '{"pt":"Videojogos","es":"Videojuegos","ar":"ألعاب الفيديو","de":"Videospiele","it":"Videogiochi","zh":"电子游戏","sw":"Michezo ya video"}'),
    ('esports', '{"pt":"Desportos eletrónicos","es":"Deportes electrónicos","ar":"الرياضات الإلكترونية","de":"E-Sport","it":"Esport","zh":"电子竞技","sw":"Michezo ya kielektroniki"}'),
    ('software-programming', '{"pt":"Desenvolvimento de software","es":"Desarrollo de software","ar":"تطوير البرمجيات","de":"Softwareentwicklung","it":"Sviluppo software","zh":"软件开发","sw":"Utengenezaji wa programu"}'),
    ('cybersecurity', '{"pt":"Cibersegurança","es":"Ciberseguridad","ar":"الأمن السيبراني","de":"Cybersicherheit","it":"Sicurezza informatica","zh":"网络安全","sw":"Usalama wa mtandao"}'),
    ('artificial-intelligence', '{"pt":"Inteligência artificial","es":"Inteligencia artificial","ar":"الذكاء الاصطناعي","de":"Künstliche Intelligenz","it":"Intelligenza artificiale","zh":"人工智能","sw":"Akili bandia"}'),
    ('digital-innovation', '{"pt":"Inovação digital","es":"Innovación digital","ar":"الابتكار الرقمي","de":"Digitale Innovation","it":"Innovazione digitale","zh":"数字创新","sw":"Ubunifu wa kidijitali"}'),
    ('technology', '{"pt":"Gadgets e análises","es":"Gadgets y análisis","ar":"الأجهزة والمراجعات","de":"Gadgets & Tests","it":"Gadget e recensioni","zh":"数码产品与评测","sw":"Vifaa na tathmini"}')
  ) AS v(slug, names)
 WHERE c.slug = v.slug AND c.names = '{}'::jsonb;

SELECT count(*) FILTER (WHERE names <> '{}'::jsonb) AS named, count(*) AS total FROM creator_categories;
ROLLBACK;
SELECT count(*) FILTER (WHERE names <> '{}'::jsonb) AS named, count(*) AS total FROM creator_categories;
