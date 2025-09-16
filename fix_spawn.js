const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// 1. Vypni bota dočasne
serverCode = serverCode.replace(
    'setTimeout(() => {',
    '/* TEMPORARILY DISABLED BOT\nsetTimeout(() => {'
);
serverCode = serverCode.replace(
    '}, 2000);',
    '}, 2000);\n*/'
);

// 2. Pridaj spawn protection
const tickPlayerFunc = serverCode.indexOf('const tickPlayer = (currentPlayer)');
if (tickPlayerFunc > -1) {
    serverCode = serverCode.replace(
        'const tickPlayer = (currentPlayer) => {',
        `const tickPlayer = (currentPlayer) => {
    // Spawn protection - 3 sekundy
    if (currentPlayer.spawnTime && Date.now() - currentPlayer.spawnTime < 3000) {
        currentPlayer.invincible = true;
    } else {
        currentPlayer.invincible = false;
    }`
    );
}

// 3. Oprav collision detection aby rešpektovala spawn protection
serverCode = serverCode.replace(
    'exports.Player.checkForCollisions(',
    `// Skip collision if either player is invincible
    if (this.data[playerAIndex].invincible || this.data[playerBIndex].invincible) {
        return;
    }
    exports.Player.checkForCollisions(`
);

// 4. Pridaj spawn time pri vytvorení hráča
serverCode = serverCode.replace(
    'currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);',
    `currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
    currentPlayer.spawnTime = Date.now();
    currentPlayer.invincible = true;`
);

// 5. Oprav spectator spawn
serverCode = serverCode.replace(
    "socket.emit('welcome', {}, {",
    `// Spectator doesn't need player data
    socket.emit('welcome', { 
        id: socket.id,
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        name: 'Spectator'
    }, {`
);

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Spawn protection added!');
