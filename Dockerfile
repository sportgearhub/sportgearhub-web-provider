FROM ghcr.io/static-web-server/static-web-server:2

COPY dist /public
COPY sws.toml /sws.toml

ENV SERVER_ROOT=/public
ENV SERVER_CONFIG_FILE=/sws.toml
ENV SERVER_FALLBACK_PAGE=/public/index.html
ENV SERVER_LOG_LEVEL=warn

EXPOSE 80
