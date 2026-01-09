#!/bin/sh
# Setup script for running both frontends in Docker

cd /workspace

echo "Installing all workspace dependencies..."
npm install

echo "Running website frontend on port 5173..."
cd /workspace/apps/website/frontend
npm run dev -- --host --port 5173 &
WEBSITE_PID=$!

echo "Running moss frontend on port 5174..."
cd /workspace/apps/moss/frontend
npm run dev -- --host --port 5174 &
MOSS_PID=$!

echo "Both frontends started."
echo "Website PID: $WEBSITE_PID"
echo "MOSS PID: $MOSS_PID"
echo "Waiting for processes..."
wait $WEBSITE_PID $MOSS_PID
