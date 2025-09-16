// Spectator zoom controls
if (global.playerType === 'spectator') {
    let currentZoom = 1;
    const minZoom = 0.5;
    const maxZoom = 3;
    
    window.addEventListener('wheel', function(e) {
        if (global.playerType !== 'spectator') return;
        
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom * delta));
        
        // Update camera
        const baseWidth = config.gameWidth || 3750;
        const baseHeight = config.gameHeight || 3750;
        
        global.screen.width = baseWidth / currentZoom;
        global.screen.height = baseHeight / currentZoom;
        
        if (c) {
            c.width = global.screen.width;
            c.height = global.screen.height;
        }
    });
    
    // WASD pre pohyb kamery v spectator mode
    const keys = {};
    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);
    
    setInterval(() => {
        if (global.playerType !== 'spectator') return;
        
        const speed = 20;
        if (keys['w'] || keys['W']) player.y -= speed;
        if (keys['s'] || keys['S']) player.y += speed;
        if (keys['a'] || keys['A']) player.x -= speed;
        if (keys['d'] || keys['D']) player.x += speed;
        
        // Limit to map boundaries
        const halfWidth = global.screen.width / 2;
        const halfHeight = global.screen.height / 2;
        player.x = Math.max(halfWidth, Math.min(config.gameWidth - halfWidth, player.x));
        player.y = Math.max(halfHeight, Math.min(config.gameHeight - halfHeight, player.y));
    }, 1000/60);
}
