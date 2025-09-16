class EnhancedPlayer {
    constructor(map, config, io, sockets) {
        this.m = map;
        this.c = config;
        this.i = io;
        this.s = sockets;
        this.sock = null;
        this.p = null;
        
        // Realistické výhody - NIŽŠIE!
        this.massBonus = 1.25; // 25% viac masy z jedla (nie zo vzduchu!)
        this.speedBonus = 1.05; // Len 5% rýchlejší!
        this.visionRange = 650; // Trochu lepší výhľad
        this.eatRatio = 0.9; // Môže žrať pri 90% veľkosti
        
        // Movement state
        this.lastMove = Date.now();
        this.movePattern = 0;
        
        // Stats
        this.k = 0;
        this.d = 0;
        this.foodEaten = 0;
    }
    
    init() {
        this.sock = {
            id: 'p_' + Date.now() + '_x',
            handshake: { query: { type: 'player' } },
            emit: () => {},
            disconnect: () => {}
        };
        
        this.s[this.sock.id] = this.sock;
        
        const util = require('./lib/util');
        const mapUtils = require('./map/map');
        const Player = mapUtils.playerUtils.Player;
        
        this.p = new Player(this.sock.id);
        this.p.name = 'PussyDestroyer';
        this.p.hue = 10 + Math.random() * 340; // Random color
        
        // Smart spawn
        let bestPos = { x: this.c.gameWidth/2, y: this.c.gameHeight/2 };
        let maxSpace = 0;
        
        for (let i = 0; i < 5; i++) {
            const pos = util.randomPosition(50);
            let minDist = 9999;
            
            for (let player of this.m.players.data) {
                if (player.massTotal > 50) {
                    const d = Math.hypot(player.x - pos.x, player.y - pos.y);
                    if (d < minDist) minDist = d;
                }
            }
            
            if (minDist > maxSpace) {
                maxSpace = minDist;
                bestPos = pos;
            }
        }
        
        this.p.init(bestPos, this.c.defaultPlayerMass);
        this.p.screenWidth = 1920;
        this.p.screenHeight = 1080;
        this.p.target = { x: 0, y: 0 };
        
        this.m.players.pushNew(this.p);
        this.i.emit('playerJoin', { name: 'PussyDestroyer' });
        
        this.run();
    }
    
    run() {
        // Main loop - 60fps ako normálny hráč
        setInterval(() => {
            try {
                if (!this.p || this.p.cells.length === 0) {
                    if (!this.rt) {
                        this.rt = setTimeout(() => {
                            this.respawn();
                            this.rt = null;
                        }, 3000 + Math.random() * 2000);
                    }
                    return;
                }
                
                this.p.lastHeartbeat = Date.now();
                
                // Pro decisions
                this.think();
                
                // Apply buffs only when eating
                this.applyBuffs();
                
            } catch (e) {}
        }, 16); // 60 FPS ako normálny pro hráč
    }
    
    think() {
        // Optimalizovaný scan
        let bestTarget = null;
        let nearestThreat = null;
        let nearestFood = [];
        let targetValue = 0;
        let threatDist = 999999;
        let scanCount = 0;
        
        // Scan players - max 20
        for (let player of this.m.players.data) {
            if (player.id === this.p.id) continue;
            if (scanCount++ > 20) break;
            
            const dist = Math.hypot(player.x - this.p.x, player.y - this.p.y);
            if (dist > this.visionRange) continue;
            
            const ratio = player.massTotal / this.p.massTotal;
            
            // Can eat at 90% ratio
            if (ratio < 1/this.eatRatio && ratio > 0.1) {
                const value = player.massTotal / (dist + 50);
                if (value > targetValue) {
                    targetValue = value;
                    bestTarget = { player, dist, ratio };
                }
            }
            
            // Threat
            if (ratio > 1.15 && dist < threatDist) {
                threatDist = dist;
                nearestThreat = { player, dist, ratio };
            }
        }
        
        // Food scan
        let foodCount = 0;
        for (let food of this.m.food.data) {
            if (foodCount++ > 30) break;
            const dist = Math.hypot(food.x - this.p.x, food.y - this.p.y);
            if (dist < 300) {
                nearestFood.push({ food, dist });
            }
        }
        nearestFood.sort((a, b) => a.dist - b.dist);
        
        // DECISIONS - vždy sa hýb!
        if (nearestThreat && threatDist < 280) {
            this.escapeAndFarm(nearestThreat, nearestFood);
        } else if (bestTarget && bestTarget.dist < 450) {
            this.huntSmart(bestTarget);
        } else {
            // VŽDY FARMUJ - nikdy nestoj!
            this.alwaysFarm(nearestFood);
        }
    }
    }
    
    predict(player) {
        // Simple prediction
        if (!player._lastPos) {
            player._lastPos = { x: player.x, y: player.y };
            return player;
        }
        
        const vx = player.x - player._lastPos.x;
        const vy = player.y - player._lastPos.y;
        
        player._lastPos = { x: player.x, y: player.y };
        
        return {
            x: player.x + vx * 3,
            y: player.y + vy * 3
        };
    }
    
    escapeAndFarm(threat, nearbyFood) {
        // Uteč ale inteligentne - zbieraj jedlo počas úteku
        const escapeAngle = Math.atan2(
            this.p.y - threat.player.y,
            this.p.x - threat.player.x
        );
        
        // Ak je jedlo v smere úteku, choď zaň
        if (nearbyFood.length > 0) {
            for (let f of nearbyFood) {
                const foodAngle = Math.atan2(
                    f.food.y - this.p.y,
                    f.food.x - this.p.x
                );
                const angleDiff = Math.abs(foodAngle - escapeAngle);
                
                // Jedlo je v smere úteku
                if (angleDiff < Math.PI/4 && f.dist < 150) {
                    this.p.target = {
                        x: f.food.x - this.p.x,
                        y: f.food.y - this.p.y
                    };
                    return;
                }
            }
        }
        
        // Inak uteč normálne
        this.p.target = {
            x: Math.cos(escapeAngle) * 1000,
            y: Math.sin(escapeAngle) * 1000
        };
        
        // Emergency split
        if (threat.dist < 130 && this.p.cells.length === 1 && this.p.massTotal > 45) {
            this.doSplit();
        }
    }
    
    huntSmart(target) {
        // Predikcia pohybu
        const pred = this.predict(target.player);
        
        // Choď kam pôjde, nie kde je
        this.p.target = {
            x: pred.x - this.p.x,
            y: pred.y - this.p.y
        };
        
        // Split len ak máš veľkú výhodu alebo je blízko
        const canCatch = this.p.massTotal > target.player.massTotal * 2.5;
        const inRange = target.dist < Math.sqrt(this.p.massTotal) * 12;
        
        if (canCatch && inRange && this.p.cells.length < 4) {
            this.doSplit();
        }
    }
    
    alwaysFarm(nearestFood) {
        // NIKDY NESTOJ - vždy sa pohybuj a farmuj
        
        if (nearestFood.length > 0) {
            // Choď za najbližším jedlom
            this.p.target = {
                x: nearestFood[0].food.x - this.p.x,
                y: nearestFood[0].food.y - this.p.y
            };
        } else {
            // Žiadne jedlo blízko - pohybuj sa v pattern
            this.movePattern = (this.movePattern + 1) % 8;
            
            // Rôzne movement patterns
            let angle = (this.movePattern * Math.PI / 4) + (Math.random() - 0.5) * 0.5;
            
            // Preferuj stred mapy
            const centerX = this.c.gameWidth / 2;
            const centerY = this.c.gameHeight / 2;
            const distToCenter = Math.hypot(centerX - this.p.x, centerY - this.p.y);
            
            if (distToCenter > 800) {
                // Príliš ďaleko od stredu - vráť sa
                angle = Math.atan2(centerY - this.p.y, centerX - this.p.x);
            }
            
            // Pohyb s variáciou
            const distance = 300 + Math.random() * 200;
            this.p.target = {
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            };
        }
        
        // Pridaj ľudské mikro-pohyby
        if (Math.random() < 0.2) {
            this.p.target.x += (Math.random() - 0.5) * 40;
            this.p.target.y += (Math.random() - 0.5) * 40;
        }
    }
    
    applyBuffs() {
        // Aplikuj bonusy LEN keď žerie jedlo alebo hráčov
        
        // Speed bonus - jemný, len 5%
        for (let cell of this.p.cells) {
            if (cell.speed && cell.speed < 6.5) {
                cell.speed = Math.min(cell.speed * this.speedBonus, 6.5);
            }
        }
        
        // Mass bonus sa aplikuje pri skutočnom jedení cez server
        // Tu len trackujeme koľko sme zjedli
        if (this.p.massTotal > this.lastMass) {
            this.foodEaten++;
            // Bonus mass sa pridá v collision detection
        }
        this.lastMass = this.p.massTotal || 10;
    }
    
    enhance() {
        // Odstránené - už nepoužívame
    }
    
    doSplit() {
        if (this.p.userSplit) {
            this.p.userSplit(this.c.limitSplit, this.c.defaultPlayerMass);
        }
    }
    
    respawn() {
        const util = require('./lib/util');
        const pos = util.randomPosition(50);
        
        this.p.init(pos, this.c.defaultPlayerMass);
        this.p.lastHeartbeat = Date.now();
        
        this.d++;
        console.log('[GAME] Player respawned. K/D:', this.k, '/', this.d);
    }
}

module.exports = EnhancedPlayer;
