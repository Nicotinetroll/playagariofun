const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Oprav tickPlayer funkciu
const newTickPlayer = `const tickPlayer = (currentPlayer) => {
    try {
        // Check heartbeat
        if (currentPlayer.lastHeartbeat < Date.now() - config.maxHeartbeatInterval) {
            if (sockets[currentPlayer.id]) {
                sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
                sockets[currentPlayer.id].disconnect();
            }
            return;
        }

        // Skip if no cells
        if (!currentPlayer.cells || currentPlayer.cells.length === 0) {
            return;
        }

        // Spawn protection
        if (currentPlayer.spawnTime && Date.now() - currentPlayer.spawnTime < 3000) {
            currentPlayer.invincible = true;
        } else {
            currentPlayer.invincible = false;
        }

        // Move player
        currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

        // Food collision detection
        for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
            const currentCell = currentPlayer.cells[cellIndex];
            if (!currentCell) continue;

            const cellCircle = currentCell.toCircle();

            // Check food
            const eatenFoodIndexes = [];
            for (let i = 0; i < map.food.data.length; i++) {
                const food = map.food.data[i];
                if (!food) continue;
                
                const foodVector = new SAT.Vector(food.x, food.y);
                if (SAT.pointInCircle(foodVector, cellCircle)) {
                    eatenFoodIndexes.push(i);
                }
            }

            // Check mass food
            const eatenMassIndexes = [];
            for (let i = 0; i < map.massFood.data.length; i++) {
                const mass = map.massFood.data[i];
                if (!mass) continue;
                
                // Skip own mass
                if (mass.id === currentPlayer.id && mass.speed > 0) continue;
                
                const massVector = new SAT.Vector(mass.x, mass.y);
                if (SAT.pointInCircle(massVector, cellCircle) && currentCell.mass > mass.mass * 1.1) {
                    eatenMassIndexes.push(i);
                }
            }

            // Check viruses (only if not invincible)
            const eatenVirusIndexes = [];
            if (!currentPlayer.invincible) {
                for (let i = 0; i < map.viruses.data.length; i++) {
                    const virus = map.viruses.data[i];
                    if (!virus) continue;
                    
                    const virusVector = new SAT.Vector(virus.x, virus.y);
                    if (virus.mass < currentCell.mass && SAT.pointInCircle(virusVector, cellCircle)) {
                        eatenVirusIndexes.push(i);
                    }
                }
            }

            // Apply changes
            if (eatenVirusIndexes.length > 0) {
                currentPlayer.virusSplit([cellIndex], config.limitSplit, config.defaultPlayerMass);
                map.viruses.delete(eatenVirusIndexes);
            }

            let massGained = 0;
            for (let idx of eatenMassIndexes) {
                massGained += map.massFood.data[idx].mass;
            }
            for (let idx of eatenFoodIndexes) {
                massGained += config.foodMass;
            }

            map.food.delete(eatenFoodIndexes);
            map.massFood.remove(eatenMassIndexes);
            
            if (massGained > 0) {
                currentPlayer.changeCellMass(cellIndex, massGained);
            }
        }
    } catch (e) {
        console.error('[TICK_PLAYER] Error:', e.message);
    }
};`;

// Nahraď starú funkciu
const tickStart = serverCode.indexOf('const tickPlayer = ');
if (tickStart > -1) {
    const tickEnd = serverCode.indexOf('\n};', tickStart) + 3;
    serverCode = serverCode.substring(0, tickStart) + newTickPlayer + serverCode.substring(tickEnd);
}

// Oprav collision handling
serverCode = serverCode.replace(
    'map.players.handleCollisions(function (gotEaten, eater) {',
    `map.players.handleCollisions(function (gotEaten, eater) {
        try {
            // Skip if invincible
            const eatenPlayer = map.players.data[gotEaten.playerIndex];
            const eaterPlayer = map.players.data[eater.playerIndex];
            
            if (!eatenPlayer || !eaterPlayer) return;
            if (eatenPlayer.invincible || eaterPlayer.invincible) return;`
);

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Game loop fixed!');
