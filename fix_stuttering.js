const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Oprav sendUpdates funkciu aby nehavarovala
serverCode = serverCode.replace(
    /const sendUpdates = \(\) => \{[\s\S]*?\n\};/,
    `const sendUpdates = () => {
    try {
        // Update spectators safely
        spectators.forEach(socketID => {
            if (sockets[socketID]) {
                try {
                    updateSpectator(socketID);
                } catch (e) {
                    console.error('[UPDATE] Spectator error:', e.message);
                }
            }
        });
        
        // Update players safely
        map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
            try {
                // Skip if no socket exists (bots)
                if (!sockets[playerData.id]) {
                    return;
                }
                
                sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
                
                if (leaderboardChanged) {
                    sendLeaderboard(sockets[playerData.id]);
                }
            } catch (e) {
                // Ignore socket errors silently
            }
        });

        leaderboardChanged = false;
    } catch (e) {
        console.error('[SEND_UPDATES] Critical error:', e);
    }
};`
);

// Oprav tickGame aby nebol blocking
serverCode = serverCode.replace(
    /const tickGame = \(\) => \{[\s\S]*?\n\};/,
    `const tickGame = () => {
    try {
        map.players.data.forEach(player => {
            try {
                // Skip bots from normal tick
                if (!player.isBot) {
                    tickPlayer(player);
                }
            } catch (e) {
                console.error('[TICK] Player error:', e.message);
            }
        });
        
        map.massFood.move(config.gameWidth, config.gameHeight);

        map.players.handleCollisions(function (gotEaten, eater) {
            try {
                const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
                if (!cellGotEaten) return;

                map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

                const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
                if (playerDied) {
                    let playerGotEaten = map.players.data[gotEaten.playerIndex];
                    if (playerGotEaten) {
                        io.emit('playerDied', { name: playerGotEaten.name });
                        if (sockets[playerGotEaten.id]) {
                            sockets[playerGotEaten.id].emit('RIP');
                        }
                        map.players.removePlayerByIndex(gotEaten.playerIndex);
                    }
                }
            } catch (e) {
                console.error('[COLLISION] Error:', e.message);
            }
        });
    } catch (e) {
        console.error('[TICK_GAME] Critical error:', e);
    }
};`
);

// Oprav bot tick aby bol samostatný
serverCode = serverCode.replace(
    'this.updateInterval = setInterval(() => {',
    'this.updateInterval = setInterval(() => { try {'
);

serverCode = serverCode.replace(
    '}, 100);',
    '} catch(e) { console.error("[BOT] Tick error:", e.message); } }, 100);'
);

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Server stuttering fixes applied!');
