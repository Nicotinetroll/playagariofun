const fs = require('fs');

let botCode = fs.readFileSync('bin/server/player_enhanced.js', 'utf8');

// Skontroluj počet { a }
const openBraces = (botCode.match(/{/g) || []).length;
const closeBraces = (botCode.match(/}/g) || []).length;

console.log('Open braces:', openBraces);
console.log('Close braces:', closeBraces);

if (openBraces !== closeBraces) {
    console.log('Fixing brace mismatch...');
    
    // Pridaj chýbajúce uzatváracie zátvorky na koniec
    const missing = openBraces - closeBraces;
    for (let i = 0; i < missing; i++) {
        botCode += '\n}';
    }
    
    fs.writeFileSync('bin/server/player_enhanced.js', botCode);
    console.log('Fixed! Added', missing, 'closing braces');
} else {
    console.log('Braces are balanced, checking other issues...');
}
