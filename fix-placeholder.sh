#!/bin/bash

echo "🔧 Removing default name, showing placeholder..."

# Fix app.js - NO default name generation
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

    // FORCE HIDE MENU
    document.getElementById('startMenuWrapper').style.display = 'none';
    document.getElementById('startMenuWrapper').style.visibility = 'hidden';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

function validNick() {
    return playerNameInput.value.trim().length > 0;
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    // DO NOT SET ANY DEFAULT VALUE - LEAVE EMPTY TO SHOW PLACEHOLDER
    // playerNameInput.value = "";  // NO DEFAULT NAME!

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
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

function setupSocket(socket) {
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

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
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const player = data.playerEatenName || 'A player';
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name || 'A player') + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (data.name || 'A player') + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            var name = leaderboard[i].name;
            
            // Format SOL address if it looks like one
            if (name && name.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(name)) {
                name = name.substring(0, 4) + '...' + name.substring(name.length - 4);
            }
            
            if (leaderboard[i].id == player.id) {
                status += '<span class="me">' + (i + 1) + '. ' + name + "</span>";
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
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.display = 'block';
            document.getElementById('startMenuWrapper').style.visibility = 'visible';
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
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
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
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });

        let borders = {
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
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

        socket.emit('0', window.canvas.target); 
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
EOF

# Update HTML with better placeholder
cat > src/client/index.html << 'EOF'
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PlayAgario.fun - SOL Edition</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="css/main.css" />
    <audio id="split_cell" src="audio/split.mp3"></audio>
    <audio id="spawn_cell" src="audio/spawn.mp3"></audio>
</head>
<body>
    <div id="gameAreaWrapper">
        <div id="status">
            <span class="title">🏆 Leaderboard</span>
        </div>
        <div class="chatbox" id="chatbox">
            <ul id="chatList" class="chat-list"></ul>
            <input id="chatInput" type="text" class="chat-input" placeholder="Type your message..." maxlength="35" />
        </div>
        <div id="mobile">
           <button id="split" class="split" style="font-size: 24px;">⚡</button>
           <button id="feed" class="feed" style="font-size: 24px;">🎯</button>
        </div>
        <canvas tabindex="1" id="cvs"></canvas>
    </div>
    <div id="startMenuWrapper">
        <div id="startMenu">
            <p>💎 PlayAgario.fun</p>
            <input type="text" tabindex="0" autofocus placeholder="Enter your name or SOL address" id="playerNameInput" maxlength="44" />
            <b class="input-error">You must enter a name!</b>
            <br />
            <button id="startButton">PLAY GAME</button>
            <button id="spectateButton">SPECTATE</button>
            <button id="settingsButton">SETTINGS</button>
            <br />
            <div id="settings">
                <h3>⚙️ Game Settings</h3>
                <ul>
                    <label><input id="visBord" type="checkbox"> Show border</label>
                    <label><input id="showMass" type="checkbox"> Show mass</label>
                    <label><input id="continuity" type="checkbox"> Continue moving off-screen</label>
                    <label><input id="roundFood" type="checkbox" checked> Rounded food</label>
                    <label><input id="darkMode" type="checkbox"> Dark mode</label>
                </ul>
            </div>
            <div id="instructions">
                <h3>📖 How to Play</h3>
                <ul>
                    <li>Enter your name or Solana wallet address</li>
                    <li>Move your mouse to control your cell</li>
                    <li>Eat food and smaller players to grow</li>
                    <li>Press SPACE to split, W to eject mass</li>
                    <li>Avoid larger players and viruses</li>
                </ul>
            </div>
        </div>
    </div>
    <script src="//code.jquery.com/jquery-2.2.0.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
EOF

npm run build
pm2 restart all

echo "✅ FIXED!"
echo "  • NO default name - placeholder visible"
echo "  • Placeholder: 'Enter your name or SOL address'"
echo "  • Must enter something to play"
echo "  • Menu disappears properly"
