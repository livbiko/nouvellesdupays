# postgres:16-alpine already ships pg_dump/psql matching the server version
# used by the postgres StatefulSet -- reused here as the base rather than a
# generic image, to avoid any client/server version drift.
FROM postgres:16-alpine

# The upstream postgres image sets USER postgres at the end of its own
# Dockerfile -- switch back to root explicitly rather than relying on that
# being the active user at this layer, since apk/pip/venv setup needs it.
USER root
RUN apk add --no-cache python3 py3-pip bash gzip && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir oci-cli
ENV PATH="/opt/venv/bin:$PATH"

COPY apps/backup/backup.sh /backup.sh
RUN chmod +x /backup.sh

ENTRYPOINT ["/backup.sh"]
