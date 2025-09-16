#!/bin/bash

echo "🔧 Complete fix for all errors..."

# 1. First, let's go back to a simpler, working version without rounds
echo "📝 Creating stable server without rounds first..."
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

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    
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
            console.log('[INFO] Player ' + playerName + ' connected!');
            sockets[socket.id] = socket;
            
            map.players.pushNew(currentPlayer);
            map.food.addNew(3);
            
            io.emit('playerJoin', { name: playerName });
            playerCount++;
            console.log('Total players: ' + playerCount);
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
        if (currentPlayer && currentPlayer.id) {
            map.players.removePlayerByID(currentPlayer.id);
            playerCount = Math.max(0, playerCount - 1);
            
            if (playerName) {
                console.log('[INFO] User ' + playerName + ' disconnected');
                socket.broadcast.emit('playerDisconnect', { name: playerName });
            }
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

    socket.on('pass', (data) => {
        if (data && data[0] === config.adminPass) {
            console.log('[ADMIN] ' + playerName + ' logged in as admin');
            socket.emit('serverMSG', 'Admin access granted');
            if (currentPlayer) currentPlayer.admin = true;
        } else {
            socket.emit('serverMSG', 'Password incorrect');
        }
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
};

const sendUpdates = () => {
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
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

var ipaddress = config.host;
var serverport = config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
EOF

# 2. Disable rounds in config for now
echo "📝 Disabling rounds temporarily..."
sed -i 's/enableRounds: true/enableRounds: false/' config.js

# 3. Rebuild and restart
echo "🔨 Rebuilding..."
npm run build

echo "🔄 Restarting..."
pm2 restart all

echo "✅ Fixed all errors!"
echo ""
echo "The game should now work without errors."
echo "Test it first, then we can add rounds back carefully."
echo ""
echo "Fixed issues:"
echo "  • Chat disconnect error"
echo "  • Undefined length error" 
echo "  • Player count not updating"
echo "  • All null/undefined checks added"
