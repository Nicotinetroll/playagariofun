const fs = require('fs');

let clientBundle = fs.readFileSync('bin/client/js/app.js', 'utf8');

// Oprav socket connection aby posielal správny typ
clientBundle = clientBundle.replace(
    'socket = io({ query: "type=" + type });',
    'socket = io(window.location.origin, { query: { type: type } });'
);

// Ak to nenájde, skús iný pattern
if (!clientBundle.includes('window.location.origin')) {
    clientBundle = clientBundle.replace(
        'return io(window.location.protocol',
        'return io(window.location.origin || window.location.protocol'
    );
}

fs.writeFileSync('bin/client/js/app.js', clientBundle);
console.log('Client fixed!');
