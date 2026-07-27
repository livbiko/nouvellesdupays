FROM alpine:3.20

USER root
RUN apk add --no-cache curl bash python3 py3-pip ca-certificates openssl jq && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir oci-cli && \
    KUBECTL_VERSION="$(curl -L -s https://dl.k8s.io/release/stable.txt)" && \
    curl -Lo /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" && \
    chmod +x /usr/local/bin/kubectl
ENV PATH="/opt/venv/bin:$PATH"

COPY apps/monitor/monitor.sh /monitor.sh
RUN chmod +x /monitor.sh

ENTRYPOINT ["/monitor.sh"]
