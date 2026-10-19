\set ON_ERROR_STOP on
SELECT 'retrytest|' || count(*) || ' active publishers' FROM publishers WHERE feed_status = 'active';
