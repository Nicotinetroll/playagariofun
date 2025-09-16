var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;
var currentGameStatus = null;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.substring(0, 44);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    // CRITICAL FIX - completely hide menu
    document.getElementById('startMenuWrapper').style.display = 'none';
    document.getElementById('gameAreaWrapper').style.display = 'block';
    document.getElementById('gameAreaWrapper').style.opacity = '1';
    
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

window.onload = function () {
    console.log('Game initializing...');
    
    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton');

    var twitterBtn = document.getElementById('twitterBtn');
    var pumpBtn = document.getElementById('pumpBtn');

    if (twitterBtn) {
        twitterBtn.onclick = function() {
            window.open('https://twitter.com/yourtoken', '_blank');
        };
    }

    if (pumpBtn) {
        pumpBtn.onclick = function() {
            window.open('https://pump.fun/yourtoken', '_blank');
        };
    }

    if (btnS) {
        btnS.onclick = function (e) {
            e.preventDefault();
            startGame('spectator');
        };
    }

    if (btn) {
        btn.onclick = function (e) {
            e.preventDefault();
            startGame('player');
        };
    }

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    if (settingsMenu) {
        settingsMenu.onclick = function () {
            if (settings.style.maxHeight == '300px') {
                settings.style.maxHeight = '0px';
            } else {
                settings.style.maxHeight = '300px';
            }
        };
    }

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;
        if (key === global.KEY_ENTER) {
            startGame('player');
        }
    });
    
    window.canvas = new Canvas();
    window.chat = new ChatClient();
    
    var visibleBorderSetting = document.getElementById('visBord');
    if (visibleBorderSetting) {
        visibleBorderSetting.onchange = function() {
            global.borderDraw = !global.borderDraw;
        };
    }

    var showMassSetting = document.getElementById('showMass');
    if (showMassSetting) {
        showMassSetting.onchange = function() {
            global.toggleMassState = global.toggleMassState === 0 ? 1 : 0;
        };
    }

    var continuitySetting = document.getElementById('continuity');
    if (continuitySetting) {
        continuitySetting.onchange = function() {
            global.continuity = !global.continuity;
        };
    }

    var roundFoodSetting = document.getElementById('roundFood');
    if (roundFoodSetting) {
        roundFoodSetting.onchange = function() {
            global.foodSides = global.foodSides < 10 ? 10 : 5;
        };
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

var c = document.getElementById('cvs');
var graph = c ? c.getContext('2d') : null;

window.settings = {
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

function handleDisconnect() {
    if (socket) {
        socket.close();
    }
    if (!global.kicked && graph) {
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

function updateTimer(status) {
    var timer = document.getElementById('roundTimer');
    if (!timer) return;
    
    timer.style.display = 'block';
    var statusEl = timer.querySelector('.round-status');
    var timeEl = timer.querySelector('.time-display');
    
    if (!statusEl || !timeEl) return;
    
    if (status.state === 'practice') {
        timer.className = 'practice';
        statusEl.textContent = 'PRACTICE MODE';
        timeEl.textContent = status.playersConnected + '/' + status.playersNeeded + ' Players';
    } else if (status.state === 'countdown') {
        timer.className = 'countdown';
        statusEl.textContent = 'ROUND ' + status.roundNumber + ' STARTING';
        timeEl.textContent = 'in ' + status.timeRemaining + 's';
    } else if (status.state === 'active') {
        timer.className = status.timeRemaining <= 60 ? 'warning' : 'active';
        statusEl.textContent = 'ROUND ' + status.roundNumber;
        var minutes = Math.floor(status.timeRemaining / 60);
        var seconds = status.timeRemaining % 60;
        timeEl.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    } else if (status.state === 'break') {
        timer.className = 'break';
        if (status.winner) {
            statusEl.textContent = '🏆 WINNER: ' + status.winner.name;
        } else {
            statusEl.textContent = 'ROUND BREAK';
        }
        timeEl.textContent = 'Next round in ' + status.timeRemaining + 's';
    }
}

function setupSocket(socket) {
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        if (window.chat) {
            window.chat.addSystemLine('Ping: ' + latency + 'ms');
        }
    });

    socket.on('gameStatus', function(status) {
        currentGameStatus = status;
        updateTimer(status);
    });

    socket.on('countdown', function(data) {
        showCountdown(data.seconds);
    });

    socket.on('roundEnd', function(data) {
        showWinner(data.winner, data.stats);
    });

    socket.on('roundStart', function(data) {
        if (window.chat) {
            window.chat.addSystemLine('🎮 Round ' + data.round + ' has started!');
        }
    });

    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas ? window.canvas.target : {x: 0, y: 0};
        global.player = player;
        if (window.chat) {
            window.chat.player = player;
        }
        socket.emit('gotit', player);
        global.gameStart = true;
        if (window.chat) {
            window.chat.addSystemLine('Connected to the game!');
            window.chat.addSystemLine('Type <b>-help</b> for commands.');
        }
        if (global.mobile) {
            var chatbox = document.getElementById('chatbox');
            if (chatbox) {
                chatbox.parentNode.removeChild(chatbox);
            }
        }
        if (c) c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const playerName = (!data || !data.name || data.name.length < 1) ? 'Anonymous' : data.name;
        if (window.chat) {
            window.chat.addSystemLine('{GAME} - <b>' + playerName + '</b> was eaten');
        }
    });

    socket.on('playerDisconnect', (data) => {
        const playerName = (!data || !data.name || data.name.length < 1) ? 'Anonymous' : data.name;
        if (window.chat) {
            window.chat.addSystemLine('{GAME} - <b>' + playerName + '</b> disconnected.');
        }
    });

    socket.on('playerJoin', (data) => {
        const playerName = (!data || !data.name || data.name.length < 1) ? 'Anonymous' : data.name;
        if (window.chat) {
            window.chat.addSystemLine('{GAME} - <b>' + playerName + '</b> joined.');
        }
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name && leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". Anonymous</span>";
            } else {
                if (leaderboard[i].name && leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. Anonymous';
            }
        }
        var statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML = status;
        }
    });

    socket.on('serverMSG', function (data) {
        if (window.chat) {
            window.chat.addSystemLine(data);
        }
    });

    socket.on('serverSendPlayerChat', function (data) {
        if (window.chat) {
            window.chat.addChatLine(data.sender, data.message, false);
        }
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
        if (graph) {
            render.drawErrorMessage('You died!', graph, global.screen);
        }
        window.setTimeout(() => {
            var gameArea = document.getElementById('gameAreaWrapper');
            var startMenu = document.getElementById('startMenuWrapper');
            if (gameArea) {
                gameArea.style.display = 'none';
                gameArea.style.opacity = '0';
            }
            if (startMenu) {
                startMenu.style.display = 'block';
                startMenu.style.opacity = '1';
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
        if (graph) {
            if (reason !== '') {
                render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
            } else {
                render.drawErrorMessage('You were kicked!', graph, global.screen);
            }
        }
        socket.close();
    });
}

function showCountdown(seconds) {
    var existing = document.getElementById('bigCountdown');
    if (existing) existing.remove();
    
    var countdown = document.createElement('div');
    countdown.id = 'bigCountdown';
    countdown.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:120px;color:#FFD700;text-shadow:3px 3px 6px rgba(0,0,0,0.7);z-index:9999;font-weight:bold;';
    countdown.textContent = seconds;
    document.body.appendChild(countdown);
    
    setTimeout(() => countdown.remove(), 1000);
}

function showWinner(winner, stats) {
    if (!winner) return;
    
    var existing = document.getElementById('winnerAnnouncement');
    if (existing) existing.remove();
    
    var announcement = document.createElement('div');
    announcement.id = 'winnerAnnouncement';
    announcement.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:3px solid #FFD700;border-radius:15px;padding:30px;color:white;text-align:center;z-index:9999;min-width:400px;';
    announcement.innerHTML = '<h2 style="color:#FFD700;font-size:36px;">🏆 ROUND WINNER 🏆</h2>' +
                           '<h3 style="font-size:28px;margin:20px 0;">' + winner.name + '</h3>' +
                           '<p style="font-size:20px;">Final Mass: ' + winner.mass + '</p>';
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 10000);
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
    if (global.gameStart && graph) {
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

        if (socket) {
            socket.emit('0', window.canvas ? window.canvas.target : target);
        }
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
