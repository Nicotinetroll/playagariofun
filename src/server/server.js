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

// Round system
let gameState = 'practice';
let roundNumber = 0;
let roundStartTime = null;
let breakEndTime = null;
let countdownEndTime = null;
let lastWinner = null;

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
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}

function getGameStatus() {
    const now = Date.now();
    const actualPlayerCount = map.players.data.length;
    
    if (gameState === 'practice') {
        return {
            state: 'practice',
            playersConnected: actualPlayerCount,
            playersNeeded: config.minPlayersToStart || 5,
            message: `PRACTICE MODE - ${actualPlayerCount}/${config.minPlayersToStart || 5} players`
        };
    } else if (gameState === 'countdown') {
        const remaining = Math.max(0, Math.floor((countdownEndTime - now) / 1000));
        return {
            state: 'countdown',
            timeRemaining: remaining,
            roundNumber: roundNumber + 1
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
        const remaining = Math.max(0, Math.floor((breakEndTime - now) / 1000));
        return {
            state: 'break',
            timeRemaining: remaining,
            winner: lastWinner
        };
    }
    
    return {
        state: 'practice',
        playersConnected: actualPlayerCount,
        playersNeeded: config.minPlayersToStart || 5
    };
}

const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);
    const skinData = require("./skins");

    socket.on('gotit', function (clientPlayerData) {
        console.log('[INFO] Player ' + (clientPlayerData.name || 'unnamed') + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + (clientPlayerData.name || 'unnamed') + ' connected!');
            sockets[socket.id] = socket;

            // No validation - accept anything
            const playerName = clientPlayerData.name || '';
            currentPlayer.name = playerName;
        currentPlayer.skin = skinData.getRandomSkin();
            currentPlayer.screenWidth = clientPlayerData.screenWidth;
            currentPlayer.screenHeight = clientPlayerData.screenHeight;
            currentPlayer.target = { x: 0, y: 0 };

            map.players.pushNew(currentPlayer);
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
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        map.players.removePlayerByID(currentPlayer.id);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', (data) => {
        if (!data) return;
        var _sender = data.sender || '';
        var _message = data.message || '';

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: currentPlayer.name,
            message: _message.substring(0, 35)
        });

        if (chatRepository && chatRepository.logChatMessage) {
            chatRepository.logChatMessage(_sender, _message, socket.handshake.address)
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
            if (loggingRepositry && loggingRepositry.logFailedLoginAttempt) {
                loggingRepositry.logFailedLoginAttempt(currentPlayer.name, socket.handshake.address)
                    .catch((err) => console.error("Error when attempting to log failed login attempt", err));
            }
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

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        // Fire food.
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
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + config.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
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

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += (eatenFoodIndexes.length * config.foodMass);
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
};

const tickGame = () => {
    map.players.data.forEach(tickPlayer);
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
    checkRoundState();
};

function checkRoundState() {
    if (!config.enableRounds) return;
    
    const now = Date.now();
    const playerCount = map.players.data.length;
    
    if (gameState === 'practice') {
        if (playerCount >= (config.minPlayersToStart || 5)) {
            startCountdown();
        }
    } else if (gameState === 'active') {
        const elapsed = now - roundStartTime;
        if (elapsed >= config.roundTime) {
            endRound();
        }
    }
}

function startCountdown() {
    gameState = 'countdown';
    countdownEndTime = Date.now() + 10000;
    
    io.emit('serverMSG', '🚀 Round starting in 10 seconds! Resetting all players...');
    io.emit('countdown', { seconds: 10 });
    
    resetAllPlayers();
    
    setTimeout(() => {
        if (gameState === 'countdown') {
            startRound();
        }
    }, 10000);
}

function startRound() {
    roundNumber++;
    roundStartTime = Date.now();
    gameState = 'active';
    
    io.emit('serverMSG', `🎮 ROUND ${roundNumber} STARTED! 10 minutes - GO!`);
    io.emit('roundStart', { round: roundNumber });
}

function endRound() {
    gameState = 'break';
    breakEndTime = Date.now() + config.roundBreakTime;
    
    let winner = null;
    let topMass = 0;
    for (let player of map.players.data) {
        if (player.massTotal > topMass) {
            topMass = player.massTotal;
            winner = player;
        }
    }
    
    if (winner) {
        lastWinner = {
            name: winner.name || 'Anonymous',
            mass: Math.round(winner.massTotal)
        };
        
        io.emit('serverMSG', `🏆 ROUND ${roundNumber} WINNER: ${lastWinner.name}`);
        io.emit('serverMSG', `Final mass: ${lastWinner.mass}`);
        io.emit('roundEnd', { winner: lastWinner });
    }
    
    setTimeout(() => {
        if (map.players.data.length >= (config.minPlayersToStart || 5)) {
            startCountdown();
        } else {
            gameState = 'practice';
            io.emit('serverMSG', `⏸️ PRACTICE MODE - Need more players`);
        }
    }, config.roundBreakTime);
}

function resetAllPlayers() {
    for (let player of map.players.data) {
        player.init(generateSpawnpoint(), config.defaultPlayerMass);
    }
    
    map.food.data = [];
    map.viruses.data = [];
    map.massFood.data = [];
    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);
    
    io.emit('serverMSG', '🔄 All players reset!');
}

let lastStatusSent = null;
const sendUpdates = () => {
    const currentStatus = getGameStatus();
    
    // Pošli status len ak sa zmenil
    if (!lastStatusSent || JSON.stringify(currentStatus) !== JSON.stringify(lastStatusSent)) {
        io.emit('gameStatus', currentStatus);
        lastStatusSent = currentStatus;
    }
    
    // Optimalizované posielanie dát
    const visibleData = new Map();
    
    // Predpočítaj viditeľné objekty
    map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        if (sockets[playerData.id] && sockets[playerData.id].connected) {
            // Pošli len ak je socket aktívny
            sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
            if (leaderboardChanged) {
                sendLeaderboard(sockets[playerData.id]);
            }
        }
    });
    
    // Update spectators
    spectators = spectators.filter(id => sockets[id] && sockets[id].connected);
    spectators.forEach(updateSpectator);

    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
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

// Optimalizované intervaly pre menej memory usage
setInterval(tickGame, 1000 / 45);  // 45 FPS namiesto 60
setInterval(gameloop, 1500);       // Každých 1.5 sekundy
setInterval(sendUpdates, 1000 / 25); // 25 updatov za sekundu

// Garbage collection helper - čistí memory každých 30 sekúnd
setInterval(() => {
    if (global.gc) {
        global.gc();
    }
    // Vyčisti prázdne sockety
    for (let id in sockets) {
        if (!sockets[id] || !sockets[id].connected) {
            delete sockets[id];
        }
    }
}, 30000);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
