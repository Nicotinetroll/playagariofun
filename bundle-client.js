const fs = require('fs');

// Read all client files
const globalJs = fs.readFileSync('src/client/js/global.js', 'utf8');
const renderJs = fs.readFileSync('src/client/js/render.js', 'utf8');
const canvasJs = fs.readFileSync('src/client/js/canvas.js', 'utf8');
const chatClientJs = fs.readFileSync('src/client/js/chat-client.js', 'utf8');
const appJs = fs.readFileSync('src/client/js/app.js', 'utf8');

// Fix the isUnnamedCell function
const fixedAppJs = appJs.replace(
    'const isUnnamedCell = (name) => name.length < 1;',
    'const isUnnamedCell = (name) => !name || name.length < 1;'
);

// Create bundled version
const bundled = `
(function() {
    // Module system
    var modules = {};
    var require = function(name) {
        return modules[name];
    };
    
    // Global module
    modules['./global'] = (function() {
        ${globalJs.replace(/module\.exports\s*=/, 'return')}
    })();
    
    // Render module
    modules['./render'] = (function() {
        var module = { exports: {} };
        ${renderJs}
        return module.exports;
    })();
    
    // Canvas module
    modules['./canvas'] = (function() {
        var global = modules['./global'];
        var module = { exports: {} };
        var Canvas = ${canvasJs
            .replace(/var global = require\('\.\/global'\);/, '')
            .replace(/module\.exports = Canvas;/, 'Canvas;')}
        return Canvas;
    })();
    
    // Chat client module
    modules['./chat-client'] = (function() {
        var global = modules['./global'];
        var module = { exports: {} };
        var ChatClient = ${chatClientJs
            .replace(/var global = require\('\.\/global'\);/, '')
            .replace(/module\.exports = ChatClient;/, 'ChatClient;')}
        return ChatClient;
    })();
    
    // Socket.io client wrapper
    modules['socket.io-client'] = (function() {
        return function(options) {
            var opts = options || {};
            
            if (opts.query) {
                var queryString = '';
                for (var key in opts.query) {
                    if (queryString) queryString += '&';
                    queryString += key + '=' + opts.query[key];
                }
                
                return io(window.location.protocol + '//' + window.location.host, {
                    query: opts.query,
                    transports: ['websocket', 'polling'],
                    upgrade: true,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000
                });
            }
            
            return io(window.location.protocol + '//' + window.location.host);
        };
    })();
    
    // Settings object
    window.settings = {
        toggleMass: function() {
            var global = modules['./global'];
            global.toggleMassState = global.toggleMassState === 0 ? 1 : 0;
        },
        toggleBorder: function() {
            var global = modules['./global'];
            global.borderDraw = !global.borderDraw;
        },
        toggleRoundFood: function() {
            var global = modules['./global'];
            global.foodSides = global.foodSides < 10 ? 10 : 5;
        },
        toggleContinuity: function() {
            var global = modules['./global'];
            global.continuity = !global.continuity;
        }
    };
    
    // Main app with FIXED isUnnamedCell
    (function() {
        var io = modules['socket.io-client'];
        var render = modules['./render'];
        var ChatClient = modules['./chat-client'];
        var Canvas = modules['./canvas'];
        var global = modules['./global'];
        
        // FIX: Safe isUnnamedCell function
        const isUnnamedCell = function(name) {
            return !name || typeof name !== 'string' || name.length < 1;
        };
        
        ${fixedAppJs
            .replace(/var io = require\('socket\.io-client'\);/, '')
            .replace(/var render = require\('\.\/render'\);/, '')
            .replace(/var ChatClient = require\('\.\/chat-client'\);/, '')
            .replace(/var Canvas = require\('\.\/canvas'\);/, '')
            .replace(/var global = require\('\.\/global'\);/, '')
            .replace(/const isUnnamedCell = \(name\) => name\.length < 1;/, '')}
    })();
})();
`;

fs.writeFileSync('bin/client/js/app.js', bundled);
console.log('Client bundle fixed!');
