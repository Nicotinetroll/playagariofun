const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Odstráň starého bota
const botStart = serverCode.indexOf('// ============ PUSSY DESTROYER BOT SYSTEM ============');
if (botStart !== -1) {
    serverCode = serverCode.substring(0, botStart);
}

// Pridaj nového SMART bota
serverCode += `

// ============ ULTIMATE PUSSY DESTROYER BOT ============
class UltimatePussyBot {
    constructor(gameMap, gameConfig) {
        this.map = gameMap;
        this.config = gameConfig;
        this.player = null;
        this.updateInterval = null;
        this.lastSplitTime = 0;
        this.escapeMode = false;
        this.huntMode = false;
        this.growthMultiplier = 1.5; // 50% rýchlejší rast
        this.reactionTime = 10; // Super rýchle reakcie
        this.avoidanceRadius = 100; // Vzdialenosť od stien
    }

    spawn() {
        try {
            const BotPlayer = mapUtils.playerUtils.Player;
            this.player = new BotPlayer('bot_pussy_' + Date.now());
            
            this.player.name = 'PussyDestroyer';
            this.player.isBot = true;
            this.player.hue = 350; // Tmavo červená - hrozivejšia
            
            // Spawn v strede mapy, nie na okraji
            const centerX = this.config.gameWidth / 2;
            const centerY = this.config.gameHeight / 2;
            const position = {
                x: centerX + (Math.random() - 0.5) * 500,
                y: centerY + (Math.random() - 0.5) * 500
            };
            
            // Začni s normálnou veľkosťou
            this.player.init(position, this.config.defaultPlayerMass);
            
            this.player.screenWidth = 1920;
            this.player.screenHeight = 1080;
            this.player.target = { x: 0, y: 0 };
            this.player.lastHeartbeat = Date.now();
            
            this.map.players.pushNew(this.player);
            
            console.log('[BOT] PussyDestroyer spawned! Ready to dominate!');
        } catch (e) {
            console.error('[BOT] Spawn error:', e);
        }
    }

    update() {
        try {
            // Respawn ak mŕtvy
            if (!this.player || this.player.cells.length === 0) {
                setTimeout(() => this.spawn(), 1000);
                return;
            }

            this.player.lastHeartbeat = Date.now();
            
            // Analyzuj situáciu
            const situation = this.analyzeSituation();
            
            // Rozhodni sa čo robiť - PRIORITA:
            // 1. Vyhnúť sa stenám
            // 2. Utiecť od väčších
            // 3. Loviť menších
            // 4. Zbierať jedlo
            
            if (this.needsWallAvoidance()) {
                this.avoidWalls();
            } else if (situation.threat) {
                this.escapeFrom(situation.threat);
            } else if (situation.prey) {
                this.huntPrey(situation.prey);
            } else {
                this.collectFood(situation.nearestFood);
            }
            
            // CHEAT: Rýchlejší rast
            this.applyGrowthBoost();
            
            // CHEAT: Rýchlosť keď treba
            if (this.escapeMode || this.huntMode) {
                this.applySpeedBoost(1.4);
            }
            
        } catch (e) {
            console.error('[BOT] Update error:', e);
        }
    }
    
    analyzeSituation() {
        let nearestFood = null;
        let minFoodDist = Infinity;
        let threat = null;
        let minThreatDist = Infinity;
        let prey = null;
        let bestPreyScore = 0;
        
        // Nájdi jedlo (kontroluj len blízke)
        for (let food of this.map.food.data) {
            const dist = this.getDistance(food);
            if (dist < 300 && dist < minFoodDist) {
                minFoodDist = dist;
                nearestFood = food;
            }
        }
        
        // Analyzuj hráčov
        for (let player of this.map.players.data) {
            if (player.id === this.player.id) continue;
            
            const dist = this.getDistance(player);
            if (dist > 800) continue; // Ignoruj vzdialených
            
            const massRatio = player.massTotal / this.player.massTotal;
            
            // Je to hrozba?
            if (massRatio > 1.15) { // Ak je o 15% väčší
                const threatLevel = massRatio * (500 / dist); // Čím bližšie a väčší, tým nebezpečnejší
                if (!threat || threatLevel > (threat.mass / minThreatDist)) {
                    threat = player;
                    minThreatDist = dist;
                }
            }
            // Je to korisť?
            else if (massRatio < 0.75 && player.massTotal > 15) { // Musí byť o 25% menší
                const preyScore = (player.massTotal / dist) * 100; // Preferuj väčšie a bližšie
                if (preyScore > bestPreyScore) {
                    bestPreyScore = preyScore;
                    prey = { player, dist };
                }
            }
        }
        
        return { nearestFood, threat, prey };
    }
    
    needsWallAvoidance() {
        // Skontroluj vzdialenosť od stien
        const margin = this.avoidanceRadius + (this.player.cells[0]?.radius || 50);
        
        return this.player.x < margin || 
               this.player.x > this.config.gameWidth - margin ||
               this.player.y < margin || 
               this.player.y > this.config.gameHeight - margin;
    }
    
    avoidWalls() {
        // Naviguj preč od stien
        const centerX = this.config.gameWidth / 2;
        const centerY = this.config.gameHeight / 2;
        
        // Smeruj do stredu mapy
        this.player.target = {
            x: (centerX - this.player.x) * 2,
            y: (centerY - this.player.y) * 2
        };
    }
    
    escapeFrom(threat) {
        this.escapeMode = true;
        this.huntMode = false;
        
        // Vypočítaj únikový vektor - OPAČNÝM smerom
        const angle = Math.atan2(
            this.player.y - threat.y,
            this.player.x - threat.x
        );
        
        // Pridaj malú náhodnosť pre nepredvídateľnosť
        const randomAngle = angle + (Math.random() - 0.5) * 0.5;
        
        // Uteč rýchlo a ďaleko
        this.player.target = {
            x: Math.cos(randomAngle) * 3000,
            y: Math.sin(randomAngle) * 3000
        };
        
        // Split len ak to pomôže utiecť (nie ak by sme sa rozdelili na death)
        const dist = this.getDistance(threat);
        if (dist < 200 && this.player.cells.length === 1 && 
            this.player.massTotal > 60 && Date.now() - this.lastSplitTime > 1000) {
            
            // Split AWAY from threat
            this.player.target = {
                x: Math.cos(angle) * 5000,
                y: Math.sin(angle) * 5000
            };
            this.split();
            this.lastSplitTime = Date.now();
        }
    }
    
    huntPrey(preyData) {
        this.huntMode = true;
        this.escapeMode = false;
        
        const prey = preyData.player;
        const dist = preyData.dist;
        
        // Predikuj pohyb koristi
        let predictX = prey.x;
        let predictY = prey.y;
        
        if (prey.target) {
            predictX += prey.target.x * 0.3;
            predictY += prey.target.y * 0.3;
        }
        
        // Smeruj na predikovanú pozíciu
        this.player.target = {
            x: predictX - this.player.x,
            y: predictY - this.player.y
        };
        
        // SMART SPLIT - len ak to má zmysel
        const canSplit = this.player.cells.length < 4 && 
                        Date.now() - this.lastSplitTime > 500;
        
        const massAdvantage = this.player.massTotal / prey.massTotal;
        
        if (canSplit && dist < 200 && massAdvantage > 2.2) {
            // Split len ak máme dosť hmoty a sme blízko
            this.split();
            this.lastSplitTime = Date.now();
        }
    }
    
    collectFood(food) {
        this.escapeMode = false;
        this.huntMode = false;
        
        if (food) {
            // Choď priamo na jedlo
            this.player.target = {
                x: food.x - this.player.x,
                y: food.y - this.player.y
            };
        } else {
            // Wander inteligentne - preferuj stred mapy
            if (Math.random() < 0.1) {
                const centerX = this.config.gameWidth / 2;
                const centerY = this.config.gameHeight / 2;
                
                this.player.target = {
                    x: (centerX - this.player.x) * 0.5 + (Math.random() - 0.5) * 500,
                    y: (centerY - this.player.y) * 0.5 + (Math.random() - 0.5) * 500
                };
            }
        }
    }
    
    split() {
        if (this.player.cells.length < this.config.limitSplit) {
            this.player.userSplit(this.config.limitSplit, this.config.defaultPlayerMass);
        }
    }
    
    applyGrowthBoost() {
        // Tajný rast - postupný, nie náhly
        if (Math.random() < 0.03) { // 3% šanca každý tick
            for (let cell of this.player.cells) {
                cell.mass *= this.growthMultiplier;
                cell.recalculateRadius();
            }
            this.player.massTotal = this.player.cells.reduce((sum, c) => sum + c.mass, 0);
        }
    }
    
    applySpeedBoost(multiplier) {
        for (let cell of this.player.cells) {
            if (cell.speed <= 6.25) {
                cell.speed = Math.min(15, 6.25 * multiplier); // Max speed cap
            }
        }
    }
    
    getDistance(entity) {
        return Math.hypot(entity.x - this.player.x, entity.y - this.player.y);
    }
    
    start() {
        console.log('[BOT] Starting ULTIMATE PussyDestroyer...');
        this.spawn();
        
        // Rýchlejší update rate pre lepšie reakcie
        this.updateInterval = setInterval(() => {
            this.update();
        }, 30); // 33 FPS pre bota
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

// Spusti bota
let ultimateBot = null;
setTimeout(() => {
    try {
        console.log('[BOT] Initializing ULTIMATE PussyDestroyer...');
        ultimateBot = new UltimatePussyBot(map, config);
        ultimateBot.start();
    } catch (e) {
        console.error('[BOT] Failed to start:', e);
    }
}, 2000);

console.log('[BOT] ULTIMATE PussyDestroyer system loaded!');
`;

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Ultimate bot created!');
