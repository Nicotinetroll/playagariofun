const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Nájdi a nahraď celú collision časť
const newCollisionCode = `
    map.players.handleCollisions(function (gotEaten, eater) {
        try {
            // Get players safely
            const eatenPlayer = map.players.data[gotEaten.playerIndex];
            const eaterPlayer = map.players.data[eater.playerIndex];
            
            // Safety checks
            if (!eatenPlayer || !eaterPlayer) return;
            if (eatenPlayer.invincible || eaterPlayer.invincible) return;
            
            // Get the cell that was eaten
            const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
            if (!cellGotEaten) return;

            // Transfer mass
            map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

            // Remove eaten cell
            const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
            
            // Handle player death
            if (playerDied) {
                let playerGotEaten = map.players.data[gotEaten.playerIndex];
                if (playerGotEaten) {
                    // Emit death event
                    io.emit('playerDied', { 
                        name: playerGotEaten.name || '',
                        playerEatenName: playerGotEaten.name || '',
                        playerWhoAtePlayerName: eaterPlayer.name || ''
                    });
                    
                    // Send RIP to dead player
                    if (sockets[playerGotEaten.id]) {
                        sockets[playerGotEaten.id].emit('RIP');
                    }
                    
                    // Remove from game
                    map.players.removePlayerByIndex(gotEaten.playerIndex);
                }
            }
        } catch (e) {
            console.error('[COLLISION] Error handling collision:', e);
        }
    });`;

// Nahraď starý kód
const collisionStart = serverCode.indexOf('map.players.handleCollisions(');
if (collisionStart > -1) {
    const collisionEnd = serverCode.indexOf('});', collisionStart) + 3;
    serverCode = serverCode.substring(0, collisionStart) + newCollisionCode + serverCode.substring(collisionEnd);
}

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Collision handler rewritten!');
