const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Odstráň starý bot kód
const botIdx = serverCode.indexOf('// Bot system');
if (botIdx > -1) {
    serverCode = serverCode.substring(0, botIdx);
}

// Pridaj nový jednoduchý bot
serverCode += `

// Simple Bot System
setTimeout(() => {
    try {
        const SimpleBot = require('./simple_bot');
        const bot = new SimpleBot(map, config, io, sockets);
        bot.start();
        console.log('[BOT] Bot system initialized');
    } catch (e) {
        console.error('[BOT] Failed to start bot:', e);
    }
}, 5000);
`;

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Simple bot added!');
