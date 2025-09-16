#!/bin/bash

# Nájdi a oprav spectator mode v app.js
sed -i '/btnS.onclick = function/,/};/c\
    btnS.onclick = function (e) {\
        e.preventDefault();\
        console.log("Starting as spectator");\
        global.playerType = "spectator";\
        startGame("spectator");\
    };' src/client/js/app.js

# Oprav welcome handler pre spectator
sed -i '/socket.on.*welcome.*function/,/});/c\
    socket.on("welcome", function (playerSettings, gameSizes) {\
        console.log("Welcome received, type:", global.playerType);\
        player = playerSettings;\
        player.name = global.playerName || "";\
        \
        if (global.playerType === "spectator") {\
            // Spectator nastavenia\
            player.x = gameSizes.width / 2;\
            player.y = gameSizes.height / 2;\
            player.screenWidth = gameSizes.width;\
            player.screenHeight = gameSizes.height;\
            global.screen.width = window.innerWidth * 2;\
            global.screen.height = window.innerHeight * 2;\
        } else {\
            player.screenWidth = global.screen.width;\
            player.screenHeight = global.screen.height;\
        }\
        \
        player.target = window.canvas ? window.canvas.target : {x: 0, y: 0};\
        global.player = player;\
        if (window.chat) {\
            window.chat.player = player;\
        }\
        socket.emit("gotit", player);\
        global.gameStart = true;\
        if (window.chat) {\
            window.chat.addSystemLine("Connected as " + global.playerType);\
        }\
        if (c) c.focus();\
        global.game.width = gameSizes.width;\
        global.game.height = gameSizes.height;\
        resize();\
    });' src/client/js/app.js

# Oprav gameLoop pre spectator
sed -i '/function gameLoop/,/^}/c\
function gameLoop() {\
    if (global.gameStart && graph) {\
        // Clear canvas\
        graph.fillStyle = global.backgroundColor;\
        graph.fillRect(0, 0, global.screen.width, global.screen.height);\
\
        // Spectator view adjustments\
        if (global.playerType === "spectator") {\
            // Scale down for wider view\
            graph.save();\
            var scale = 0.5;\
            graph.scale(scale, scale);\
            graph.translate(global.screen.width * 0.5, global.screen.height * 0.5);\
        }\
\
        render.drawGrid(global, player, global.screen, graph);\
        \
        foods.forEach(food => {\
            let position = getPosition(food, player, global.screen);\
            render.drawFood(position, food, graph);\
        });\
        \
        fireFood.forEach(fireFood => {\
            let position = getPosition(fireFood, player, global.screen);\
            render.drawFireFood(position, fireFood, playerConfig, graph);\
        });\
        \
        viruses.forEach(virus => {\
            let position = getPosition(virus, player, global.screen);\
            render.drawVirus(position, virus, graph);\
        });\
\
        let borders = {\
            left: global.screen.width / 2 - player.x,\
            right: global.screen.width / 2 + global.game.width - player.x,\
            top: global.screen.height / 2 - player.y,\
            bottom: global.screen.height / 2 + global.game.height - player.y\
        }\
        \
        if (global.borderDraw) {\
            render.drawBorder(borders, graph);\
        }\
\
        var cellsToDraw = [];\
        for (var i = 0; i < users.length; i++) {\
            let color = "hsl(" + users[i].hue + ", 100%, 50%)";\
            let borderColor = "hsl(" + users[i].hue + ", 100%, 45%)";\
            for (var j = 0; j < users[i].cells.length; j++) {\
                cellsToDraw.push({\
                    color: color,\
                    borderColor: borderColor,\
                    mass: users[i].cells[j].mass,\
                    name: users[i].name,\
                    radius: users[i].cells[j].radius,\
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,\
                    y: users[i].cells[j].y - player.y + global.screen.height / 2\
                });\
            }\
        }\
        cellsToDraw.sort(function (obj1, obj2) {\
            return obj1.mass - obj2.mass;\
        });\
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);\
\
        if (global.playerType === "spectator") {\
            graph.restore();\
        }\
\
        if (socket) {\
            socket.emit("0", window.canvas ? window.canvas.target : target);\
        }\
    }\
}' src/client/js/app.js

