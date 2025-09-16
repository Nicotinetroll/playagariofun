class SimpleBot {
    constructor(map, config, io, sockets) {
        this.map = map;
        this.config = config;
        this.io = io;
        this.sockets = sockets;
        this.botSocket = null;
        this.botPlayer = null;
    }
    
    start() {
        console.log('[BOT] Starting simple bot...');
        
        // Simuluj socket pripojenie
        this.botSocket = {
            id: 'bot_' + Date.now(),
            handshake: { query: { type: 'player' } },
            emit: () => {}, // Fake emit
            disconnect: () => {}
        };
        
        // Pridaj socket do zoznamu
        this.sockets[this.botSocket.id] = this.botSocket;
        
        // Vytvor hráča normálnym spôsobom ako pre skutočného hráča
        const util = require('./lib/util');
        const mapUtils = require('./map/map');
        const Player = mapUtils.playerUtils.Player;
        
        this.botPlayer = new Player(this.botSocket.id);
        this.botPlayer.name = 'PussyDestroyer';
        this.botPlayer.hue = 0; // Červená
        
        // Spawn pozícia
        const radius = util.massToRadius(this.config.defaultPlayerMass);
        const position = util.randomPosition(radius);
        
        // Inicializuj ako normálneho hráča
        this.botPlayer.init(position, this.config.defaultPlayerMass * 2);
        
        // Nastav fake client data
        this.botPlayer.screenWidth = 1920;
        this.botPlayer.screenHeight = 1080;
        this.botPlayer.target = { x: 0, y: 0 };
        
        // Pridaj do hry
        this.map.players.pushNew(this.botPlayer);
        
        // Oznám všetkým
        this.io.emit('playerJoin', { name: 'PussyDestroyer' });
        
        console.log('[BOT] PussyDestroyer joined the game!');
        
        // Spusti AI update loop
        this.startAI();
    }
    
    startAI() {
        setInterval(() => {
            try {
                if (!this.botPlayer || this.botPlayer.cells.length === 0) {
                    // Respawn
                    if (!this.respawnTimer) {
                        this.respawnTimer = setTimeout(() => {
                            this.respawn();
                            this.respawnTimer = null;
                        }, 3000);
                    }
                    return;
                }
                
                // Update heartbeat
                this.botPlayer.lastHeartbeat = Date.now();
                
                // Jednoduchá AI
                this.updateAI();
                
                // Bonus mass (cheat)
                if (Math.random() < 0.01) {
                    for (let cell of this.botPlayer.cells) {
                        cell.addMass(1);
                    }
                    this.botPlayer.massTotal += this.botPlayer.cells.length;
                }
                
            } catch (e) {
                console.error('[BOT] AI error:', e.message);
            }
        }, 100);
    }
    
    updateAI() {
        // Nájdi najbližšieho hráča
        let closestEnemy = null;
        let minDist = Infinity;
        
        for (let player of this.map.players.data) {
            if (player.id === this.botPlayer.id) continue;
            
            const dist = Math.hypot(player.x - this.botPlayer.x, player.y - this.botPlayer.y);
            if (dist < minDist) {
                minDist = dist;
                closestEnemy = player;
            }
        }
        
        if (closestEnemy) {
            if (closestEnemy.massTotal > this.botPlayer.massTotal * 1.3 && minDist < 300) {
                // Uteč
                const angle = Math.atan2(
                    this.botPlayer.y - closestEnemy.y,
                    this.botPlayer.x - closestEnemy.x
                );
                this.botPlayer.target = {
                    x: Math.cos(angle) * 1000,
                    y: Math.sin(angle) * 1000
                };
            } else if (closestEnemy.massTotal < this.botPlayer.massTotal * 0.7 && minDist < 400) {
                // Lov
                this.botPlayer.target = {
                    x: closestEnemy.x - this.botPlayer.x,
                    y: closestEnemy.y - this.botPlayer.y
                };
            } else {
                // Wander
                if (Math.random() < 0.05) {
                    this.botPlayer.target = {
                        x: (Math.random() - 0.5) * 500,
                        y: (Math.random() - 0.5) * 500
                    };
                }
            }
        }
    }
    
    respawn() {
        const util = require('./lib/util');
        const radius = util.massToRadius(this.config.defaultPlayerMass);
        const position = util.randomPosition(radius);
        
        this.botPlayer.init(position, this.config.defaultPlayerMass * 2);
        this.botPlayer.lastHeartbeat = Date.now();
        
        console.log('[BOT] PussyDestroyer respawned!');
    }
}

module.exports = SimpleBot;
