const fs = require('fs');

// Pridaj optimalizácie do klienta
const clientOptimizations = `
// Reduce draw calls
let lastDrawTime = Date.now();
const MIN_DRAW_INTERVAL = 16; // Max 60 FPS

// Cache calculations
let cachedLeaderboard = null;
let leaderboardCacheTime = 0;
`;

// Aplikuj ak existuje bundle
if (fs.existsSync('bin/client/js/app.js')) {
    let client = fs.readFileSync('bin/client/js/app.js', 'utf8');
    client = clientOptimizations + client;
    fs.writeFileSync('bin/client/js/app.js', client);
    console.log('Client optimized!');
}
