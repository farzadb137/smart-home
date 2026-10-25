#!/usr/bin/env bash
# Build every firmware app. Usage: ./build-all.sh
set -euo pipefail
cd "$(dirname "$0")/../apps"
for app in */; do
  echo "=== Building ${app%/} ==="
  (cd "$app" && idf.py build)
done
