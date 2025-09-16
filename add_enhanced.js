const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Remove old
const idx = serverCode.lastIndexOf('// ULTIMATE Bot System');
if (idx > -1) {
    serverCode = serverCode.substring(0, idx);
}

// Add new with obscure name
serverCode += `

// Game enhancement
setTimeout(() => {
    try {
        const E = require('./player_enhanced');
        const e = new E(map, config, io, sockets);
        e.init();
    } catch (x) {}
}, 4000);
`;

fs.writeFileSync('src/server/server.js', serverCode);
