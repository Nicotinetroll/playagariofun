const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Nájdi problematické miesto a oprav ho
// Problém je v handleCollisions - try block bez catch
serverCode = serverCode.replace(
    `if (!eatenPlayer || !eaterPlayer) return;
            if (eatenPlayer.invincible || eaterPlayer.invincible) return;`,
    `if (!eatenPlayer || !eaterPlayer) return;
            if (eatenPlayer.invincible || eaterPlayer.invincible) return;
            
            const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
            if (!cellGotEaten) return;

            map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

            const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
            if (playerDied) {
                let playerGotEaten = map.players.data[gotEaten.playerIndex];
                if (playerGotEaten) {
                    io.emit('playerDied', { 
                        name: playerGotEaten.name || '', 
                        playerEatenName: playerGotEaten.name || '', 
                        playerWhoAtePlayerName: '' 
                    });
                    if (sockets[playerGotEaten.id]) {
                        sockets[playerGotEaten.id].emit('RIP');
                    }
                    map.players.removePlayerByIndex(gotEaten.playerIndex);
                }
            }
        } catch (e) {
            console.error('[COLLISION] Error:', e.message);
        }`
);

// Odstráň duplicitný kód ak existuje
serverCode = serverCode.replace(/}\s*catch\s*\(e\)\s*{\s*console\.error\('\[COLLISION\] Error:', e\.message\);\s*}\s*}\s*catch/g, '} catch');

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Syntax fixed!');
