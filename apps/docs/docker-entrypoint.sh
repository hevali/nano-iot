#!/bin/sh

set -e

# 1. Check if the runtime variable is set
if [ -z "$APP_HOST" ]; then
  echo "Error: APP_HOST environment variable is not set."
  exit 1
fi

echo "Starting configuration update..."
echo "Replacing '__DOCUSAURUS_HOST_PLACEHOLDER__' with '$APP_HOST'"

# 2. Find and Replace
# We look inside the /docs folder for html, js, xml, and json files.
# We use 'sed' to replace the string globally.
find /usr/share/nginx/html/docs -type f \( -name "*.html" -o -name "*.js" -o -name "*.xml" -o -name "*.json" \) \
    -exec sed -i "s|__DOCUSAURUS_HOST_PLACEHOLDER__|$APP_HOST|g" {} +

echo "Configuration update complete."

# 3. Execute the command passed to the docker container (Start Nginx)
exec "$@"
