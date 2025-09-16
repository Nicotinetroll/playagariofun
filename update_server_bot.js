const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Remove old bot
const botIdx = serverCode.indexOf('// Simple Bot System');
if (botIdx > -1) {
    serverCode = serverCode.substring(0, botIdx);
}

// Add ultimate bot
serverCode += `

// ULTIMATE Bot System
setTimeout(() => {
    try {
        const UltimateBot = require('./ultimate_bot');
        const bot = new UltimateBot(map, config, io, sockets);
        bot.start();
        console.log('[BOT] ULTIMATE bot system activated!');
    } catch (e) {
        console.error('[BOT] Failed to start ultimate bot:', e);
    }
}, 3000);
`;

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Ultimate bot integrated!');
