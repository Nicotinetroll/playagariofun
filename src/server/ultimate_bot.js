class UltimateBot {
    constructor(map, config, io, sockets) {
        this.map = map;
        this.config = config;
        this.io = io;
        this.sockets = sockets;
        this.botSocket = null;
        this.botPlayer = null;
        
        // AI parameters
        this.decisionInterval = 50; // Think every 50ms
        this.lastDecision = Date.now();
        this.currentStrategy = null;
        this.memory = {
            threats: [],
            prey: [],
            lastPositions: new Map()
        };
        
        // CHEAT parameters (hidden advantages)
        this.massGainMultiplier = 2.0; // 100% more mass from food!
        this.speedMultiplier = 1.5; // 50% faster
        this.visionRadius = 1000; // See further
        this.splitAccuracy = 0.95; // 95% split success
        this.dodgeChance = 0.9; // 90% dodge success
    }
    
    start() {
        console.log('[BOT] Initializing ULTIMATE PussyDestroyer...');
        
        // Create fake socket
        this.botSocket = {
            id: 'bot_ultimate_' + Date.now(),
            handshake: { query: { type: 'player' } },
            emit: () => {},
            disconnect: () => {}
        };
        
        this.sockets[this.botSocket.id] = this.botSocket;
        
        // Create player
        const util = require('./lib/util');
        const mapUtils = require('./map/map');
        const Player = mapUtils.playerUtils.Player;
        
        this.botPlayer = new Player(this.botSocket.id);
        this.botPlayer.name = 'PussyDestroyer';
        this.botPlayer.hue = 350; // Dark red - menacing
        this.botPlayer.isBot = true;
        
        // Smart spawn position
        const position = this.findBestSpawnPosition();
        
        // Initialize with advantage
        this.botPlayer.init(position, this.config.defaultPlayerMass);
        this.botPlayer.screenWidth = 1920;
        this.botPlayer.screenHeight = 1080;
        this.botPlayer.target = { x: 0, y: 0 };
        
        // Add to game
        this.map.players.pushNew(this.botPlayer);
        this.io.emit('playerJoin', { name: 'PussyDestroyer' });
        
        console.log('[BOT] PussyDestroyer is ONLINE and UNBEATABLE!');
        
        // Start AI loops
        this.startIntelligentAI();
        this.startCheatEngine();
    }
    
    findBestSpawnPosition() {
        const util = require('./lib/util');
        let bestPos = null;
        let maxSafety = 0;
        
        // Try 10 positions, pick safest
        for (let i = 0; i < 10; i++) {
            const pos = util.randomPosition(50);
            let safety = this.evaluatePositionSafety(pos);
            
            if (safety > maxSafety) {
                maxSafety = safety;
                bestPos = pos;
            }
        }
        
        return bestPos || { x: this.config.gameWidth / 2, y: this.config.gameHeight / 2 };
    }
    
    evaluatePositionSafety(pos) {
        let safety = 1000;
        
        for (let player of this.map.players.data) {
            const dist = Math.hypot(player.x - pos.x, player.y - pos.y);
            if (player.massTotal > 100) {
                safety -= (1000 / dist) * player.massTotal;
            }
        }
        
        // Prefer center areas
        const centerDist = Math.hypot(pos.x - this.config.gameWidth/2, pos.y - this.config.gameHeight/2);
        safety += (1000 - centerDist) * 0.5;
        
        return safety;
    }
    
    startIntelligentAI() {
        setInterval(() => {
            try {
                if (!this.botPlayer || this.botPlayer.cells.length === 0) {
                    this.respawn();
                    return;
                }
                
                // Keep alive
                this.botPlayer.lastHeartbeat = Date.now();
                
                // Think!
                this.think();
                
            } catch (e) {
                console.error('[BOT] AI error:', e.message);
            }
        }, this.decisionInterval);
    }
    
    think() {
        // Gather intelligence
        const situation = this.analyzeSituation();
        
        // Make strategic decision
        const strategy = this.decideStrategy(situation);
        
        // Execute strategy
        this.executeStrategy(strategy, situation);
        
        // Learn from experience
        this.updateMemory(situation);
    }
    
    analyzeSituation() {
        const threats = [];
        const prey = [];
        const food = [];
        const viruses = [];
        
        // Scan ALL players
        for (let player of this.map.players.data) {
            if (player.id === this.botPlayer.id) continue;
            
            const dist = Math.hypot(player.x - this.botPlayer.x, player.y - this.botPlayer.y);
            const massRatio = player.massTotal / this.botPlayer.massTotal;
            
            // Calculate velocity for prediction
            const lastPos = this.memory.lastPositions.get(player.id);
            let velocity = { x: 0, y: 0 };
            if (lastPos) {
                velocity = {
                    x: player.x - lastPos.x,
                    y: player.y - lastPos.y
                };
            }
            
            const playerInfo = {
                player,
                dist,
                massRatio,
                velocity,
                predictedPos: {
                    x: player.x + velocity.x * 5,
                    y: player.y + velocity.y * 5
                },
                dangerLevel: (massRatio * 1000) / dist,
                value: (player.massTotal / dist) * 100
            };
            
            if (massRatio > 1.25) {
                threats.push(playerInfo);
            } else if (massRatio < 0.75 && player.massTotal > 15) {
                prey.push(playerInfo);
            }
        }
        
        // Find nearby food (smart scanning)
        for (let f of this.map.food.data) {
            const dist = Math.hypot(f.x - this.botPlayer.x, f.y - this.botPlayer.y);
            if (dist < 300) {
                food.push({ food: f, dist });
            }
        }
        
        // Find viruses
        for (let v of this.map.viruses.data) {
            const dist = Math.hypot(v.x - this.botPlayer.x, v.y - this.botPlayer.y);
            if (dist < 400) {
                viruses.push({ virus: v, dist });
            }
        }
        
        return {
            threats: threats.sort((a, b) => b.dangerLevel - a.dangerLevel),
            prey: prey.sort((a, b) => b.value - a.value),
            food: food.sort((a, b) => a.dist - b.dist),
            viruses
        };
    }
    
    decideStrategy(situation) {
        // Priority-based strategy
        if (situation.threats.length > 0 && situation.threats[0].dist < 350) {
            return { type: 'ESCAPE', data: situation.threats[0] };
        }
        
        if (situation.prey.length > 0 && situation.prey[0].dist < 500) {
            return { type: 'HUNT', data: situation.prey[0] };
        }
        
        if (situation.food.length > 5) {
            return { type: 'FEAST', data: situation.food };
        }
        
        return { type: 'ROAM', data: null };
    }
    
    executeStrategy(strategy, situation) {
        switch (strategy.type) {
            case 'ESCAPE':
                this.executeEscape(strategy.data, situation.viruses);
                break;
            
            case 'HUNT':
                this.executeHunt(strategy.data);
                break;
            
            case 'FEAST':
                this.executeFeast(strategy.data);
                break;
            
            case 'ROAM':
                this.executeRoam();
                break;
        }
    }
    
    executeEscape(threat, viruses) {
        // Smart escape with virus consideration
        let escapeAngle = Math.atan2(
            this.botPlayer.y - threat.player.y,
            this.botPlayer.x - threat.player.x
        );
        
        // Check if virus is in escape path
        for (let v of viruses) {
            const virusAngle = Math.atan2(v.virus.y - this.botPlayer.y, v.virus.x - this.botPlayer.x);
            const angleDiff = Math.abs(virusAngle - escapeAngle);
            
            if (angleDiff < 0.5 && v.dist < 200) {
                // Adjust escape angle to avoid virus
                escapeAngle += 0.7;
            }
        }
        
        // Turbo escape
        this.botPlayer.target = {
            x: Math.cos(escapeAngle) * 3000,
            y: Math.sin(escapeAngle) * 3000
        };
        
        // Emergency split if needed
        if (threat.dist < 150 && this.botPlayer.cells.length === 1 && 
            this.botPlayer.massTotal > 50 && Math.random() < this.dodgeChance) {
            this.performSplit();
        }
    }
    
    executeHunt(prey) {
        // Predict where prey will be
        const predictedX = prey.predictedPos.x;
        const predictedY = prey.predictedPos.y;
        
        this.botPlayer.target = {
            x: predictedX - this.botPlayer.x,
            y: predictedY - this.botPlayer.y
        };
        
        // Smart split calculation
        const splitRange = Math.sqrt(this.botPlayer.massTotal) * 15;
        
        if (prey.dist < splitRange && this.botPlayer.cells.length < 8 && 
            this.botPlayer.massTotal > prey.player.massTotal * 2.2 &&
            Math.random() < this.splitAccuracy) {
            this.performSplit();
            console.log('[BOT] SPLIT ATTACK!');
        }
    }
    
    executeFeast(food) {
        // Find food cluster center
        let centerX = 0, centerY = 0;
        for (let f of food.slice(0, 5)) {
            centerX += f.food.x;
            centerY += f.food.y;
        }
        centerX /= Math.min(food.length, 5);
        centerY /= Math.min(food.length, 5);
        
        this.botPlayer.target = {
            x: centerX - this.botPlayer.x,
            y: centerY - this.botPlayer.y
        };
    }
    
    executeRoam() {
        // Smart wandering toward center
        const centerX = this.config.gameWidth / 2;
        const centerY = this.config.gameHeight / 2;
        
        const toCenterAngle = Math.atan2(centerY - this.botPlayer.y, centerX - this.botPlayer.x);
        const randomAngle = Math.random() * Math.PI * 2;
        
        // Blend center tendency with random
        const finalAngle = toCenterAngle * 0.6 + randomAngle * 0.4;
        
        this.botPlayer.target = {
            x: Math.cos(finalAngle) * 400,
            y: Math.sin(finalAngle) * 400
        };
    }
    
    performSplit() {
        if (this.botPlayer.userSplit) {
            this.botPlayer.userSplit(this.config.limitSplit, this.config.defaultPlayerMass);
        }
    }
    
    updateMemory(situation) {
        // Remember player positions for velocity calculation
        for (let player of this.map.players.data) {
            this.memory.lastPositions.set(player.id, {
                x: player.x,
                y: player.y
            });
        }
        
        // Clean old memories
        if (this.memory.lastPositions.size > 50) {
            this.memory.lastPositions.clear();
        }
    }
    
    startCheatEngine() {
        // Secret advantages that make bot unbeatable
        setInterval(() => {
            if (!this.botPlayer || this.botPlayer.cells.length === 0) return;
            
            // CHEAT 1: Gradual mass increase
            for (let cell of this.botPlayer.cells) {
                cell.mass *= 1.01; // 1% per tick
                if (cell.recalculateRadius) {
                    cell.recalculateRadius();
                }
            }
            this.botPlayer.massTotal *= 1.01;
            
            // CHEAT 2: Speed boost
            for (let cell of this.botPlayer.cells) {
                if (cell.speed && cell.speed < 10) {
                    cell.speed = Math.min(cell.speed * this.speedMultiplier, 10);
                }
            }
            
            // CHEAT 3: Regeneration when small
            if (this.botPlayer.massTotal < 50) {
                for (let cell of this.botPlayer.cells) {
                    cell.mass += 0.5;
                    if (cell.recalculateRadius) {
                        cell.recalculateRadius();
                    }
                }
                this.botPlayer.massTotal += this.botPlayer.cells.length * 0.5;
            }
            
        }, 200); // Every 200ms
    }
    
    respawn() {
        if (!this.respawnTimer) {
            this.respawnTimer = setTimeout(() => {
                const util = require('./lib/util');
                const position = this.findBestSpawnPosition();
                
                this.botPlayer.init(position, this.config.defaultPlayerMass);
                this.botPlayer.lastHeartbeat = Date.now();
                
                console.log('[BOT] PussyDestroyer RESPAWNED! The hunt continues...');
                this.respawnTimer = null;
            }, 2000);
        }
    }
}

module.exports = UltimateBot;
