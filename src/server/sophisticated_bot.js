const SAT = require('sat');
const util = require('./lib/util');

class PussyDestroyerBot {
    constructor(map, config, io, PlayerClass) {
        this.map = map;
        this.config = config;
        this.io = io;
        this.PlayerClass = PlayerClass;
        this.player = null;
        this.updateTimer = null;
        this.respawnTimer = null;
    }
    
    spawn() {
        try {
            // Vytvor správneho hráča cez Player class
            this.player = new this.PlayerClass('bot_pussy_' + Date.now());
            
            // Nastav meno a vlastnosti
            this.player.name = 'PussyDestroyer';
            this.player.isBot = true;
            this.player.hue = 0; // Červená
            
            // Nájdi bezpečnú spawn pozíciu
            const pos = {
                x: Math.random() * (this.config.gameWidth - 200) + 100,
                y: Math.random() * (this.config.gameHeight - 200) + 100
            };
            
            // Použi oficiálnu init metódu
            this.player.init(pos, this.config.defaultPlayerMass * 2);
            
            // Nastav screen parametre
            this.player.screenWidth = 1920;
            this.player.screenHeight = 1080;
            this.player.target = { x: 0, y: 0 };
            this.player.lastHeartbeat = Date.now();
            
            // Pridaj do hry
            this.map.players.pushNew(this.player);
            
            console.log('[BOT] PussyDestroyer spawned successfully!');
            
            // Oznám pripojenie
            if (this.io) {
                this.io.emit('playerJoin', { name: 'PussyDestroyer' });
            }
        } catch (e) {
            console.error('[BOT] Spawn failed:', e);
        }
    }
    
    update() {
        try {
            // Skontroluj či žije
            if (!this.player || !this.player.cells || this.player.cells.length === 0) {
                if (!this.respawnTimer) {
                    console.log('[BOT] Bot died, respawning...');
                    this.respawnTimer = setTimeout(() => {
                        this.spawn();
                        this.respawnTimer = null;
                    }, 3000);
                }
                return;
            }
            
            // Update heartbeat
            this.player.lastHeartbeat = Date.now();
            
            // AI rozhodovanie
            let closestThreat = null;
            let closestTarget = null;
            let threatDist = Infinity;
            let targetDist = Infinity;
            
            // Analyzuj hráčov
            for (let player of this.map.players.data) {
                if (player.id === this.player.id) continue;
                
                const dist = Math.hypot(player.x - this.player.x, player.y - this.player.y);
                
                // Hrozba - väčší hráč
                if (player.massTotal > this.player.massTotal * 1.3 && dist < 400) {
                    if (dist < threatDist) {
                        closestThreat = player;
                        threatDist = dist;
                    }
                }
                
                // Cieľ - menší hráč
                if (player.massTotal < this.player.massTotal * 0.7 && dist < 500) {
                    if (dist < targetDist) {
                        closestTarget = player;
                        targetDist = dist;
                    }
                }
            }
            
            // Rozhodni sa čo robiť
            if (closestThreat && threatDist < 250) {
                // UTEČ!
                const angle = Math.atan2(
                    this.player.y - closestThreat.y,
                    this.player.x - closestThreat.x
                );
                
                this.player.target = {
                    x: Math.cos(angle) * 2000,
                    y: Math.sin(angle) * 2000
                };
                
                // Split ak treba utiecť
                if (threatDist < 150 && this.player.cells.length === 1 && this.player.massTotal > 35) {
                    this.split();
                }
                
            } else if (closestTarget && targetDist < 400) {
                // LOV!
                this.player.target = {
                    x: closestTarget.x - this.player.x,
                    y: closestTarget.y - this.player.y
                };
                
                // Split ak si blízko
                if (targetDist < 200 && this.player.cells.length < 4 && 
                    this.player.massTotal > closestTarget.massTotal * 2.5) {
                    this.split();
                }
                
            } else {
                // Wander a zbieraj jedlo
                if (Math.random() < 0.05) {
                    this.player.target = {
                        x: (Math.random() - 0.5) * 500,
                        y: (Math.random() - 0.5) * 500
                    };
                }
            }
            
            // Tajný mass boost
            if (Math.random() < 0.02) {
                for (let cell of this.player.cells) {
                    if (cell.mass) {
                        cell.mass *= 1.015; // 1.5% boost
                        if (cell.recalculateRadius) {
                            cell.recalculateRadius();
                        }
                    }
                }
                this.player.massTotal = this.player.cells.reduce((sum, cell) => sum + cell.mass, 0);
            }
            
        } catch (e) {
            console.error('[BOT] Update error:', e);
        }
    }
    
    split() {
        try {
            if (this.player.userSplit) {
                this.player.userSplit(this.config.limitSplit, this.config.defaultPlayerMass);
                console.log('[BOT] Split performed');
            }
        } catch (e) {
            console.error('[BOT] Split error:', e);
        }
    }
    
    start() {
        console.log('[BOT] Starting PussyDestroyer bot...');
        this.spawn();
        
        // Update loop
        this.updateTimer = setInterval(() => {
            this.update();
        }, 100);
    }
    
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        if (this.respawnTimer) {
            clearTimeout(this.respawnTimer);
        }
        console.log('[BOT] Bot stopped');
    }
}

module.exports = PussyDestroyerBot;
