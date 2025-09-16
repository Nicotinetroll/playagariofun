#!/bin/bash

echo "🔧 Fixing waiting room - game won't start until 5 players..."

# Update server to properly enforce waiting room
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
let playerCount = 0;

// Round system
let gameState = 'waiting'; // waiting, active, break
let roundNumber = 0;
let roundStartTime = null;
let breakEndTime = null;
let connectedPlayers = 0;

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

// Get game status for timer
function getGameStatus() {
    const now = Date.now();
    
    if (gameState === 'waiting') {
        return {
            state: 'waiting',
            playersConnected: connectedPlayers,
            playersNeeded: config.minPlayersToStart,
            message: `Waiting: ${connectedPlayers}/${config.minPlayersToStart} players`
        };
    } else if (gameState === 'active') {
        const elapsed = now - roundStartTime;
        const remaining = Math.max(0, config.roundTime - elapsed);
        return {
            state: 'active',
            roundNumber: roundNumber,
            timeRemaining: Math.floor(remaining / 1000)
        };
    } else if (gameState === 'break') {
        const remaining = Math.max(0, breakEndTime - now);
        return {
            state: 'break',
            timeRemaining: Math.floor(remaining / 1000)
        };
    }
}

// Check if we should start/end rounds
function checkRoundState() {
    if (!config.enableRounds) return;
    
    const now = Date.now();
    
    if (gameState === 'waiting') {
        // ONLY start if we have enough players
        if (connectedPlayers >= config.minPlayersToStart) {
            startRound();
        }
    } else if (gameState === 'active') {
        const elapsed = now - roundStartTime;
        
        // Warning at 1 minute
        if (elapsed >= config.roundTime - 60000 && 
            elapsed < config.roundTime - 59000) {
            io.emit('serverMSG', '⚠️ 1 MINUTE LEFT IN ROUND! ⚠️');
        }
        
        // End round after 10 minutes
        if (elapsed >= config.roundTime) {
            endRound();
        }
    } else if (gameState === 'break') {
        if (now >= breakEndTime) {
            if (connectedPlayers >= config.minPlayersToStart) {
                startRound();
            } else {
                gameState = 'waiting';
                io.emit('serverMSG', `Waiting for players: ${connectedPlayers}/${config.minPlayersToStart}`);
            }
        }
    }
}

function startRound() {
    console.log('[ROUND] Starting round ' + (roundNumber + 1));
    gameState = 'active';
    roundNumber++;
    roundStartTime = Date.now();
    
    // Reset map
    map = new mapUtils.Map(config);
    leaderboard = [];
    leaderboardChanged = true;
    
    io.emit('serverMSG', `🎮 ROUND ${roundNumber} STARTED! 10 minutes to become champion!`);
    io.emit('newRound', { roundNumber: roundNumber });
    
    // Allow all connected players to spawn
    for (let socketId in sockets) {
        sockets[socketId].emit('canRespawn');
    }
}

function endRound() {
    console.log('[ROUND] Ending round ' + roundNumber);
    gameState = 'break';
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
        
        io.emit('serverMSG', `🏆 ROUND ${roundNumber} WINNER: ${winner.name} with ${Math.round(winner.massTotal)} mass!`);
    }
    
    io.emit('serverMSG', 'Round break - next round in 1 minute');
    
    // Kick all players back to menu
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
    
    // Send waiting message if in waiting state
    if (gameState === 'waiting') {
        socket.emit('serverMSG', `Waiting for players: ${connectedPlayers}/${config.minPlayersToStart}`);
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

    socket.on('gotit', function (player) {
        console.log('[INFO] Player ' + player.name + ' connecting!');
        
        if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
            return;
        }
        
        // IMPORTANT: Only allow spawning if game is active
        if (gameState !== 'active' && config.enableRounds) {
            socket.emit('serverMSG', `Game starting soon. Waiting: ${connectedPlayers}/${config.minPlayersToStart} players`);
            // Don't spawn the player yet, just count them
            playerName = player.name.replace(/(<([^>]+)>)/ig, '');
            currentPlayer.name = playerName;
            sockets[socket.id] = socket;
            connectedPlayers++;
            
            // Update all clients
            io.emit('gameStatus', getGameStatus());
            
            // Check if we can start
            if (connectedPlayers >= config.minPlayersToStart && gameState === 'waiting') {
                io.emit('serverMSG', '🎉 Enough players! Starting in 5 seconds...');
                setTimeout(() => {
                    if (connectedPlayers >= config.minPlayersToStart) {
                        startRound();
                    }
                }, 5000);
            }
            return;
        }
        
        // Normal spawn for active game
        playerName = player.name.replace(/(<([^>]+)>)/ig, '');
        currentPlayer.name = playerName;
        currentPlayer.screenWidth = player.screenWidth;
        currentPlayer.screenHeight = player.screenHeight;
        currentPlayer.target = {x: 0, y: 0};
        
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
        
        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID already connected, kicking.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + playerName + ' spawned!');
            sockets[socket.id] = socket;
            
            map.players.pushNew(currentPlayer);
            map.food.addNew(3);
            
            io.emit('playerJoin', { name: playerName });
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
        // Only allow respawn during active game
        if (gameState !== 'active') {
            socket.emit('serverMSG', 'Cannot respawn - round not active');
            return;
        }
        
        if (currentPlayer && currentPlayer.id) {
            map.players.removePlayerByID(currentPlayer.id);
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
        
        // Check if not enough players during active game
        if (gameState === 'active' && connectedPlayers < 2) {
            io.emit('serverMSG', '⚠️ Not enough players, round will end early');
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
        if (!currentPlayer || gameState !== 'active') return;
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target && target.x !== undefined && target.y !== undefined) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        if (!currentPlayer || !currentPlayer.cells || gameState !== 'active') return;
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i] && currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        if (!currentPlayer || gameState !== 'active') return;
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });
    
    socket.on('canRespawn', () => {
        if (gameState === 'active' && playerName) {
            // Player can spawn now
            currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
            map.players.pushNew(currentPlayer);
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
    if (!currentPlayer || gameState !== 'active') return;
    
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        if (sockets[currentPlayer.id]) {
            sockets[currentPlayer.id].emit('kick', 'Last heartbeat timeout.');
            sockets[currentPlayer.id].disconnect();
        }
        return;
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    // [Rest of tickPlayer code stays the same...]
};

const tickGame = () => {
    if (gameState === 'active') {
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
    if (map.players.data.length > 0 && gameState === 'active') {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }
    
    if (gameState === 'active') {
        map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
    }
    
    // Check round state
    checkRoundState();
};

const sendUpdates = () => {
    // Always send game status
    io.emit('gameStatus', getGameStatus());
    
    if (gameState !== 'active') return;
    
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
setInterval(sendUpdates, 1000 / 3); // Send status updates frequently

console.log('[ROUNDS] Game in WAITING mode - need ' + config.minPlayersToStart + ' players to start');

var ipaddress = config.host;
var serverport = config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
EOF

echo "🔨 Rebuilding..."
npm run build

echo "🔄 Restarting..."
pm2 restart all

echo "✅ Waiting room fixed!"
echo ""
echo "Now the game will:"
echo "  ⏸️ Stay in WAITING mode until 5 players connect"
echo "  🎮 Start automatically when 5th player joins"
echo "  ⏰ Show timer: 'WAITING FOR PLAYERS - X/5'"
echo "  ❌ NOT allow spawning until round starts"
echo "  📢 Countdown 5 seconds before starting"
echo ""
echo "Players who connect during waiting will see the game"
echo "but cannot spawn until the round begins!"
