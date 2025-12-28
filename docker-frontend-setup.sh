#!/bin/sh
# Setup script for running both frontends in Docker

cd /workspace

echo "Installing root dependencies..."
npm install --legacy-peer-deps --silent

echo "Running website frontend..."
cd /workspace/apps/website/frontend
npm run dev -- --host &
WEBSITE_PID=$!

echo "Running moss frontend..."
cd /workspace/apps/moss/frontend
npm run dev -- --host &
MOSS_PID=$!

echo "Both frontends started. Waiting..."
wait $WEBSITE_PID $MOSS_PID
