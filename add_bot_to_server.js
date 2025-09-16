const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Odstráň starý bot kód ak existuje
const botStart = serverCode.indexOf('// Load sophisticated bot');
if (botStart !== -1) {
    serverCode = serverCode.substring(0, botStart);
}

// Pridaj nový bot kód
serverCode += `

// Load sophisticated bot
const PussyDestroyerBot = require('./sophisticated_bot');
const mapUtils = require('./map/map');
let botInstance = null;

// Start bot after 5 seconds
setTimeout(() => {
    try {
        console.log('[BOT] Initializing PussyDestroyer...');
        // Pass the Player class directly
        const PlayerClass = mapUtils.playerUtils.Player;
        botInstance = new PussyDestroyerBot(map, config, io, PlayerClass);
        botInstance.start();
    } catch (e) {
        console.error('[BOT] Failed to initialize:', e);
    }
}, 5000);

// Clean shutdown
process.on('SIGINT', () => {
    if (botInstance) {
        botInstance.stop();
    }
    process.exit();
});
`;

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Server updated with fixed bot!');
