#!/bin/sh
# Generate s3.json from env vars at startup, then exec the original command.
set -e

if [ -z "${S3_ACCESS_KEY:-}" ] || [ -z "${S3_SECRET_KEY:-}" ]; then
  echo "ERROR: S3_ACCESS_KEY and S3_SECRET_KEY must be set" >&2
  exit 1
fi

mkdir -p /etc/seaweedfs
cat > /etc/seaweedfs/s3.json <<EOF
{
  "identities": [
    {
      "name": "deckhand",
      "credentials": [
        {
          "accessKey": "${S3_ACCESS_KEY}",
          "secretKey": "${S3_SECRET_KEY}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging", "Lock"]
    }
  ]
}
EOF

exec /usr/bin/weed "$@"
