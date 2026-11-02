SELECT 'c|' || ds.id || '|' || c.iso_code || '|' || ds.name || '|' || ds.homepage_url || '|' || ds.domain || '|lang=' || coalesce(ds.language,'') || '/' || coalesce(ds.html_lang,'')
       || '|' || ds.feed_type || '|' || ds.feed_url || '|yt=' || coalesce(ds.youtube_url,'') || '|fb=' || coalesce(ds.facebook_url,'') || '|x=' || coalesce(ds.x_url,'')
       || '|status=' || ds.status || '|health=' || ds.health || '|type=' || coalesce(ds.source_type,'')
  FROM discovered_sources ds JOIN countries c ON c.id = ds.country_id
 WHERE ds.id IN (108,102,77,106,98,58,70,64,95,91,149,159,728,114,897,656) ORDER BY ds.id;
SELECT 'known|' || p.id || '|' || p.name || '|' || p.domain FROM publishers p
 WHERE regexp_replace(lower(p.domain), '^www\.', '') IN ('sanmarinortv.sm','tdh.gov.tm','elobservador.com.uy','diariandorra.ad','qazinform.com','khaleejtimes.com','elespectador.com','naharnet.com','bernama.com','novinite.com','en.antaranews.com','antaranews.com','uza.uz','dailymast.com','efe.com','mwanaspoti.co.tz','realites-senegal.sn');
