#!/bin/bash

echo "🔧 Fixing game start issue..."

# Create a clean working app.js
cat > src/client/js/app.js << 'EOF'
var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 44);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    // Hide menu completely
    var menuWrapper = document.getElementById('startMenuWrapper');
    if (menuWrapper) {
        menuWrapper.style.display = 'none';
    }
    
    var gameWrapper = document.getElementById('gameAreaWrapper');
    if (gameWrapper) {
        gameWrapper.style.opacity = '1';
    }
    
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    
    socket.emit('respawn');
    
    if (window.chat) {
        window.chat.socket = socket;
        window.chat.registerFunctions();
    }
    if (window.canvas) {
        window.canvas.socket = socket;
    }
    global.socket = socket;
}

function validNick() {
    return playerNameInput.value.trim().length > 0;
}

window.onload = function () {
    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectator');
    };

    btn.onclick = function () {
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// Settings handlers
var settings = {
    toggleBorder: function() {
        global.borderDraw = !global.borderDraw;
    },
    toggleMass: function() {
        global.toggleMassState = global.toggleMassState === 0 ? 1 : 0;
    },
    toggleContinuity: function() {
        global.continuity = !global.continuity;
    },
    toggleRoundFood: function() {
        global.foodSides = global.foodSides < 10 ? 10 : 5;
    }
};

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
if (visibleBorderSetting) visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
if (showMassSetting) showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
if (continuitySetting) continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
if (roundFoodSetting) roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

// jQuery button handlers
$(document).ready(function() {
    $("#feed").click(function () {
        if (socket) {
            socket.emit('1');
            window.canvas.reenviar = false;
        }
    });

    $("#split").click(function () {
        if (socket) {
            socket.emit('2');
            window.canvas.reenviar = false;
        }
    });
});

function handleDisconnect() {
    if (socket) socket.close();
    if (!global.kicked) { 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

function setupSocket(socket) {
    // Handle ping
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            var chatbox = document.getElementById('chatbox');
            if (chatbox && chatbox.parentNode) {
                chatbox.parentNode.removeChild(chatbox);
            }
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', function(data) {
        const player = data.playerEatenName || 'A player';
        window.chat.addSystemLine('{GAME} - <b>' + player + '</b> was eaten');
    });

    socket.on('playerDisconnect', function(data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name || 'A player') + '</b> disconnected.');
    });

    socket.on('playerJoin', function(data) {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name || 'A player') + '</b> joined.');
    });

    socket.on('leaderboard', function(data) {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            var name = leaderboard[i].name || 'Guest';
            
            // Format SOL address if it looks like one
            if (name && name.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(name)) {
                name = name.substring(0, 4) + '...' + name.substring(name.length - 4);
            }
            
            if (leaderboard[i].id == player.id) {
                status += '<span class="me">' + (i + 1) + '. ' + name + '</span>';
            } else {
                status += (i + 1) + '. ' + name;
            }
        }
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            var menuWrapper = document.getElementById('startMenuWrapper');
            if (menuWrapper) {
                menuWrapper.style.display = 'block';
            }
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        } else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });

    // Round system handlers
    socket.on('roundTimer', function(seconds) {
        var minutes = Math.floor(seconds / 60);
        var secs = seconds % 60;
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            var timeElement = timerElement.querySelector('.time-remaining');
            if (timeElement) {
                timeElement.textContent = minutes + ':' + (secs < 10 ? '0' : '') + secs;
            }
            
            if (seconds <= 60) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        }
    });

    socket.on('roundInfo', function(data) {
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            var roundElement = timerElement.querySelector('.round-number');
            if (roundElement) {
                roundElement.textContent = 'ROUND ' + data.roundNumber;
            }
        }
    });

    socket.on('roundEnd', function(data) {
        var modal = document.getElementById('winnerModal');
        if (modal && data.winner) {
            modal.classList.add('show');
            var nameEl = document.getElementById('winnerName');
            var massEl = document.getElementById('winnerMass');
            if (nameEl) nameEl.textContent = data.winner.name;
            if (massEl) massEl.textContent = 'Mass: ' + data.winner.mass;
            
            var countdown = 10;
            var countdownInterval = setInterval(function() {
                countdown--;
                var countEl = document.getElementById('countdown');
                if (countEl) countEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    modal.classList.remove('show');
                }
            }, 1000);
        }
    });

    socket.on('newRound', function(data) {
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            var roundElement = timerElement.querySelector('.round-number');
            if (roundElement) {
                roundElement.textContent = 'ROUND ' + data.roundNumber;
            }
        }
    });

    socket.on('canRespawn', function() {
        if (global.playerName) {
            socket.emit('respawn');
        }
    });
}

const getPosition = function(entity, player, screen) {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    };
};

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function () {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        
        foods.forEach(function(food) {
            var position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        
        fireFood.forEach(function(mass) {
            var position = getPosition(mass, player, global.screen);
            render.drawFireFood(position, mass, playerConfig, graph);
        });
        
        viruses.forEach(function(virus) {
            var position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });

        var borders = {
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        };
        
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            var color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            var borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2
                });
            }
        }
        
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        if (socket) {
            socket.emit('0', window.canvas.target);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    var width = window.innerWidth;
    var height = window.innerHeight;
    
    player.screenWidth = c.width = global.screen.width = width;
    player.screenHeight = c.height = global.screen.height = height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: width, screenHeight: height });
}
EOF

echo "🔨 Rebuilding..."
npm run build

echo "🔄 Restarting server..."
pm2 restart all

echo "✅ Game start fixed!"
echo "  • Menu now properly hides when clicking Play/Spectate"
echo "  • Socket handlers properly organized"
echo "  • Round system integrated correctly"
