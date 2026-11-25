#!/usr/bin/env bash
# ==============================================================================
# Script: Production Build & Deploy Script for Bussy Bee
# Runs on VPS inside /var/www/bussy-bee
# ==============================================================================

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "=========================================================="
echo " 🚀 Deploying Bussy Bee Application in $APP_DIR"
echo "=========================================================="

# 1. Create logs directory for PM2
mkdir -p logs

# 2. Ensure server environment file exists
if [ ! -f "server/.env" ]; then
  if [ -f "server/.env.production" ]; then
    echo "Creating server/.env from server/.env.production..."
    cp server/.env.production server/.env
  else
    echo "Creating default server/.env..."
    echo "PORT=5035" > server/.env
    echo "NODE_ENV=production" >> server/.env
    echo "MONGODB_URI=mongodb://127.0.0.1:27017/bussy_bee" >> server/.env
    echo "CORS_ORIGIN=https://bussy-bee.gemshine.tech" >> server/.env
  fi
fi

# 3. Install Root (Frontend) Dependencies
echo "📦 Installing Frontend Dependencies..."
npm install --legacy-peer-deps

# 4. Install Server (Backend) Dependencies
echo "📦 Installing Backend Dependencies..."
npm --prefix server install

# 5. Build Application (Vite Frontend -> dist/, Server TypeScript -> server/dist/)
echo "🔨 Building Frontend & Backend..."
npm run build:all

# 6. Reload PM2 Process
echo "🔄 Starting / Reloading PM2 backend process..."
if pm2 describe bussy-bee-api > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --env production
else
  pm2 start ecosystem.config.cjs --env production
fi

# Save PM2 process list to restore on system reboot
pm2 save

# 7. Reload Nginx
echo "🌐 Reloading Nginx..."
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "✅ Nginx reloaded successfully!"
else
  echo "⚠️ Nginx test failed. Please check /etc/nginx/sites-available/bussy-bee"
fi

echo "=========================================================="
echo " 🎉 Deployment Successful!"
echo " 🌐 Accessible at: http://<your-domain-or-vps-ip>:5035"
echo " 📊 Backend Status: run 'pm2 status' or 'npm run pm2:logs'"
echo "=========================================================="
