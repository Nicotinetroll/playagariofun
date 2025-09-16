const fs = require('fs');

let serverCode = fs.readFileSync('bin/server/server.js', 'utf8');

// Pridaj food pooling a optimalizácie
const optimizations = `

// Performance optimizations
const foodPool = [];
const MAX_POOL_SIZE = 100;

// Food pooling
function getFoodFromPool() {
    return foodPool.length > 0 ? foodPool.pop() : null;
}

function returnFoodToPool(food) {
    if (foodPool.length < MAX_POOL_SIZE) {
        foodPool.push(food);
    }
}

// Optimize food scanning
let foodUpdateCounter = 0;
const FOOD_UPDATE_INTERVAL = 3; // Update food every 3 ticks

`;

// Pridaj na začiatok súboru
serverCode = optimizations + serverCode;

// Optimalizuj sendUpdates - posielaj menej dát
serverCode = serverCode.replace(
    'setInterval(sendUpdates, 1000 / config.networkUpdateFactor);',
    'setInterval(sendUpdates, 1000 / Math.min(config.networkUpdateFactor, 30));'
);

fs.writeFileSync('bin/server/server.js', serverCode);
console.log('Server optimized!');
