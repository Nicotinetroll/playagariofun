const fs = require('fs');

let code = fs.readFileSync('bin/server/player_enhanced.js', 'utf8');

// Nájdi a oprav problém okolo predict funkcie
code = code.replace(/\}\s*\}\s*predict\(player\)/g, '}\n    \n    predict(player)');

// Uisti sa že súbor končí správne
if (!code.includes('module.exports = EnhancedPlayer')) {
    code = code.replace(/module\.exports = EnhancedPlayer;[\s\S]*$/g, '');
    code += '\nmodule.exports = EnhancedPlayer;\n';
}

fs.writeFileSync('bin/server/player_enhanced.js', code);
console.log('Fixed!');
