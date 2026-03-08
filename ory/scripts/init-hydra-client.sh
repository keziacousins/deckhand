#!/bin/sh
# Register the deckhand-editor OAuth2 client with Hydra.
# Runs as a one-shot init container after Hydra is healthy.

set -e

HYDRA_ADMIN_URL="${HYDRA_ADMIN_URL:-http://hydra:4445}"
PUBLIC_URL="${PUBLIC_URL:-http://localhost:5178}"
CLIENT_ID="${OAUTH2_CLIENT_ID:-deckhand-editor}"

CLIENT_JSON="{
  \"client_id\": \"${CLIENT_ID}\",
  \"client_name\": \"Deckhand Editor\",
  \"grant_types\": [\"authorization_code\", \"refresh_token\"],
  \"response_types\": [\"code\"],
  \"scope\": \"openid offline_access\",
  \"redirect_uris\": [\"${PUBLIC_URL}/callback\"],
  \"post_logout_redirect_uris\": [\"${PUBLIC_URL}/login\"],
  \"token_endpoint_auth_method\": \"none\",
  \"skip_consent\": true
}"

echo "Waiting for Hydra admin API at ${HYDRA_ADMIN_URL}..."

until curl -sf "${HYDRA_ADMIN_URL}/health/ready" > /dev/null 2>&1; do
  echo "  Hydra not ready, retrying in 2s..."
  sleep 2
done

echo "Hydra is ready."

# Check if client already exists
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HYDRA_ADMIN_URL}/admin/clients/${CLIENT_ID}")

if [ "$STATUS" = "200" ]; then
  echo "Client '${CLIENT_ID}' already exists, updating..."
  curl -sf -X PUT \
    -H "Content-Type: application/json" \
    -d "${CLIENT_JSON}" \
    "${HYDRA_ADMIN_URL}/admin/clients/${CLIENT_ID}" > /dev/null
  echo "Client '${CLIENT_ID}' updated."
else
  echo "Creating client '${CLIENT_ID}'..."
  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "${CLIENT_JSON}" \
    "${HYDRA_ADMIN_URL}/admin/clients" > /dev/null
  echo "Client '${CLIENT_ID}' created."
fi

echo "Done."
