#!/bin/bash

echo "🎮 Final fixes for playagario.fun..."

# 1. UPDATE HTML TITLE AND FIX RANDOM NAMES
echo "📝 Updating HTML title and fixing random names..."
cat > src/client/index.html << 'EOF'
<!doctype html>
<html lang="en">
<head>
    <!-- Meta Properties -->
    <meta charset="UTF-8">
    <title>PlayAgario.fun - SOL Edition</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
    <!-- CSS -->
    <link rel="stylesheet" href="css/main.css" />
    <!-- Audio -->
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
            <input type="text" tabindex="0" autofocus placeholder="Enter your SOL address (or leave empty)" id="playerNameInput" maxlength="44" />
            <b class="input-error">Please enter a valid SOL address or leave empty!</b>
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
                    <li>Enter your Solana wallet address or play anonymously</li>
                    <li>Move your mouse to control your cell</li>
                    <li>Eat food and smaller players to grow</li>
                    <li>Press SPACE to split, W to eject mass</li>
                    <li>Avoid larger players and viruses</li>
                </ul>
            </div>
        </div>
    </div>
    <!-- JS -->
    <script src="//code.jquery.com/jquery-2.2.0.min.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
EOF

# 2. BUILD AND RESTART
echo "🔨 Rebuilding project..."
npm run build

echo "🔄 Restarting server..."
pm2 restart all

echo "✅ HTML title fixed to PlayAgario.fun!"
