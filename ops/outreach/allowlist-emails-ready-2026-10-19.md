# Ready-to-send allowlisting request (2026-10-19) — NOT SENT

Same format as allowlist-emails-ready-2026-10-17.md. Check the address on the outlet's contact page, paste, sign, send.
Then tell Claude it went out so it is logged.

---

## 17. National News Agency — NNA (Lebanon)

**To:** the contact form at https://www.nna-leb.gov.lb/en/contact-us (no e-mail address is published)

**Context:** added in Build #97 (publisher 9028). The feed answers our crawler from BikoDC, but every request from the
cluster gets HTTP 403, so this is probably a block on the cloud IP range rather than on the user agent. Lebanon is
covered meanwhile by Annahar.

```
Subject: Allowlisting request for NouvellesDuPays.com's news crawler

Dear National News Agency team,

NouvellesDuPays.com is a news aggregator covering 192 countries. We show each headline with a short summary, credit the publisher by name, and link every item back to the original article on the publisher's own site. The National News Agency is one of our sources for Lebanon.

Our crawler's requests to your English RSS feed (https://www.nna-leb.gov.lb/en/rss) currently receive a 403 (Forbidden) response from our servers, so NNA dispatches do not appear in our Lebanon coverage. The crawler identifies itself honestly as NouvellesDuPaysBot/1.0 (+https://nouvellesdupays.com), respects robots.txt, and only requests your public RSS feed - currently about once a day while blocked. We will not try to get around your protection.

Would you be willing to allowlist this user agent, or our crawler's IP addresses (we can send them), for your RSS feed? If you would rather not be listed on NouvellesDuPays.com, just tell us and we will remove the NNA.

Thank you for your time.

Kind regards,
[your name]
NouvellesDuPays.com
```
