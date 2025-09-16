// Nájdi v src/client/js/app.js funkciu startGame a nahraď ju týmto:
function startGame(type) {
    global.playerName = playerNameInput.value.substring(0, 44);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    // TOTO JE DÔLEŽITÉ - úplne schovaj menu!
    var menuWrapper = document.getElementById('startMenuWrapper');
    menuWrapper.style.display = 'none';  // Úplne vymaž z DOM
    menuWrapper.style.visibility = 'hidden';
    menuWrapper.style.opacity = '0';
    
    // Zobraz game area
    var gameWrapper = document.getElementById('gameAreaWrapper');
    gameWrapper.style.display = 'block';
    gameWrapper.style.opacity = '1';
    
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

// A pri smrti hráča oprav návrat do menu:
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
            startMenu.style.display = 'block';  // Zobraz späť
            startMenu.style.visibility = 'visible';
            startMenu.style.opacity = '1';
        }
        if (global.animLoopHandle) {
            window.cancelAnimationFrame(global.animLoopHandle);
            global.animLoopHandle = undefined;
        }
    }, 2500);
});
