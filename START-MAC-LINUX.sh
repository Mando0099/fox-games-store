#!/bin/sh
echo "Fox Games Market - Kashier"
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed."; exit 1; fi
npm install
echo "Open http://localhost:9000"
npm start
