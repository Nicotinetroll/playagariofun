#!/bin/bash

echo "🎮 Adding 10-minute round game mode..."

# 1. UPDATE CONFIG WITH ROUND SETTINGS
echo "📝 Updating config with round settings..."
cat > config.js << 'EOF'
module.exports = {
    host: "0.0.0.0",
    port: 3000,
    logpath: "logger.php",
    foodMass: 1,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
    virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
    },
    gameWidth: 3000,
    gameHeight: 3000,
    adminPass: "kokot",
    gameMass: 15000,
    maxFood: 400,
    maxVirus: 20,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 30,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: false,
    newPlayerInitialPosition: "random",
    massLossRate: 1,
    minMassLoss: 50,
    maxPlayers: 30,
    // Round settings
    roundTime: 600000,  // 10 minutes in milliseconds
    roundEndWarning: 60000,  // 1 minute warning before round ends
    enableRounds: true,  // Enable/disable round system
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
EOF

# 2. UPDATE SERVER WITH ROUND LOGIC
echo "📝 Adding round logic to server..."
cat > src/server/server.js << 'EOF'
/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');

const gameLogic = require('./game-logic');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');
const {getPosition} = require("./lib/entityUtils");

let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;
let playerCount = 0;

// Round system variables
let roundStartTime = Date.now();
let roundNumber = 1;
let roundActive = true;
let roundWinner = null;
let roundStats = [];

// Food spawning optimization
let foodSpawnQueue = [];
let lastFoodSpawn = Date.now();
const FOOD_SPAWN_BATCH_SIZE = 10;
const FOOD_SPAWN_INTERVAL = 100;

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

// Check if round should end
function checkRoundEnd() {
    if (!config.enableRounds) return;
    
    const currentTime = Date.now();
    const roundElapsed = currentTime - roundStartTime;
    
    // Warning 1 minute before round end
    if (roundElapsed >= config.roundTime - config.roundEndWarning && 
        roundElapsed < config.roundTime - config.roundEndWarning + 1000 && roundActive) {
        io.emit('serverMSG', '⚠️ ROUND ENDS IN 1 MINUTE! ⚠️');
    }
    
    // End round
    if (roundElapsed >= config.roundTime && roundActive) {
        endRound();
    }
}

// End current round and declare winner
function endRound() {
    roundActive = false;
    
    // Get winner (player with highest mass)
    if (map.players.data.length > 0) {
        map.players.data.sort((a, b) => b.massTotal - a.massTotal);
        roundWinner = {
            name: map.players.data[0].name || 'Anonymous',
            mass: Math.round(map.players.data[0].massTotal),
            roundNumber: roundNumber
        };
        
        // Announce winner
        io.emit('roundEnd', {
            winner: roundWinner,
            roundNumber: roundNumber,
            leaderboard: leaderboard
        });
        
        io.emit('serverMSG', `🏆 ROUND ${roundNumber} WINNER: ${roundWinner.name} with ${roundWinner.mass} mass! 🏆`);
        io.emit('serverMSG', 'New round starting in 10 seconds...');
        
        // Store round stats
        roundStats.push(roundWinner);
    } else {
        io.emit('serverMSG', `Round ${roundNumber} ended with no players.`);
    }
    
    // Start new round after 10 seconds
    setTimeout(() => {
        startNewRound();
    }, 10000);
}

// Start a new round
function startNewRound() {
    roundNumber++;
    roundStartTime = Date.now();
    roundActive = true;
    roundWinner = null;
    
    // Reset all players
    for (let player of map.players.data) {
        if (sockets[player.id]) {
            sockets[player.id].emit('RIP');
        }
    }
    
    // Clear the map
    map = new mapUtils.Map(config);
    leaderboard = [];
    leaderboardChanged = true;
    
    // Announce new round
    io.emit('newRound', {
        roundNumber: roundNumber,
        roundTime: config.roundTime
    });
    
    io.emit('serverMSG', `🎮 ROUND ${roundNumber} STARTED! 10 minutes to become the champion! 🎮`);
    
    // Let all connected players respawn
    for (let socketId in sockets) {
        if (sockets[socketId]) {
            sockets[socketId].emit('canRespawn');
        }
    }
}

// Get remaining time in round
function getRemainingTime() {
    if (!config.enableRounds) return null;
    const elapsed = Date.now() - roundStartTime;
    const remaining = Math.max(0, config.roundTime - elapsed);
    return Math.floor(remaining / 1000); // Return seconds
}

io.on('connection', function (socket) {
    // Check player limit
    if (playerCount >= config.maxPlayers) {
        socket.emit('kick', 'Server is full (max ' + config.maxPlayers + ' players)');
        socket.disconnect();
        return;
    }
    
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    
    // Send round info to new player
    if (config.enableRounds) {
        socket.emit('roundInfo', {
            roundNumber: roundNumber,
            remainingTime: getRemainingTime(),
            roundActive: roundActive
        });
    }
    
    switch (type) {
        case 'player':
            playerCount++;
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return util.randomPosition(radius);
}

const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);

    socket.on('gotit', function (clientPlayerData) {
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        
        // Check if round is active
        if (!roundActive && config.enableRounds) {
            socket.emit('serverMSG', 'Round is ending. Please wait for the next round...');
            return;
        }
        
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
            sockets[socket.id] = socket;

            const sanitizedName = clientPlayerData.name.replace(/(<([^>]+)>)/ig, '');
            clientPlayerData.name = sanitizedName;

            currentPlayer.clientProvidedData(clientPlayerData);
            map.players.pushNew(currentPlayer);
            
            foodSpawnQueue.push(3);
            
            io.emit('playerJoin', { name: currentPlayer.name });
            console.log('Total players: ' + map.players.data.length);
        }
    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        // Check if round is active
        if (!roundActive && config.enableRounds) {
            socket.emit('serverMSG', 'Round is ending. Please wait for the next round...');
            return;
        }
        
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        playerCount--;
        map.players.removePlayerByID(currentPlayer.id);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: currentPlayer.name,
            message: _message.substring(0, 35)
        });

        if (config.logChat === 1) {
            chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log chat message", err));
        }
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with the incorrect password: ' + password);
            socket.emit('serverMSG', 'Password incorrect, attempt logged.');
            
            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('kick', (data) => {
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

        var reason = '';
        var worked = false;
        for (let playerIndex in map.players.data) {
            let player = map.players.data[playerIndex];
            if (player.name === data[0] && !player.admin && !worked) {
                if (data.length > 1) {
                    for (var f = 1; f < data.length; f++) {
                        if (f === data.length) {
                            reason = reason + data[f];
                        }
                        else {
                            reason = reason + data[f] + ' ';
                        }
                    }
                }
                if (reason !== '') {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                }
                else {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name);
                }
                socket.emit('serverMSG', 'User ' + player.name + ' was kicked by ' + currentPlayer.name);
                sockets[player.id].emit('kick', reason);
                sockets[player.id].disconnect();
                map.players.removePlayerByIndex(playerIndex);
                worked = true;
            }
        }
        if (!worked) {
            socket.emit('serverMSG', 'Could not locate user or user is an admin.');
        }
    });

    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
}

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
        io.emit('playerJoin', { name: '' });
        
        // Send round info to spectator
        if (config.enableRounds) {
            socket.emit('roundInfo', {
                roundNumber: roundNumber,
                remainingTime: getRemainingTime(),
                roundActive: roundActive
            });
        }
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (!roundActive) return;
    
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
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
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];
        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);

        if (eatenFoodIndexes.length > 0) {
            foodSpawnQueue.push(eatenFoodIndexes.length);
        }
        
        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
};

const processFoodSpawnQueue = () => {
    if (foodSpawnQueue.length === 0) return;
    
    let totalToSpawn = 0;
    let batchSize = Math.min(foodSpawnQueue.length, FOOD_SPAWN_BATCH_SIZE);
    
    for (let i = 0; i < batchSize; i++) {
        totalToSpawn += foodSpawnQueue.shift();
    }
    
    if (totalToSpawn > 0 && map.food.data.length < config.maxFood) {
        let toAdd = Math.min(totalToSpawn, config.maxFood - map.food.data.length);
        map.food.addNew(toAdd);
    }
};

const tickGame = () => {
    if (!roundActive) return;
    
    const CHUNK_SIZE = 10;
    let processed = 0;
    
    const processChunk = () => {
        const chunk = map.players.data.slice(processed, processed + CHUNK_SIZE);
        chunk.forEach(tickPlayer);
        processed += CHUNK_SIZE;
        
        if (processed < map.players.data.length) {
            setImmediate(processChunk);
        }
    };
    
    if (map.players.data.length > 0) {
        processChunk();
    }
    
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            let playerGotEaten = map.players.data[gotEaten.playerIndex];
            io.emit('playerDied', { name: playerGotEaten.name });
            sockets[playerGotEaten.id].emit('RIP');
            map.players.removePlayerByIndex(gotEaten.playerIndex);
        }
    });

    const now = Date.now();
    if (now - lastFoodSpawn >= FOOD_SPAWN_INTERVAL) {
        processFoodSpawnQueue();
        lastFoodSpawn = now;
    }
};

const calculateLeaderboard = () => {
    const topPlayers = map.players.getTopPlayers();

    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    } else {
        for (let i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].id !== topPlayers[i].id) {
                leaderboard = topPlayers;
                leaderboardChanged = true;
                break;
            }
        }
    }
}

const gameloop = () => {
    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }
    
    if (Date.now() % 5000 < 1000) {
        map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
    }
    
    // Check round end
    if (config.enableRounds) {
        checkRoundEnd();
    }
};

const sendUpdates = () => {
    spectators.forEach(updateSpectator);
    
    const CHUNK_SIZE = 10;
    let processed = 0;
    
    const sendChunk = () => {
        const endIndex = Math.min(processed + CHUNK_SIZE, map.players.data.length);
        
        for (let i = processed; i < endIndex; i++) {
            const currentPlayer = map.players.data[i];
            const socket = sockets[currentPlayer.id];
            
            if (!socket) continue;
            
            var visibleFood = map.food.data.filter(entity => 
                Math.abs(entity.x - currentPlayer.x) < currentPlayer.screenWidth &&
                Math.abs(entity.y - currentPlayer.y) < currentPlayer.screenHeight
            );
            var visibleViruses = map.viruses.data.filter(entity => 
                Math.abs(entity.x - currentPlayer.x) < currentPlayer.screenWidth &&
                Math.abs(entity.y - currentPlayer.y) < currentPlayer.screenHeight
            );
            var visibleMass = map.massFood.data.filter(entity => 
                Math.abs(entity.x - currentPlayer.x) < currentPlayer.screenWidth &&
                Math.abs(entity.y - currentPlayer.y) < currentPlayer.screenHeight
            );
            
            const extractData = (player) => {
                return {
                    x: player.x,
                    y: player.y,
                    cells: player.cells,
                    massTotal: Math.round(player.massTotal),
                    hue: player.hue,
                    id: player.id,
                    name: player.name
                };
            }
            
            var visiblePlayers = [];
            for (let player of map.players.data) {
                if (Math.abs(player.x - currentPlayer.x) < currentPlayer.screenWidth &&
                    Math.abs(player.y - currentPlayer.y) < currentPlayer.screenHeight) {
                    visiblePlayers.push(extractData(player));
                }
            }
            
            socket.emit('serverTellPlayerMove', extractData(currentPlayer), visiblePlayers, visibleFood, visibleMass, visibleViruses);
            
            if (leaderboardChanged) {
                sendLeaderboard(socket);
            }
            
            // Send round timer update
            if (config.enableRounds) {
                socket.emit('roundTimer', getRemainingTime());
            }
        }
        
        processed = endIndex;
        
        if (processed < map.players.data.length) {
            setImmediate(sendChunk);
        } else {
            leaderboardChanged = false;
        }
    };
    
    if (map.players.data.length > 0) {
        sendChunk();
    }
};

const sendLeaderboard = (socket) => {
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}

const updateSpectator = (socketID) => {
    let playerData = {
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        id: socketID,
        name: ''
    };
    sockets[socketID].emit('serverTellPlayerMove', playerData, map.players.data, map.food.data, map.massFood.data, map.viruses.data);
    if (leaderboardChanged) {
        sendLeaderboard(sockets[socketID]);
    }
    
    // Send round timer to spectator
    if (config.enableRounds) {
        sockets[socketID].emit('roundTimer', getRemainingTime());
    }
}

// Optimized intervals
setInterval(tickGame, 1000 / 60); // 60 FPS game logic
setInterval(gameloop, 1000); // 1 second game loop
setInterval(sendUpdates, 1000 / config.networkUpdateFactor); // Network updates

// Initialize first round if rounds are enabled
if (config.enableRounds) {
    console.log('[ROUNDS] Starting round system - 10 minute rounds');
    io.emit('serverMSG', `🎮 ROUND ${roundNumber} STARTED! 10 minutes to become the champion! 🎮`);
}

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
EOF

# 3. UPDATE CLIENT TO SHOW ROUND TIMER
echo "📝 Adding round timer to client..."
cat >> src/client/css/main.css << 'EOF'

/* Round Timer */
#roundTimer {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    padding: 15px 30px;
    border-radius: 20px;
    color: #2d3748;
    font-size: 18px;
    font-weight: 700;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

#roundTimer .round-number {
    color: #667eea;
    font-size: 14px;
    display: block;
    margin-bottom: 5px;
}

#roundTimer .time-remaining {
    font-size: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

#roundTimer.warning {
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.05); }
    100% { transform: translateX(-50%) scale(1); }
}

/* Winner Modal */
.winner-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.winner-modal.show {
    display: flex;
    animation: fadeIn 0.5s ease;
}

.winner-content {
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    padding: 40px;
    border-radius: 30px;
    text-align: center;
    max-width: 500px;
    animation: slideUp 0.5s ease;
}

.winner-content h2 {
    font-size: 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 20px;
}

.winner-content .winner-name {
    font-size: 28px;
    color: #2d3748;
    font-weight: bold;
    margin: 20px 0;
}

.winner-content .winner-mass {
    font-size: 20px;
    color: #667eea;
    margin-bottom: 20px;
}

.winner-content .next-round {
    font-size: 16px;
    color: #4a5568;
    margin-top: 20px;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { transform: translateY(50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
EOF

# 4. UPDATE HTML TO INCLUDE TIMER
echo "📝 Updating HTML with round timer..."
sed -i '/<div id="status">/i\        <div id="roundTimer">\n            <span class="round-number">ROUND 1</span>\n            <span class="time-remaining">10:00</span>\n        </div>' src/client/index.html

# Add winner modal to HTML
sed -i '/<div id="gameAreaWrapper">/a\    </div>\n    <div class="winner-modal" id="winnerModal">\n        <div class="winner-content">\n            <h2>🏆 ROUND WINNER 🏆</h2>\n            <div class="winner-name" id="winnerName">Player Name</div>\n            <div class="winner-mass" id="winnerMass">Mass: 0</div>\n            <div class="next-round">Next round starting in <span id="countdown">10</span> seconds...</div>\n        </div>' src/client/index.html

# 5. ADD CLIENT-SIDE ROUND HANDLING
echo "📝 Adding client-side round handling..."
cat >> src/client/js/app.js << 'EOF'

// Round system client handling
var roundNumber = 1;
var roundTimer = null;

// Handle round timer updates
socket.on('roundTimer', function(seconds) {
    var minutes = Math.floor(seconds / 60);
    var secs = seconds % 60;
    var timerElement = document.getElementById('roundTimer');
    if (timerElement) {
        timerElement.querySelector('.time-remaining').textContent = 
            minutes + ':' + (secs < 10 ? '0' : '') + secs;
        
        // Warning when less than 1 minute
        if (seconds <= 60) {
            timerElement.classList.add('warning');
        } else {
            timerElement.classList.remove('warning');
        }
    }
});

// Handle round info
socket.on('roundInfo', function(data) {
    roundNumber = data.roundNumber;
    var timerElement = document.getElementById('roundTimer');
    if (timerElement) {
        timerElement.querySelector('.round-number').textContent = 'ROUND ' + roundNumber;
    }
});

// Handle round end
socket.on('roundEnd', function(data) {
    var modal = document.getElementById('winnerModal');
    if (modal) {
        modal.classList.add('show');
        document.getElementById('winnerName').textContent = data.winner.name;
        document.getElementById('winnerMass').textContent = 'Mass: ' + data.winner.mass;
        
        var countdown = 10;
        var countdownInterval = setInterval(function() {
            countdown--;
            document.getElementById('countdown').textContent = countdown;
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                modal.classList.remove('show');
            }
        }, 1000);
    }
});

// Handle new round
socket.on('newRound', function(data) {
    roundNumber = data.roundNumber;
    var timerElement = document.getElementById('roundTimer');
    if (timerElement) {
        timerElement.querySelector('.round-number').textContent = 'ROUND ' + roundNumber;
    }
});

// Handle respawn permission after round
socket.on('canRespawn', function() {
    // Auto-respawn if player was in game
    if (global.playerName) {
        socket.emit('respawn');
    }
});
EOF

# 6. BUILD AND RESTART
echo "🔨 Building project..."
npm run build

echo "🔄 Restarting server..."
pm2 restart all

echo "✅ Round-based game mode added!"
echo ""
echo "🎮 Features:"
echo "  ✅ 10-minute rounds"
echo "  ✅ Winner announcement at round end"
echo "  ✅ Automatic new round start after 10 seconds"
echo "  ✅ Round timer display"
echo "  ✅ 1-minute warning before round ends"
echo "  ✅ Winner modal with stats"
echo "  ✅ All players reset between rounds"
echo ""
echo "⚙️ Configuration (in config.js):"
echo "  • roundTime: 600000 (10 minutes)"
echo "  • enableRounds: true/false"
echo "  • roundEndWarning: 60000 (1 minute)"
echo ""
echo "🌐 Server running at playagario.fun:3000"
