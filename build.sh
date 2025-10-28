#!/bin/bash
set -e

echo "Generating Prisma Client with all binary targets..."
npx prisma generate

echo "Building frontend with Vite..."
npm run build
