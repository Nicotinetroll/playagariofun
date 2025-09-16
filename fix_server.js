const fs = require('fs');

// Načítaj server.js
let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Nájdi sendUpdates funkciu a uprav ju
serverCode = serverCode.replace(
    'const sendUpdates = () => {',
    `const sendUpdates = () => {
    // Skip bot players in spectator updates
    const realSpectators = spectators.filter(id => sockets[id]);`
);

serverCode = serverCode.replace(
    'spectators.forEach(updateSpectator);',
    'realSpectators.forEach(updateSpectator);'
);

// Uprav enumerateWhatPlayersSee aby preskočila botov
serverCode = serverCode.replace(
    'map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {',
    `map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        // Skip bot players - they don't need socket updates
        if (!sockets[playerData.id]) return;`
);

// Pridaj bota na koniec súboru
serverCode += `

// ============ PUSSY DESTROYER BOT SYSTEM ============
class PussyDestroyerBot {
    constructor(gameMap, gameConfig) {
        this.map = gameMap;
        this.config = gameConfig;
        this.player = null;
        this.updateInterval = null;
    }

    spawn() {
        try {
            // Vytvor bot hráča
            const BotPlayer = mapUtils.playerUtils.Player;
            this.player = new BotPlayer('bot_pussy_' + Date.now());
            
            this.player.name = 'PussyDestroyer';
            this.player.isBot = true; // Označíme že je to bot
            this.player.hue = 0; // Červená farba
            
            // Nájdi bezpečné miesto na spawn
            const position = util.randomPosition(50);
            this.player.init(position, this.config.defaultPlayerMass * 3); // 3x väčší štart
            
            // Fake screen data
            this.player.screenWidth = 1920;
            this.player.screenHeight = 1080;
            this.player.target = { x: 0, y: 0 };
            this.player.lastHeartbeat = Date.now();
            
            // Pridaj do hry
            this.map.players.pushNew(this.player);
            
            console.log('[BOT] PussyDestroyer spawned at', position);
        } catch (e) {
            console.error('[BOT] Spawn error:', e);
        }
    }

    update() {
        try {
            if (!this.player || this.player.cells.length === 0) {
                this.spawn();
                return;
            }

            // Update heartbeat
            this.player.lastHeartbeat = Date.now();
            
            // Nájdi najbližšie jedlo
            let closestFood = null;
            let minDist = Infinity;
            
            for (let food of this.map.food.data.slice(0, 100)) { // Kontroluj len prvých 100 pre performance
                const dist = Math.hypot(food.x - this.player.x, food.y - this.player.y);
                if (dist < minDist) {
                    minDist = dist;
                    closestFood = food;
                }
            }
            
            // Nájdi najbližšieho hráča
            let closestPlayer = null;
            let closestPlayerDist = Infinity;
            let biggerPlayer = null;
            let biggerPlayerDist = Infinity;
            
            for (let player of this.map.players.data) {
                if (player.id === this.player.id || player.isBot) continue;
                
                const dist = Math.hypot(player.x - this.player.x, player.y - this.player.y);
                
                if (player.massTotal < this.player.massTotal * 0.8 && dist < closestPlayerDist) {
                    closestPlayer = player;
                    closestPlayerDist = dist;
                }
                
                if (player.massTotal > this.player.massTotal * 1.2 && dist < biggerPlayerDist) {
                    biggerPlayer = player;
                    biggerPlayerDist = dist;
                }
            }
            
            // Rozhodni sa čo robiť
            if (biggerPlayer && biggerPlayerDist < 250) {
                // UTEČ!
                const angle = Math.atan2(
                    this.player.y - biggerPlayer.y,
                    this.player.x - biggerPlayer.x
                );
                this.player.target = {
                    x: Math.cos(angle) * 2000,
                    y: Math.sin(angle) * 2000
                };
                
                // Speed boost pri úteku
                this.boostSpeed(1.3);
                
            } else if (closestPlayer && closestPlayerDist < 400) {
                // LOV!
                this.player.target = {
                    x: closestPlayer.x - this.player.x,
                    y: closestPlayer.y - this.player.y
                };
                
                // Split ak sme blízko
                if (closestPlayerDist < 150 && this.player.cells.length < 4) {
                    this.player.userSplit(this.config.limitSplit, this.config.defaultPlayerMass);
                }
                
                // Speed boost pri love
                this.boostSpeed(1.2);
                
            } else if (closestFood && minDist < 600) {
                // Zjedz jedlo
                this.player.target = {
                    x: closestFood.x - this.player.x,
                    y: closestFood.y - this.player.y
                };
            } else {
                // Náhodný pohyb
                if (Math.random() < 0.05) {
                    this.player.target = {
                        x: (Math.random() - 0.5) * 1000,
                        y: (Math.random() - 0.5) * 1000
                    };
                }
            }
            
            // Občas pridaj hmotu (cheat)
            if (Math.random() < 0.02) {
                for (let cell of this.player.cells) {
                    cell.mass *= 1.02; // +2% hmoty
                    cell.recalculateRadius();
                }
                this.player.massTotal = this.player.cells.reduce((sum, c) => sum + c.mass, 0);
            }
            
        } catch (e) {
            console.error('[BOT] Update error:', e);
        }
    }
    
    boostSpeed(multiplier) {
        for (let cell of this.player.cells) {
            if (cell.speed <= 6.25) {
                cell.speed = 6.25 * multiplier;
            }
        }
    }
    
    start() {
        console.log('[BOT] Starting PussyDestroyer bot...');
        this.spawn();
        
        // Update každých 50ms
        this.updateInterval = setInterval(() => {
            this.update();
        }, 50);
    }
    
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.player) {
            const index = this.map.players.findIndexByID(this.player.id);
            if (index !== -1) {
                this.map.players.removePlayerByIndex(index);
            }
        }
    }
}

// Spusti bota po 3 sekundách
let botInstance = null;
setTimeout(() => {
    try {
        console.log('[BOT] Initializing PussyDestroyer...');
        botInstance = new PussyDestroyerBot(map, config);
        botInstance.start();
    } catch (e) {
        console.error('[BOT] Failed to start:', e);
    }
}, 3000);

console.log('[BOT] PussyDestroyer system ready!');
`;

// Ulož upravený kód
fs.writeFileSync('src/server/server.js', serverCode);
console.log('Server fixed!');
