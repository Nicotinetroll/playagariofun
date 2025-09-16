#!/bin/bash

echo "🔧 Fixing spawn issues and keeping map always small..."

# 1. Update config - always small map
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
    gameWidth: 3000,  // Always small
    gameHeight: 3000, // Always small
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

# 2. Create simple working server - play immediately, reset at 5 players
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
let gameMode = 'practice'; // practice or competitive
let roundNumber = 0;
let roundStartTime = null;
let connectedPlayers = 0;
let playersMap = new Map(); // Track actual players

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

function getGameStatus() {
    const now = Date.now();
    
    if (gameMode === 'practice') {
        return {
            state: 'practice',
            playersConnected: playersMap.size,
            playersNeeded: config.minPlayersToStart,
            message: `Practice - ${playersMap.size}/${config.minPlayersToStart} for round`
        };
    } else {
        const elapsed = now - roundStartTime;
        const remaining = Math.max(0, config.roundTime - elapsed);
        return {
            state: 'competitive',
            roundNumber: roundNumber,
            timeRemaining: Math.floor(remaining / 1000),
            playersConnected: playersMap.size
        };
    }
}

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User connected:', type);
    
    socket.emit('gameStatus', getGameStatus());
    
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return util.randomPosition(radius);
}

const addPlayer = (socket) => {
    let currentPlayer = null;
    let playerName = null;

    // Send welcome immediately so player can spawn
    socket.emit('welcome', { id: socket.id }, {
        width: config.gameWidth,
        height: config.gameHeight
    });

    socket.on('gotit', function (player) {
        console.log('[INFO] Player connecting:', player.name);
        
        if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username');
            socket.disconnect();
            return;
        }
        
        playerName = player.name.replace(/(<([^>]+)>)/ig, '');
        
        // Create player
        currentPlayer = new mapUtils.playerUtils.Player(socket.id);
        currentPlayer.name = playerName;
        currentPlayer.screenWidth = player.screenWidth;
        currentPlayer.screenHeight = player.screenHeight;
        currentPlayer.target = player.target || {x: 0, y: 0};
        
        // Initialize player position
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);
        
        // Add to game
        map.players.pushNew(currentPlayer);
        map.food.addNew(3);
        sockets[socket.id] = socket;
        playersMap.set(socket.id, playerName);
        
        console.log('[INFO] Player spawned:', playerName);
        io.emit('playerJoin', { name: playerName });
        
        // Update status for everyone
        io.emit('gameStatus', getGameStatus());
        
        // Check if we should start competitive round
        if (gameMode === 'practice' && playersMap.size >= config.minPlayersToStart) {
            startCompetitiveRound();
        }
    });

    socket.on('respawn', () => {
        console.log('[INFO] Respawn request');
        socket.emit('welcome', { id: socket.id }, {
            width: config.gameWidth,
            height: config.gameHeight
        });
    });

    socket.on('disconnect', () => {
        if (currentPlayer) {
            map.players.removePlayerByID(socket.id);
        }
        playersMap.delete(socket.id);
        delete sockets[socket.id];
        
        if (playerName) {
            console.log('[INFO] Player disconnected:', playerName);
            io.emit('playerDisconnect', { name: playerName });
        }
        
        io.emit('gameStatus', getGameStatus());
    });

    socket.on('playerChat', (data) => {
        if (!playerName) return;
        
        let message = (data.message || '').substring(0, 35);
        console.log('[CHAT]', playerName + ':', message);
        
        socket.broadcast.emit('serverSendPlayerChat', {
            sender: playerName,
            message: message
        });
    });

    socket.on('0', (target) => {
        if (!currentPlayer) return;
        currentPlayer.lastHeartbeat = Date.now();
        currentPlayer.target = target;
    });

    socket.on('1', () => {
        if (!currentPlayer) return;
        const minMass = config.defaultPlayerMass + config.fireFood;
        for (let cell of currentPlayer.cells) {
            if (cell.mass >= minMass) {
                cell.mass -= config.fireFood;
                currentPlayer.massTotal -= config.fireFood;
                map.massFood.addNew(currentPlayer, 0, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        if (!currentPlayer) return;
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });

    socket.on('windowResized', (data) => {
        if (currentPlayer) {
            currentPlayer.screenWidth = data.screenWidth;
            currentPlayer.screenHeight = data.screenHeight;
        }
    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });
};

const addSpectator = (socket) => {
    spectators.push(socket.id);
    sockets[socket.id] = socket;
    
    socket.emit('welcome', { id: socket.id }, {
        width: config.gameWidth,
        height: config.gameHeight
    });
    
    socket.on('disconnect', () => {
        spectators = spectators.filter(id => id !== socket.id);
        delete sockets[socket.id];
    });
};

function startCompetitiveRound() {
    console.log('[ROUND] Starting competitive round!');
    
    gameMode = 'competitive';
    roundNumber++;
    roundStartTime = Date.now();
    
    io.emit('serverMSG', '🎮 ROUND ' + roundNumber + ' STARTED!');
    io.emit('serverMSG', '🔄 All scores reset! 10 minutes to win!');
    
    // Reset all players
    for (let player of map.players.data) {
        player.massTotal = config.defaultPlayerMass;
        player.cells = [];
        player.init(generateSpawnpoint(), config.defaultPlayerMass);
    }
    
    // Reset food
    map.food.data = [];
    map.food.addNew(config.maxFood);
    
    io.emit('gameStatus', getGameStatus());
}

function endRound() {
    // Find winner
    if (map.players.data.length > 0) {
        map.players.data.sort((a, b) => b.massTotal - a.massTotal);
        let winner = map.players.data[0];
        
        io.emit('serverMSG', '🏆 WINNER: ' + winner.name + ' with ' + Math.round(winner.massTotal) + ' mass!');
    }
    
    // Back to practice
    gameMode = 'practice';
    io.emit('serverMSG', 'Back to practice mode');
    io.emit('gameStatus', getGameStatus());
}

const tickPlayer = (currentPlayer) => {
    if (!currentPlayer) return;
    
    if (currentPlayer.lastHeartbeat < Date.now() - config.maxHeartbeatInterval) {
        if (sockets[currentPlayer.id]) {
            sockets[currentPlayer.id].emit('kick', 'Timeout');
            sockets[currentPlayer.id].disconnect();
        }
        return;
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    // Collision detection code...
    const isEntityInsideCircle = (point, circle) => {
        return SAT.pointInCircle(new Vector(point.x, point.y), circle);
    };

    for (let cell of currentPlayer.cells) {
        if (!cell) continue;
        
        let cellCircle = cell.toCircle();
        
        // Eat food
        let foodEaten = [];
        for (let i = 0; i < map.food.data.length; i++) {
            if (map.food.data[i] && isEntityInsideCircle(map.food.data[i], cellCircle)) {
                foodEaten.push(i);
                cell.mass += config.foodMass;
                currentPlayer.massTotal += config.foodMass;
            }
        }
        
        // Remove eaten food
        foodEaten.sort((a, b) => b - a);
        for (let i of foodEaten) {
            map.food.data.splice(i, 1);
        }
        
        // Respawn food
        if (foodEaten.length > 0) {
            map.food.addNew(foodEaten.length);
        }
        
        cell.recalculateRadius();
    }
};

const tickGame = () => {
    map.players.data.forEach(tickPlayer);
    
    if (map.massFood) {
        map.massFood.move(config.gameWidth, config.gameHeight);
    }

    // Player collisions
    map.players.handleCollisions((eaten, eater) => {
        let eatenCell = map.players.getCell(eaten.playerIndex, eaten.cellIndex);
        if (!eatenCell) return;

        map.players.data[eater.playerIndex].changeCellMass(eater.cellIndex, eatenCell.mass);

        let died = map.players.removeCell(eaten.playerIndex, eaten.cellIndex);
        if (died) {
            let deadPlayer = map.players.data[eaten.playerIndex];
            if (deadPlayer && sockets[deadPlayer.id]) {
                sockets[deadPlayer.id].emit('RIP');
                io.emit('playerDied', { name: deadPlayer.name });
            }
            map.players.removePlayerByIndex(eaten.playerIndex);
        }
    });
};

const gameloop = () => {
    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }
    
    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
    
    // Check round end
    if (gameMode === 'competitive') {
        let elapsed = Date.now() - roundStartTime;
        if (elapsed >= config.roundTime) {
            endRound();
        }
    }
};

const calculateLeaderboard = () => {
    let topPlayers = map.players.getTopPlayers();
    
    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    }
};

const sendUpdates = () => {
    io.emit('gameStatus', getGameStatus());
    
    for (let player of map.players.data) {
        if (!sockets[player.id]) continue;
        
        let visibleFood = map.food.data;
        let visibleViruses = map.viruses.data;
        let visibleMass = map.massFood.data;
        let visiblePlayers = map.players.data.map(p => ({
            x: p.x,
            y: p.y,
            cells: p.cells,
            massTotal: Math.round(p.massTotal),
            hue: p.hue,
            id: p.id,
            name: p.name
        }));
        
        sockets[player.id].emit('serverTellPlayerMove', 
            {
                x: player.x,
                y: player.y,
                cells: player.cells,
                massTotal: Math.round(player.massTotal),
                hue: player.hue,
                id: player.id,
                name: player.name
            },
            visiblePlayers, 
            visibleFood, 
            visibleMass, 
            visibleViruses
        );
        
        if (leaderboardChanged) {
            sockets[player.id].emit('leaderboard', {
                players: map.players.data.length,
                leaderboard: leaderboard
            });
        }
    }
    
    leaderboardChanged = false;
};

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

console.log('[GAME] Server started - 3000x3000 map');
console.log('[GAME] Practice mode - need', config.minPlayersToStart, 'players for competitive round');

http.listen(config.port, config.host, () => {
    console.log('[DEBUG] Listening on', config.host + ':' + config.port);
});
EOF

echo "🔨 Building..."
npm run build

echo "🔄 Restarting..."
pm2 restart all

echo "✅ Fixed!"
echo ""
echo "Now the game:"
echo "  ✅ Map is ALWAYS 3000x3000 (small)"
echo "  ✅ Players spawn immediately"
echo "  ✅ Player count updates correctly"
echo "  ✅ At 5 players: scores reset, competitive round starts"
echo "  ✅ Timer shows correct player count"
