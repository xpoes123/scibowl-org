#!/bin/sh
# Setup script for running both frontends in Docker

cd /workspace

echo "Cleaning node_modules..."
rm -rf node_modules apps/website/frontend/node_modules apps/moss/frontend/node_modules

echo "Installing all workspace dependencies..."
npm ci || npm install

echo "Running website frontend on port 5173..."
cd /workspace/apps/website/frontend
npm run dev -- --host --port 5173 &
WEBSITE_PID=$!

echo "Running moss frontend on port 5174..."
cd /workspace/apps/moss/frontend
npm run dev -- --host --port 5174 &
MOSS_PID=$!

echo "Both frontends started. Waiting..."
wait $WEBSITE_PID $MOSS_PID
