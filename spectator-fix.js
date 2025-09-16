// Nájdi v server.js funkciu updateSpectator a nahraď ju týmto:
const updateSpectator = (socketID) => {
    if (!sockets[socketID]) return;
    
    // Spectator vidí celú mapu
    let playerData = {
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        id: socketID,
        name: '',
        screenWidth: config.gameWidth * 1.5,  // Vidí 1.5x viac
        screenHeight: config.gameHeight * 1.5
    };
    
    // Pošli všetko čo je na mape
    sockets[socketID].emit('serverTellPlayerMove', 
        playerData, 
        map.players.data, 
        map.food.data, 
        map.massFood.data, 
        map.viruses.data
    );
    
    if (leaderboardChanged) {
        sendLeaderboard(sockets[socketID]);
    }
}
