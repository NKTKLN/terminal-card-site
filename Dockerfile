FROM nginx:1.27-alpine

# Replace default nginx site config with ours
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy ONLY the static site from ./app into Nginx web root
COPY ./app/ /usr/share/nginx/html/

# Optional: healthcheck (useful for orchestration/monitoring)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80
