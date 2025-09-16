#!/bin/bash

echo "🔧 Fixing socket error..."

# Fix the app.js socket handling
echo "📝 Fixing app.js socket handlers..."

# Remove the incorrectly added socket handlers at the end of app.js
sed -i '/\/\/ Round system client handling/,/^EOF$/d' src/client/js/app.js

# Now add the handlers in the RIGHT place - inside setupSocket function
# We need to insert them INSIDE the setupSocket function
cat > temp_socket_fix.js << 'EOF'
    // Round system handlers - ADD THESE INSIDE setupSocket
    socket.on('roundTimer', function(seconds) {
        var minutes = Math.floor(seconds / 60);
        var secs = seconds % 60;
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            timerElement.querySelector('.time-remaining').textContent = 
                minutes + ':' + (secs < 10 ? '0' : '') + secs;
            
            if (seconds <= 60) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        }
    });

    socket.on('roundInfo', function(data) {
        var roundNumber = data.roundNumber;
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            timerElement.querySelector('.round-number').textContent = 'ROUND ' + roundNumber;
        }
    });

    socket.on('roundEnd', function(data) {
        var modal = document.getElementById('winnerModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('winnerName').textContent = data.winner.name;
            document.getElementById('winnerMass').textContent = 'Mass: ' + data.winner.mass;
            
            var countdown = 10;
            var countdownInterval = setInterval(function() {
                countdown--;
                document.getElementById('countdown').textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    modal.classList.remove('show');
                }
            }, 1000);
        }
    });

    socket.on('newRound', function(data) {
        var roundNumber = data.roundNumber;
        var timerElement = document.getElementById('roundTimer');
        if (timerElement) {
            timerElement.querySelector('.round-number').textContent = 'ROUND ' + roundNumber;
        }
    });

    socket.on('canRespawn', function() {
        if (global.playerName) {
            socket.emit('respawn');
        }
    });
EOF

# Now insert these handlers right before the closing bracket of setupSocket function
# Find the line with "socket.on('kick'," and add after that block
sed -i '/socket\.on.*kick.*function.*reason/,/});$/{
    /});$/a\
\
    // Round system handlers\
    socket.on('\''roundTimer'\'', function(seconds) {\
        var minutes = Math.floor(seconds / 60);\
        var secs = seconds % 60;\
        var timerElement = document.getElementById('\''roundTimer'\'');\
        if (timerElement) {\
            timerElement.querySelector('\''.time-remaining'\'').textContent = \
                minutes + '\'':'\'' + (secs < 10 ? '\''0'\'' : '\'''\'') + secs;\
            \
            if (seconds <= 60) {\
                timerElement.classList.add('\''warning'\'');\
            } else {\
                timerElement.classList.remove('\''warning'\'');\
            }\
        }\
    });\
\
    socket.on('\''roundInfo'\'', function(data) {\
        var roundNumber = data.roundNumber;\
        var timerElement = document.getElementById('\''roundTimer'\'');\
        if (timerElement) {\
            timerElement.querySelector('\''.round-number'\'').textContent = '\''ROUND '\'' + roundNumber;\
        }\
    });\
\
    socket.on('\''roundEnd'\'', function(data) {\
        var modal = document.getElementById('\''winnerModal'\'');\
        if (modal) {\
            modal.classList.add('\''show'\'');\
            document.getElementById('\''winnerName'\'').textContent = data.winner.name;\
            document.getElementById('\''winnerMass'\'').textContent = '\''Mass: '\'' + data.winner.mass;\
            \
            var countdown = 10;\
            var countdownInterval = setInterval(function() {\
                countdown--;\
                document.getElementById('\''countdown'\'').textContent = countdown;\
                if (countdown <= 0) {\
                    clearInterval(countdownInterval);\
                    modal.classList.remove('\''show'\'');\
                }\
            }, 1000);\
        }\
    });\
\
    socket.on('\''newRound'\'', function(data) {\
        var roundNumber = data.roundNumber;\
        var timerElement = document.getElementById('\''roundTimer'\'');\
        if (timerElement) {\
            timerElement.querySelector('\''.round-number'\'').textContent = '\''ROUND '\'' + roundNumber;\
        }\
    });\
\
    socket.on('\''canRespawn'\'', function() {\
        if (global.playerName) {\
            socket.emit('\''respawn'\'');\
        }\
    });
}' src/client/js/app.js

# Also fix the HTML - make sure round timer div is properly added
echo "📝 Fixing HTML structure..."
# Check if roundTimer already exists, if not add it
if ! grep -q "roundTimer" src/client/index.html; then
    sed -i '/<div id="status">/i\        <div id="roundTimer">\n            <span class="round-number">ROUND 1</span>\n            <span class="time-remaining">10:00</span>\n        </div>' src/client/index.html
fi

# Check if winner modal exists, if not add it
if ! grep -q "winnerModal" src/client/index.html; then
    sed -i '/<\/body>/i\    <div class="winner-modal" id="winnerModal">\n        <div class="winner-content">\n            <h2>🏆 ROUND WINNER 🏆</h2>\n            <div class="winner-name" id="winnerName">Player Name</div>\n            <div class="winner-mass" id="winnerMass">Mass: 0</div>\n            <div class="next-round">Next round starting in <span id="countdown">10</span> seconds...</div>\n        </div>\n    </div>' src/client/index.html
fi

# Clean up temp file
rm -f temp_socket_fix.js

echo "🔨 Rebuilding..."
npm run build

echo "🔄 Restarting server..."
pm2 restart all

echo "✅ Socket error fixed!"
echo "  • Round handlers now properly inside setupSocket function"
echo "  • Timer and modal HTML elements added"
echo "  • Socket is now defined when handlers are added"
