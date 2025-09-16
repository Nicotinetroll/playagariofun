const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Pridaj spawn protection ak neexistuje
if (!serverCode.includes('spawnProtection')) {
    // Pri spawne hráča
    serverCode = serverCode.replace(
        "console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');",
        `console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
        currentPlayer.spawnProtection = Date.now(); // 3 second protection`
    );
    
    // V collision detection
    serverCode = serverCode.replace(
        'for (var i = 0; i < users.length; i++) {',
        `for (var i = 0; i < users.length; i++) {
            // Skip if spawn protection
            if (users[i].spawnProtection && Date.now() - users[i].spawnProtection < 3000) continue;`
    );
}

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Spawn protection added!');
