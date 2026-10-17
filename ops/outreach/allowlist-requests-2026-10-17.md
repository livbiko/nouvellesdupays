# Allowlisting requests — 15 bot-blocked publishers (drafted 2026-10-17)

These publishers refuse our honest crawler (HTTP 403, Bangkok Post 451). Since Build #67 the worker backs off to about one
request a day per feed; if a publisher allowlists us, the feed starts working with no change on our side.
Same approach as the GhanaWeb request sent 2026-10-16. **Nothing here has been sent.** The owner sends each one by hand.

**Addresses come from web-search summaries, not from the outlets' own pages** (our bot is blocked from most of them).
Check each on the linked contact page before sending; prefer a newsroom or web-team address over advertising.

| # | Publisher (id) | Country | Feed we poll | Block | Suggested address — verify first | Contact page | Language |
|---|---|---|---|---|---|---|---|
| 1 | The Herald (275) | ZW | herald.co.zw/feed/ | 403 | Zimpapers contact page | [zimpapers.co.zw/contact-us](https://www.zimpapers.co.zw/contact-us/) | EN |
| 2 | ERR News (570) | EE | news.err.ee/rss | 403 | `developers@err.ee` (tech) or `news@err.ee` | [About ERR News, staff and contacts](https://news.err.ee/584393/about-err-news-staff-and-contacts) | EN |
| 3 | Philstar (985) | PH | philstar.com/rss/headlines | 403 | see contact page (editorial) | [philstar.com/contact-us](https://www.philstar.com/contact-us) | EN |
| 4 | Bangkok Post (989) | TH | bangkokpost.com/rss/data/topstories.xml | **451** | `webmaster@bangkokpost.com` | [bangkokpost.co.th/post_contact](https://www.bangkokpost.co.th/post_contact) | EN |
| 5 | Arab News (1036) | SA | arabnews.com/rss.xml | 403 | `general@arabnews.com` | [arabnews.com/contactus](https://www.arabnews.com/contactus) | EN |
| 6 | CNC3 (1542) | TT | cnc3.co.tt/feed/ | 403 | no general address found — phone +1 868 627 5996 / Guardian Media | [cnc3.co.tt](https://www.cnc3.co.tt/) | EN |
| 7 | El País (1561) | UY | elpais.com.uy/rss | 403 | `soporteweb@elpais.com.uy` | [elpais.com.uy](https://www.elpais.com.uy/) | ES |
| 8 | Fraternité (6741) | BJ | fraternite.bj/feed/ | 403 | `contact@fraternitebj.info` (older domain — check) | [fraternite.bj](https://fraternite.bj/) | FR |
| 9 | Médias24 (167) | MA | medias24.com/feed | 403 | `contact@medias24.com` | [medias24.com/nous-contacter](https://medias24.com/nous-contacter/) | FR |
| 10 | Sudan Akhbar (264) | SD | sudanakhbar.com/feed | 403 | `news@sudanakhbar.com` | [sudanakhbar.com](https://www.sudanakhbar.com/) | EN (or AR) |
| 11 | Libertatea (597) | RO | libertatea.ro/rss | 403 | `redactie@libertatea.ro` | [Libertatea on eurotopics](https://www.eurotopics.net/en/227289/libertatea) | EN |
| 12 | Ada Derana (1012) | LK | adaderana.lk/rss.php | 403 | `adaderana@derana.lk` (web editor) | [adaderana.lk/contact-us](https://adaderana.lk/contact-us) | EN |
| 13 | Sloboden Pečat (623) | MK | slobodenpecat.mk/feed | 403 | `webredakcija@pecat.mk` | [Impresum](https://www.slobodenpecat.mk/en/impresum/) | EN |
| 14 | Thai Rath (990) | TH | thairath.co.th/rss/news | 403 | `cs@thairath.co.th` | [thairath.co.th/contact/en](https://www.thairath.co.th/contact/en) | EN |
| 15 | Kallxo (628) | XK | kallxo.com/feed/ | 403 | `info@kallxo.com` | [kallxo.com/per-ne/kontakti](https://kallxo.com/per-ne/kontakti/) | EN |

Fill in `{OUTLET}`, `{COUNTRY}` and `{FEED_URL}` from the table. Bangkok Post: replace "a 403 (Forbidden) response"
with "an HTTP 451 response". Sign with your own name.

---

## English

**Subject:** Allowlisting request for NouvellesDuPays.com's news crawler

> Dear {OUTLET} team,
>
> NouvellesDuPays.com is a news aggregator covering 192 countries. We show each headline with a short summary, credit the
> publisher by name, and link every item back to the original article on the publisher's own site. {OUTLET} is one of our
> sources for {COUNTRY}.
>
> Our crawler's requests to your feed ({FEED_URL}) currently receive a 403 (Forbidden) response, so {OUTLET} articles
> no longer appear in our {COUNTRY} coverage. The crawler identifies itself honestly as
> `NouvellesDuPaysBot/1.0 (+https://nouvellesdupays.com)`, respects robots.txt, and only requests your public RSS feed —
> at most every few minutes when allowed, and currently about once a day while blocked. We will not try to get around
> your protection.
>
> Would you be willing to allowlist this user agent for your RSS feed? We can share our crawler's IP addresses if you
> prefer to allowlist by IP. If you would rather not be listed on NouvellesDuPays.com, just tell us and we will remove
> {OUTLET}.
>
> Thank you for your time.
>
> Kind regards,
> [your name]
> NouvellesDuPays.com

## Français (Fraternité, Médias24)

**Objet :** Demande d'autorisation pour le robot de veille de NouvellesDuPays.com

> Madame, Monsieur,
>
> NouvellesDuPays.com est un agrégateur d'actualités couvrant 192 pays. Nous affichons chaque titre avec un court résumé,
> en citant l'éditeur et en renvoyant chaque article vers sa page d'origine sur votre site. {OUTLET} fait partie de nos
> sources pour {COUNTRY}.
>
> Les requêtes de notre robot vers votre flux ({FEED_URL}) reçoivent actuellement une réponse 403 (accès refusé) ; vos
> articles n'apparaissent donc plus dans notre couverture. Notre robot s'identifie clairement
> (`NouvellesDuPaysBot/1.0 (+https://nouvellesdupays.com)`), respecte le fichier robots.txt et ne consulte que votre flux
> RSS public — environ une fois par jour tant qu'il est bloqué. Nous ne chercherons pas à contourner votre protection.
>
> Accepteriez-vous d'autoriser cet agent pour votre flux RSS ? Nous pouvons vous communiquer les adresses IP de notre
> robot si vous préférez une autorisation par IP. Si vous préférez ne pas figurer sur NouvellesDuPays.com, il suffit de
> nous le dire et nous retirerons {OUTLET}.
>
> Avec nos remerciements,
> [votre nom]
> NouvellesDuPays.com

## Español (El País Uruguay)

**Asunto:** Solicitud de autorización para el lector de feeds de NouvellesDuPays.com

> Estimado equipo de El País:
>
> NouvellesDuPays.com es un agregador de noticias que cubre 192 países. Mostramos cada titular con un breve resumen,
> citamos al medio y enlazamos cada nota a su página original en su sitio. El País es una de nuestras fuentes para
> Uruguay.
>
> Las solicitudes de nuestro lector a su feed (https://www.elpais.com.uy/rss) reciben actualmente una respuesta 403
> (acceso denegado), por lo que sus notas ya no aparecen en nuestra cobertura de Uruguay. Nuestro lector se identifica
> claramente (`NouvellesDuPaysBot/1.0 (+https://nouvellesdupays.com)`), respeta robots.txt y solo consulta su feed RSS
> público — alrededor de una vez al día mientras está bloqueado. No intentaremos eludir su protección.
>
> ¿Estarían dispuestos a autorizar este agente para su feed RSS? Podemos enviarles las direcciones IP de nuestro lector
> si prefieren autorizar por IP. Si prefieren no aparecer en NouvellesDuPays.com, avísennos y retiraremos El País.
>
> Muchas gracias,
> [su nombre]
> NouvellesDuPays.com
