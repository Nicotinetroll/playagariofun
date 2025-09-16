#!/bin/bash

echo "🔧 FINÁLNA OPRAVA - require error a 3.5GB RAM..."

# 1. Najprv vyčistíme všetko
echo "🧹 Čistím staré súbory..."
cd /var/www/agar.io-clone
rm -rf bin/*
rm -rf node_modules
rm package-lock.json

# 2. Reinštalujeme dependencies
echo "📦 Reinštalujem packages..."
npm install

# 3. Build projekt SPRÁVNE
echo "🔨 Building projekt s webpack..."
NODE_ENV=production npm run build

# 4. PM2 restart s 3.5GB RAM
echo "🚀 Štartujem server s 3.5GB RAM..."
pm2 delete agar-server 2>/dev/null
pm2 start bin/server/server.js --name "agar-server" \
    --node-args="--expose-gc --max-old-space-size=3584" \
    --max-memory-restart="3500M"

pm2 save

echo "✅ HOTOVO!"
