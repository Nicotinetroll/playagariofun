#!/bin/bash

echo "🎮 Creating instant play with automatic round start at 5 players..."

# Update config with two map sizes
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
    // Map sizes
    gameWidth: 3000,      // Normal competitive size
    gameHeight: 3000,
    practiceWidth: 6000,  // Practice mode - double size
    practiceHeight: 6000,
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
    roundTime: 600000,  // 10 minutes
    roundEndWarning: 60000,
    roundBreakTime: 60000,
    minPlayersToStart: 5,
    enableRounds: true,
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
EOF

# Create new server with practice mode
cat > src/server/server.js << 'EOF'
/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');

const gameLogic = require('./game-logic');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');

let map = new mapUtils.Map(config);
let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

// Game state
let gameMode = 'practice'; // 'practice' or 'competitive'
let roundNumber = 0;
let roundStartTime = null;
let breakEndTime = null;
let connectedPlayers = 0;

// Set initial practice mode size
config.gameWidth = config.practiceWidth;
config.gameHeight = config.practiceHeight;

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

function getGameStatus() {
    const now = Date.now();
    
    if (gameMode === 'practice') {
        return {
            state: 'practice',
            playersConnected: connectedPlayers,
            playersNeeded: config.minPlayersToStart,
            message: `Practice Mode - ${connectedPlayers}/${config.minPlayersToStart} for competitive round`
        };
    } else if (gameMode === 'competitive') {
        const elapsed = now - roundStartTime;
        const remaining = Math.max(0, config.roundTime - elapsed);
        return {
            state: 'competitive',
            roundNumber: roundNumber,
            timeRemaining: Math.floor(remaining / 1000),
            playersConnected: connectedPlayers
        };
    } else if (gameMode === 'break') {
        const remaining = Math.max(0, breakEndTime - now);
        return {
            state: 'break',
            timeRemaining: Math.floor(remaining / 1000)
        };
    }
}

function checkGameState() {
    if (!config.enableRounds) return;
    
    const now = Date.now();
    
    if (gameMode === 'practice') {
        // Check if we have enough players to start competitive
        if (connectedPlayers >= config.minPlayersToStart) {
            startCompetitiveRound();
        }
    } else if (gameMode === 'competitive') {
        const elapsed = now - roundStartTime;
        
        // Warning at 1 minute
        if (elapsed >= config.roundTime - 60000 && 
            elapsed < config.roundTime - 59000) {
            io.emit('serverMSG', '⚠️ 1 MINUTE LEFT IN ROUND! ⚠️');
        }
        
        // End round
        if (elapsed >= config.roundTime) {
            endRound();
        }
    } else if (gameMode === 'break') {
        if (now >= breakEndTime) {
            if (connectedPlayers >= config.minPlayersToStart) {
                startCompetitiveRound();
            } else {
                // Back to practice mode
                gameMode = 'practice';
                config.gameWidth = config.practiceWidth;
                config.gameHeight = config.practiceHeight;
                io.emit('serverMSG', '📢 Back to practice mode. Need more players for competitive round.');
                
                // Let everyone respawn in practice mode
                for (let socketId in sockets) {
                    sockets[socketId].emit('canRespawn');
                }
            }
        }
    }
}

function startCompetitiveRound() {
    console.log('[ROUND] Starting competitive round ' + (roundNumber + 1));
    
    // Store current players
    let currentPlayerNames = [];
    for (let player of map.players.data) {
        if (player.name) {
            currentPlayerNames.push(player.name);
        }
    }
    
    gameMode = 'competitive';
    roundNumber++;
    roundStartTime = Date.now();
    
    // Shrink map to competitive size
    config.gameWidth = 3000;
    config.gameHeight = 3000;
    
    // Clear and reset everything
    map = new mapUtils.Map(config);
    leaderboard = [];
    leaderboardChanged = true;
    
    io.emit('serverMSG', '🎮 COMPETITIVE ROUND ' + roundNumber + ' STARTING!');
    io.emit('serverMSG', '📏 Map size reduced by 50%!');
    io.emit('serverMSG', '🔄 All scores reset! 10 minutes to win!');
    
    io.emit('newRound', { 
        roundNumber: roundNumber,
        mapWidth: config.gameWidth,
        mapHeight: config.gameHeight
    });
    
    // Force all players to respawn with reset stats
    for (let socketId in sockets) {
        if (sockets[socketId]) {
            // Kick them first to reset
            sockets[socketId].emit('RIP');
            // Then allow respawn
            setTimeout(() => {
                if (sockets[socketId]) {
                    sockets[socketId].emit('canRespawn');
                }
            }, 1000);
        }
    }
}

function endRound() {
    console.log('[ROUND] Ending round ' + roundNumber);
    gameMode = 'break';
    breakEndTime = Date.now() + 60000; // 1 minute break
    
    // Find winner
    if (map.players.data.length > 0) {
        map.players.data.sort((a, b) => b.massTotal - a.massTotal);
        const winner = map.players.data[0];
        
        io.emit('roundEnd', {
            winner: {
                name: winner.name || 'Anonymous',
                mass: Math.round(winner.massTotal)
            },
            roundNumber: roundNumber
        });
        
        io.emit('serverMSG', '🏆 ROUND ' + roundNumber + ' WINNER: ' + winner.name + ' with ' + Math.round(winner.massTotal) + ' mass!');
    }
    
    io.emit('serverMSG', '⏸️ 1 minute break - then back to practice or new round');
    
    // Kick everyone
    for (let player of map.players.data) {
        if (sockets[player.id]) {
            sockets[player.id].emit('RIP');
        }
    }
}

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    
    // Send current game status
    socket.emit('gameStatus', getGameStatus());
    
    // Send appropriate message based on mode
    if (gameMode === 'practice') {
        socket.emit('serverMSG', '🎯 Practice Mode - Play freely! Need ' + (config.minPlayersToStart - connectedPlayers) + ' more players for competitive round.');
        socket.emit('serverMSG', '📏 Current map size: 6000x6000 (will shrink to 3000x3000 in competitive)');
    }
    
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return util.randomPosition(radius);
}

const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);
    var playerName = null;
    var hasSpawned = false;

    socket.on('gotit', function (player) {
        console.log('[INFO] Player ' + player.name + ' connecting!');
        
        if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
            return;
        }
        
        playerName = player.name.replace(/(<([^>]+)>)/ig, '');
        currentPlayer.name = playerName;
        currentPlayer.screenWidth = player.screenWidth;
        currentPlayer.screenHeight = player.screenHeight;
        currentPlayer.target = {x: 0, y: 0};
        
        // Always allow spawn (practice or competitive)
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
        
        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID already connected, kicking.');
            socket.disconnect();
            return;
        }
        
        console.log('[INFO] Player ' + playerName + ' spawned!');
        sockets[socket.id] = socket;
        hasSpawned = true;
        
        map.players.pushNew(currentPlayer);
        map.food.addNew(3);
        
        connectedPlayers++;
        io.emit('playerJoin', { name: playerName });
        
        // Update everyone about player count
        io.emit('gameStatus', getGameStatus());
        
        // Check if we should start competitive
        if (gameMode === 'practice' && connectedPlayers >= config.minPlayersToStart) {
            io.emit('serverMSG', '🎉 5 players reached! Competitive round starting in 5 seconds...');
            setTimeout(() => {
                if (connectedPlayers >= config.minPlayersToStart) {
                    startCompetitiveRound();
                }
            }, 5000);
        }
    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        if (currentPlayer) {
            currentPlayer.screenWidth = data.screenWidth;
            currentPlayer.screenHeight = data.screenHeight;
        }
    });

    socket.on('respawn', () => {
        if (gameMode === 'break') {
            socket.emit('serverMSG', 'Cannot respawn during break');
            return;
        }
        
        if (currentPlayer && currentPlayer.id) {
            map.players.removePlayerByID(currentPlayer.id);
        }
        
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
        
        if (!hasSpawned) {
            map.players.pushNew(currentPlayer);
            hasSpawned = true;
        }
        
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User respawned');
    });

    socket.on('disconnect', () => {
        connectedPlayers = Math.max(0, connectedPlayers - 1);
        
        if (currentPlayer && currentPlayer.id) {
            map.players.removePlayerByID(currentPlayer.id);
        }
        
        if (playerName) {
            console.log('[INFO] User ' + playerName + ' disconnected');
            socket.broadcast.emit('playerDisconnect', { name: playerName });
        }
        
        // Update game status
        io.emit('gameStatus', getGameStatus());
        
        // Check if competitive should end early
        if (gameMode === 'competitive' && connectedPlayers < 2) {
            io.emit('serverMSG', '⚠️ Not enough players, ending round early');
            endRound();
        }
    });

    socket.on('playerChat', (data) => {
        if (!currentPlayer || !playerName) return;
        
        var _sender = (data.sender || '').toString().replace(/(<([^>]+)>)/ig, '');
        var _message = (data.message || '').toString().replace(/(<([^>]+)>)/ig, '');

        console.log('[CHAT] ' + _sender + ': ' + _message);

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: playerName,
            message: _message.substring(0, 35)
        });
    });

    socket.on('0', (target) => {
        if (!currentPlayer) return;
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target && target.x !== undefined && target.y !== undefined) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        if (!currentPlayer || !currentPlayer.cells) return;
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i] && currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        if (!currentPlayer) return;
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
    
    socket.on('canRespawn', () => {
        if (playerName) {
            currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
            if (!hasSpawned) {
                map.players.pushNew(currentPlayer);
                hasSpawned = true;
            }
            socket.emit('welcome', currentPlayer, {
                width: config.gameWidth,
                height: config.gameHeight
            });
        }
    });
}

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (!currentPlayer) return;
    
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        if (sockets[currentPlayer.id]) {
            sockets[currentPlayer.id].emit('kick', 'Last heartbeat timeout.');
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
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];
        if (!currentCell) continue;
        
        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        
        if (eatenFoodIndexes.length > 0) {
            map.food.addNew(eatenFoodIndexes.length);
        }
        
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    
    if (cellsToSplit.length > 0) {
        currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
    }
};

const tickGame = () => {
    map.players.data.forEach(tickPlayer);
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (!cellGotEaten) return;

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, cellGotEaten.mass);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            let playerGotEaten = map.players.data[gotEaten.playerIndex];
            if (playerGotEaten) {
                io.emit('playerDied', { name: playerGotEaten.name });
                if (sockets[playerGotEaten.id]) {
                    sockets[playerGotEaten.id].emit('RIP');
                }
                map.players.removePlayerByIndex(gotEaten.playerIndex);
            }
        }
    });
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
    
    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
    
    // Check game state
    checkGameState();
};

const sendUpdates = () => {
    // Always send game status
    io.emit('gameStatus', getGameStatus());
    
    spectators.forEach(updateSpectator);
    
    if (map.enumerateWhatPlayersSee) {
        map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
            if (sockets[playerData.id]) {
                sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
                if (leaderboardChanged) {
                    sendLeaderboard(sockets[playerData.id]);
                }
            }
        });
    }
    
    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
    if (!socket) return;
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}

const updateSpectator = (socketID) => {
    if (!sockets[socketID]) return;
    
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
}

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / 3);

console.log('[GAME] Starting in PRACTICE MODE - 6000x6000 map');
console.log('[GAME] Need ' + config.minPlayersToStart + ' players for competitive round (3000x3000 map)');

var ipaddress = config.host;
var serverport = config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
EOF

echo "🔨 Building..."
npm run build

echo "🔄 Restarting..."
pm2 restart all

echo "✅ Instant play with automatic competitive rounds ready!"
echo ""
echo "🎮 How it works now:"
echo "  • Players can play IMMEDIATELY in practice mode (6000x6000 map)"
echo "  • Timer shows: 'Practice Mode - X/5 for competitive round'"
echo "  • When 5th player joins:"
echo "    - 5 second countdown"
echo "    - Map shrinks to 3000x3000"
echo "    - Everyone's score resets to 0"
echo "    - 10-minute competitive round begins"
echo "  • After round ends: 1 minute break then back to practice"
echo ""
echo "No more waiting! Players can have fun immediately!"
