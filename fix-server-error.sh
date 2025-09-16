#!/bin/bash

echo "🔧 Fixing server error with undefined player name..."

# Fix the disconnect handler in server.js
sed -i 's/console.log.*User.*currentPlayer\.name.*has disconnected.*/if (currentPlayer \&\& currentPlayer.name) console.log("[INFO] User " + currentPlayer.name + " has disconnected");/' src/server/server.js

sed -i 's/socket\.broadcast\.emit.*playerDisconnect.*name: currentPlayer\.name.*/if (currentPlayer \&\& currentPlayer.name) socket.broadcast.emit("playerDisconnect", { name: currentPlayer.name });/' src/server/server.js

# Also fix the respawn handler
sed -i 's/console.log.*User.*currentPlayer\.name.*has respawned.*/if (currentPlayer \&\& currentPlayer.name) console.log("[INFO] User " + currentPlayer.name + " has respawned");/' src/server/server.js

# Rebuild and restart
npm run build
pm2 restart all

echo "✅ Fixed undefined name error"
echo ""
echo "The issue was that currentPlayer.name might not be set when disconnect happens"
echo "Now checking if name exists before using it"
