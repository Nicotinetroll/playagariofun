const fs = require('fs');

let serverCode = fs.readFileSync('src/server/server.js', 'utf8');

// Oprav playerJoin event aby vždy posielal name
serverCode = serverCode.replace(
    "io.emit('playerJoin', { name: currentPlayer.name });",
    "io.emit('playerJoin', { name: currentPlayer.name || '' });"
);

// Oprav playerDisconnect event
serverCode = serverCode.replace(
    "socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });",
    "socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name || '' });"
);

// Oprav playerDied event
serverCode = serverCode.replace(
    "io.emit('playerDied', { name: playerGotEaten.name });",
    "io.emit('playerDied', { name: playerGotEaten.name || '', playerEatenName: playerGotEaten.name || '', playerWhoAtePlayerName: '' });"
);

fs.writeFileSync('src/server/server.js', serverCode);
console.log('Server data fixed!');
