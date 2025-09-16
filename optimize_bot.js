const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Nájdi bot update interval a zmeň ho
serverCode = serverCode.replace(
    '}, 50);',  // 50ms = 20 FPS
    '}, 100);'  // 100ms = 10 FPS (menej náročné)
);

// Zmeň bot update aby kontroloval menej jedla
serverCode = serverCode.replace(
    'for (let food of this.map.food.data.slice(0, 100))',
    'for (let food of this.map.food.data.slice(0, 30))' // Kontroluj len 30 najbližších
);

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Bot optimized!');
