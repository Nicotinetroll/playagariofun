#!/bin/bash

echo "🎮 Adding timer and waiting room back..."

# 1. Enable rounds in config
echo "📝 Enabling round system..."
sed -i 's/enableRounds: false/enableRounds: true/' config.js

# 2. Make sure timer HTML exists
echo "📝 Checking timer HTML..."
if ! grep -q "roundTimer" src/client/index.html; then
    # Add timer div after body tag
    sed -i '/<body>/a\    <!-- Round Timer -->\n    <div id="roundTimer" style="display: none;">\n        <span class="round-status">WAITING FOR PLAYERS</span>\n        <span class="time-display">0/5 Players</span>\n    </div>' src/client/index.html
fi

# 3. Add timer handling to client
echo "📝 Adding timer to client..."
cat >> src/client/js/app.js << 'EOF'

// Round timer handling
var roundTimer = document.getElementById('roundTimer');
if (roundTimer && socket) {
    socket.on('gameStatus', function(status) {
        if (!roundTimer) return;
        
        roundTimer.style.display = 'block';
        
        if (status.state === 'waiting') {
            roundTimer.className = 'waiting';
            roundTimer.querySelector('.round-status').textContent = 'WAITING FOR PLAYERS';
            roundTimer.querySelector('.time-display').textContent = status.playersConnected + '/' + status.playersNeeded + ' Players';
        } else if (status.state === 'active') {
            roundTimer.className = status.timeRemaining <= 60 ? 'warning' : 'active';
            roundTimer.querySelector('.round-status').textContent = 'ROUND ' + status.roundNumber;
            var minutes = Math.floor(status.timeRemaining / 60);
            var seconds = status.timeRemaining % 60;
            roundTimer.querySelector('.time-display').textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        } else if (status.state === 'break') {
            roundTimer.className = 'break';
            roundTimer.querySelector('.round-status').textContent = 'ROUND BREAK';
            roundTimer.querySelector('.time-display').textContent = 'Next round in ' + status.timeRemaining + 's';
        }
    });
}
EOF

# 4. Create simple round server
echo "📝 Creating server with rounds..."
cat > src/server/round-server.js << 'EOF'
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
EOF

# 5. Update main server to use rounds
echo "📝 Updating server to use rounds..."
sed -i '1s/^/const rounds = require(".\/round-server");\n/' src/server/server.js

# Add round checking to gameloop
sed -i '/const gameloop = /,/^};/c\
const gameloop = () => {\
    if (map.players.data.length > 0) {\
        calculateLeaderboard();\
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);\
    }\
    \
    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, config.maxVirus);\
    \
    // Check rounds\
    if (config.enableRounds) {\
        rounds.checkRoundState(io, map);\
        rounds.roundState.playerCount = map.players.data.length;\
        io.emit("gameStatus", rounds.getStatus());\
    }\
};' src/server/server.js

# 6. Build and restart
echo "🔨 Building..."
npm run build

echo "🔄 Restarting..."
pm2 restart all

echo "✅ Timer and waiting room added back!"
echo ""
echo "Features now active:"
echo "  ✅ Timer at top of screen"
echo "  ✅ Waiting room (0/5 players)"
echo "  ✅ 10-minute rounds"
echo "  ✅ 1-minute break between rounds"
echo ""
echo "The timer should now show at the top!"
