const fs = require('fs');

// Optimalizuj app.js bundle
let appBundle = fs.readFileSync('bin/client/js/app.js', 'utf8');

// Zníž FPS na klientovi ak je to možné
if (appBundle.includes('window.requestAnimFrame')) {
    appBundle = appBundle.replace(
        'window.setTimeout(callback, 1000 / 60);',
        'window.setTimeout(callback, 1000 / 30);' // 30 FPS namiesto 60
    );
}

fs.writeFileSync('bin/client/js/app.js', appBundle);
console.log('Client optimized!');
