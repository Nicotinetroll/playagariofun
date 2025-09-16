const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// 1. Pridaj spawn protection do tickPlayer funkcie
const tickPlayerStart = serverCode.indexOf('const tickPlayer = (currentPlayer) => {');
if (tickPlayerStart > -1) {
    // Nájdi koniec funkcie
    let braceCount = 0;
    let inFunction = false;
    let endPos = tickPlayerStart;
    
    for (let i = tickPlayerStart; i < serverCode.length; i++) {
        if (serverCode[i] === '{') {
            braceCount++;
            inFunction = true;
        } else if (serverCode[i] === '}') {
            braceCount--;
            if (inFunction && braceCount === 0) {
                endPos = i + 1;
                break;
            }
        }
    }
    
    // Nahraď funkciu bezpečnou verziou
    const safeTickPlayer = `const tickPlayer = (currentPlayer) => {
    try {
        // Spawn protection
        if (currentPlayer.spawnProtection && Date.now() - currentPlayer.spawnProtection < 3000) {
            return; // Skip processing for 3 seconds after spawn
        }
        
        if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
            if (sockets[currentPlayer.id]) {
                sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
                sockets[currentPlayer.id].disconnect();
            }
            return;
        }

        currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

        const isEntityInsideCircle = (point, circle) => {
            return SAT.pointInCircle(new Vector(point.x, point.y), circle);
        };

        const canEatMass = (cell, cellCircle, cellIndex, mass) => {
            if (isEntityInsideCircle(mass, cellCircle)) {
                if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num)
                    return false;
                if (cell.mass > mass.mass * 1.1)
                    return true;
            }
            return false;
        };

        const canEatVirus = (cell, cellCircle, virus) => {
            return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle);
        };

        const cellsToSplit = [];
        for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
            const currentCell = currentPlayer.cells[cellIndex];
            const cellCircle = currentCell.toCircle();

            const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
            const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
            const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

            if (eatenVirusIndexes.length > 0) {
                cellsToSplit.push(cellIndex);
                map.viruses.delete(eatenVirusIndexes);
            }

            let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);
            map.food.delete(eatenFoodIndexes);
            map.massFood.remove(eatenMassIndexes);
            massGained += (eatenFoodIndexes.length * config.foodMass);
            currentPlayer.changeCellMass(cellIndex, massGained);
        }
        currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
    } catch (e) {
        console.error('[TICK_PLAYER] Error:', e.message);
    }
}`;
    
    serverCode = serverCode.substring(0, tickPlayerStart) + safeTickPlayer + serverCode.substring(endPos);
}

// 2. Pridaj spawn protection pri vytvorení hráča
serverCode = serverCode.replace(
    'currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);',
    `currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
    currentPlayer.spawnProtection = Date.now();`
);

// 3. Pridaj spawn protection do collision detection
serverCode = serverCode.replace(
    'map.players.handleCollisions(function (gotEaten, eater) {',
    `map.players.handleCollisions(function (gotEaten, eater) {
        try {
            // Check spawn protection
            const eatenPlayer = map.players.data[gotEaten.playerIndex];
            const eaterPlayer = map.players.data[eater.playerIndex];
            
            if (!eatenPlayer || !eaterPlayer) return;
            if (eatenPlayer.spawnProtection && Date.now() - eatenPlayer.spawnProtection < 3000) return;
            if (eaterPlayer.spawnProtection && Date.now() - eaterPlayer.spawnProtection < 3000) return;
            `
);

// 4. Zatvor collision handler správne
const collisionEnd = serverCode.lastIndexOf('});', serverCode.indexOf('map.players.handleCollisions'));
if (collisionEnd > -1) {
    serverCode = serverCode.substring(0, collisionEnd) + `
        } catch (e) {
            console.error('[COLLISION] Error:', e);
        }
    });` + serverCode.substring(collisionEnd + 3);
}

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Server fixed with basic protections!');
