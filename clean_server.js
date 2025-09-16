const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Odstráň všetky bot sekcie
let cleanCode = serverCode;

// Nájdi prvý výskyt bot kódu a odstráň všetko od neho
const botMarkers = [
    '// Load sophisticated bot',
    '// Load bot',
    '// Bot system',
    'const PussyDestroyerBot'
];

for (let marker of botMarkers) {
    const idx = cleanCode.indexOf(marker);
    if (idx > -1) {
        cleanCode = cleanCode.substring(0, idx);
    }
}

// Pridaj bot kód len raz na koniec
cleanCode += `

// Bot system - added once
setTimeout(() => {
    try {
        const BotClass = require('./sophisticated_bot');
        const botMapUtils = require('./map/map');
        const PlayerClass = botMapUtils.playerUtils.Player;
        
        console.log('[BOT] Starting PussyDestroyer bot system...');
        const bot = new BotClass(map, config, io, PlayerClass);
        bot.start();
    } catch (e) {
        console.error('[BOT] Failed to start bot:', e);
    }
}, 5000);
`;

fs.writeFileSync('src/server/server.js', cleanCode);
console.log('Server cleaned!');
