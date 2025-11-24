#!/bin/sh

set -e

if [ -z "$APP_HOST" ]; then
  echo "Error: APP_HOST environment variable is not set."
  exit 1
fi

echo "Starting configuration update..."
echo "Replacing '__DOCUSAURUS_HOST_PLACEHOLDER__' with '$APP_HOST'"

find /app -type f \( -name "*.html" -o -name "*.js" -o -name "*.xml" -o -name "*.json" \) \
    -exec sed -i "s|__DOCUSAURUS_HOST_PLACEHOLDER__|$APP_HOST|g" {} +

echo "Configuration update complete."

exec "$@"
