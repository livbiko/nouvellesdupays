FROM alpine:3.20

USER root
# coreutils, not just apk's default busybox date: busybox's `date -d`
# can't parse the timestamp formats this script actually needs (OpenSSL's
# `Oct 24 06:39:40 2026 GMT` and Kubernetes' ISO8601
# `2026-07-27T07:55:00Z`) -- it silently falls back to epoch 0 on both,
# which produced "TLS cert expires in -20661 days" and a multi-million-
# minute worker age on the first real test run. GNU coreutils' date
# handles both formats correctly.
# postgresql16-client: psql for silent-report.sh (weekly report, read-only query).
RUN apk add --no-cache curl bash python3 py3-pip ca-certificates openssl jq coreutils postgresql16-client && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir oci-cli && \
    KUBECTL_VERSION="$(curl -L -s https://dl.k8s.io/release/stable.txt)" && \
    curl -Lo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" && \
    chmod +x /usr/local/bin/kubectl
ENV PATH="/opt/venv/bin:$PATH"

COPY apps/monitor/monitor.sh /monitor.sh
COPY apps/monitor/silent-report.sh /silent-report.sh
RUN chmod +x /monitor.sh /silent-report.sh

ENTRYPOINT ["/monitor.sh"]
