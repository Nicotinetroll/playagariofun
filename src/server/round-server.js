const config = require('../../config');

let roundState = {
    state: 'waiting', // waiting, active, break
    roundNumber: 0,
    startTime: null,
    breakEndTime: null,
    playerCount: 0
};

function checkRoundState(io, map) {
    const now = Date.now();
    
    if (roundState.state === 'waiting') {
        if (map.players.data.length >= config.minPlayersToStart) {
            startRound(io, map);
        }
    } else if (roundState.state === 'active') {
        const elapsed = now - roundState.startTime;
        if (elapsed >= config.roundTime) {
            endRound(io, map);
        }
    } else if (roundState.state === 'break') {
        if (now >= roundState.breakEndTime) {
            if (map.players.data.length >= config.minPlayersToStart) {
                startRound(io, map);
            } else {
                roundState.state = 'waiting';
            }
        }
    }
}

function startRound(io, map) {
    roundState.state = 'active';
    roundState.roundNumber++;
    roundState.startTime = Date.now();
    
    io.emit('serverMSG', '🎮 ROUND ' + roundState.roundNumber + ' STARTED! 10 minutes to win!');
    io.emit('newRound', { roundNumber: roundState.roundNumber });
}

function endRound(io, map) {
    roundState.state = 'break';
    roundState.breakEndTime = Date.now() + config.roundBreakTime;
    
    // Find winner
    if (map.players.data.length > 0) {
        map.players.data.sort((a, b) => b.massTotal - a.massTotal);
        const winner = map.players.data[0];
        
        io.emit('roundEnd', {
            winner: {
                name: winner.name || 'Anonymous',
                mass: Math.round(winner.massTotal)
            },
            roundNumber: roundState.roundNumber
        });
        
        io.emit('serverMSG', '🏆 WINNER: ' + winner.name + ' with ' + Math.round(winner.massTotal) + ' mass!');
    }
    
    // Clear all players
    map.players.data.forEach(player => {
        if (io.sockets.sockets.get(player.id)) {
            io.sockets.sockets.get(player.id).emit('RIP');
        }
    });
    map.players.data = [];
}

function getStatus() {
    const now = Date.now();
    
    if (roundState.state === 'waiting') {
        return {
            state: 'waiting',
            playersConnected: roundState.playerCount,
            playersNeeded: config.minPlayersToStart
        };
    } else if (roundState.state === 'active') {
        const elapsed = now - roundState.startTime;
        const remaining = Math.max(0, config.roundTime - elapsed);
        return {
            state: 'active',
            roundNumber: roundState.roundNumber,
            timeRemaining: Math.floor(remaining / 1000)
        };
    } else if (roundState.state === 'break') {
        const remaining = Math.max(0, roundState.breakEndTime - now);
        return {
            state: 'break',
            timeRemaining: Math.floor(remaining / 1000)
        };
    }
}

module.exports = {
    checkRoundState,
    getStatus,
    roundState
};
