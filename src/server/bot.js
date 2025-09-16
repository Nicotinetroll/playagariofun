const util = require('./lib/util');

class UnbeatableBot {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.player = null;
        this.targetFood = null;
        this.targetPlayer = null;
        this.escapeMode = false;
        this.lastActionTime = Date.now();
        this.skillLevel = 0.95; // 95% skill level - looks more legit
        this.reactionTime = 50; // ms - human-like reaction time
        this.speedBoost = 1.15; // 15% speed boost when needed
        this.massBoost = 1.25; // 25% more mass gain
        this.awareness = 800; // vision radius
        this.aggressiveness = 0.8; // how aggressive the bot is
    }

    spawn() {
        const mapUtils = require('./map/map');
        this.player = new mapUtils.playerUtils.Player('bot_' + Date.now());
        
        // Set bot properties
        this.player.name = 'PussyDestroyer';
        this.player.bot = true;
        this.player.hue = 0; // Red color for intimidation
        
        // Find good spawn position - away from other players
        let position = this.findSafeSpawnPoint();
        this.player.init(position, this.config.defaultPlayerMass * 2); // Start with 2x mass
        
        // Set fake client data
        this.player.screenWidth = 1920;
        this.player.screenHeight = 1080;
        this.player.target = { x: 0, y: 0 };
        
        // Add to game
        this.map.players.pushNew(this.player);
        
        console.log('[BOT] PussyDestroyer has spawned!');
    }

    findSafeSpawnPoint() {
        let bestPos = null;
        let maxDistance = 0;
        
        // Try 10 random positions and pick the safest
        for (let i = 0; i < 10; i++) {
            let pos = util.randomPosition(50);
            let minDist = Infinity;
            
            // Check distance to all players
            for (let player of this.map.players.data) {
                if (player.id !== this.player?.id) {
                    let dist = Math.hypot(player.x - pos.x, player.y - pos.y);
                    if (dist < minDist) minDist = dist;
                }
            }
            
            if (minDist > maxDistance) {
                maxDistance = minDist;
                bestPos = pos;
            }
        }
        
        return bestPos || util.randomPosition(50);
    }

    update() {
        if (!this.player || this.player.cells.length === 0) {
            // Respawn if dead
            if (!this.player || Date.now() - this.lastActionTime > 3000) {
                this.spawn();
                this.lastActionTime = Date.now();
            }
            return;
        }

        // Update heartbeat to prevent disconnect
        this.player.lastHeartbeat = Date.now();

        // Human-like reaction delay
        if (Date.now() - this.lastActionTime < this.reactionTime) return;

        // Analyze surroundings
        this.analyzeSituation();

        // Decide action based on situation
        if (this.escapeMode) {
            this.escape();
        } else if (this.targetPlayer && this.canEatPlayer(this.targetPlayer)) {
            this.huntPlayer();
        } else {
            this.collectFood();
        }

        // Random split/feed for more human-like behavior (rare)
        if (Math.random() < 0.002) {
            this.randomAction();
        }

        // Apply speed boost if chasing or escaping
        if (this.escapeMode || this.targetPlayer) {
            this.applySpeedBoost();
        }

        // Boost mass gain secretly
        this.secretMassBoost();

        this.lastActionTime = Date.now();
    }

    analyzeSituation() {
        this.escapeMode = false;
        this.targetPlayer = null;
        this.targetFood = null;

        let myTotalMass = this.player.massTotal;
        let threats = [];
        let targets = [];

        // Scan for players
        for (let player of this.map.players.data) {
            if (player.id === this.player.id) continue;
            
            let dist = Math.hypot(player.x - this.player.x, player.y - this.player.y);
            if (dist > this.awareness) continue;

            // Check if threat
            if (player.massTotal > myTotalMass * 1.3) {
                threats.push({ player, dist, mass: player.massTotal });
            }
            // Check if target
            else if (player.massTotal < myTotalMass * 0.7 && player.massTotal > 20) {
                targets.push({ player, dist, mass: player.massTotal });
            }
        }

        // Determine escape mode
        if (threats.length > 0) {
            threats.sort((a, b) => a.dist - b.dist);
            let closestThreat = threats[0];
            
            // Escape if threat is too close
            if (closestThreat.dist < 200 + closestThreat.player.cells[0].radius) {
                this.escapeMode = true;
                this.threatPlayer = closestThreat.player;
            }
        }

        // Select target to hunt
        if (!this.escapeMode && targets.length > 0) {
            targets.sort((a, b) => {
                // Prioritize by mass/distance ratio
                let scoreA = a.mass / (a.dist + 1);
                let scoreB = b.mass / (b.dist + 1);
                return scoreB - scoreA;
            });
            
            if (Math.random() < this.aggressiveness) {
                this.targetPlayer = targets[0].player;
            }
        }

        // Find nearest food if not hunting
        if (!this.escapeMode && !this.targetPlayer) {
            let nearestFood = null;
            let minDist = Infinity;
            
            for (let food of this.map.food.data) {
                let dist = Math.hypot(food.x - this.player.x, food.y - this.player.y);
                if (dist < minDist && dist < this.awareness / 2) {
                    minDist = dist;
                    nearestFood = food;
                }
            }
            
            this.targetFood = nearestFood;
        }
    }

    escape() {
        if (!this.threatPlayer) return;
        
        // Calculate escape vector (opposite direction with some randomness)
        let angle = Math.atan2(
            this.player.y - this.threatPlayer.y,
            this.player.x - this.threatPlayer.x
        );
        
        // Add slight random variation for realism
        angle += (Math.random() - 0.5) * 0.3;
        
        // Set target in escape direction
        this.player.target = {
            x: Math.cos(angle) * 1000,
            y: Math.sin(angle) * 1000
        };

        // Split to escape if necessary (smart split)
        if (this.player.cells.length < 8 && this.player.massTotal > 100) {
            let dangerDist = Math.hypot(
                this.threatPlayer.x - this.player.x,
                this.threatPlayer.y - this.player.y
            );
            
            if (dangerDist < 150 && Math.random() < 0.3) {
                // Split away from threat
                this.player.target = {
                    x: Math.cos(angle) * 2000,
                    y: Math.sin(angle) * 2000
                };
                this.split();
            }
        }
    }

    huntPlayer() {
        if (!this.targetPlayer) return;
        
        // Predict target movement (advanced AI)
        let predictX = this.targetPlayer.x + (this.targetPlayer.target?.x || 0) * 0.1;
        let predictY = this.targetPlayer.y + (this.targetPlayer.target?.y || 0) * 0.1;
        
        // Add slight prediction error for realism
        predictX += (Math.random() - 0.5) * 20;
        predictY += (Math.random() - 0.5) * 20;
        
        // Set target to predicted position
        this.player.target = {
            x: predictX - this.player.x,
            y: predictY - this.player.y
        };

        // Smart split to catch target
        let dist = Math.hypot(
            this.targetPlayer.x - this.player.x,
            this.targetPlayer.y - this.player.y
        );
        
        if (dist < 200 && this.player.cells.length < 4 && 
            this.player.massTotal > this.targetPlayer.massTotal * 2.5) {
            if (Math.random() < 0.4) { // Don't always split - looks more human
                this.split();
            }
        }
    }

    collectFood() {
        if (!this.targetFood) {
            // Wander randomly if no food nearby
            if (Math.random() < 0.1) {
                this.player.target = {
                    x: (Math.random() - 0.5) * 500,
                    y: (Math.random() - 0.5) * 500
                };
            }
            return;
        }
        
        // Move towards food with slight imprecision
        let errorX = (Math.random() - 0.5) * 10;
        let errorY = (Math.random() - 0.5) * 10;
        
        this.player.target = {
            x: this.targetFood.x - this.player.x + errorX,
            y: this.targetFood.y - this.player.y + errorY
        };
    }

    canEatPlayer(target) {
        if (!target) return false;
        
        // Check if we can eat any of target's cells
        for (let myCell of this.player.cells) {
            for (let targetCell of target.cells) {
                if (myCell.mass > targetCell.mass * 1.3) {
                    return true;
                }
            }
        }
        return false;
    }

    split() {
        if (this.player.cells.length < this.config.limitSplit) {
            this.player.userSplit(this.config.limitSplit, this.config.defaultPlayerMass);
        }
    }

    randomAction() {
        // Occasional random actions for human-like behavior
        let action = Math.random();
        
        if (action < 0.3 && this.player.cells.length < 4) {
            // Random split
            this.split();
        } else if (action < 0.5) {
            // Random direction change
            this.player.target = {
                x: (Math.random() - 0.5) * 1000,
                y: (Math.random() - 0.5) * 1000
            };
        }
        // Feed is too risky for the bot
    }

    applySpeedBoost() {
        // Secretly boost speed when needed
        for (let cell of this.player.cells) {
            if (cell.speed < 6.25) {
                cell.speed *= this.speedBoost;
            }
        }
    }

    secretMassBoost() {
        // Secretly gain more mass from food (hacky but subtle)
        if (Math.random() < 0.1) { // Only sometimes to avoid detection
            for (let cell of this.player.cells) {
                cell.mass *= 1.01; // 1% bonus mass
                cell.recalculateRadius();
            }
            this.player.massTotal = this.player.cells.reduce((acc, cell) => acc + cell.mass, 0);
        }
    }
}

module.exports = UnbeatableBot;
