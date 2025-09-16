const FULL_ANGLE = 2 * Math.PI;

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    drawRoundObject(position, food.radius, graph);
};

const drawVirus = (position, virus, graph) => {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    let theta = 0;
    let sides = 20;

    graph.beginPath();
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
        let point = circlePoint(position, virus.radius, theta);
        graph.lineTo(point.x, point.y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

const drawCellWithLines = (cell, borders, graph) => {
    let pointCount = 30 + ~~(cell.mass / 5);
    let points = [];
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
        let point = circlePoint(cell, cell.radius, theta);
        points.push(regulatePoint(point, borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        graph.lineTo(points[i].x, points[i].y);
    }
    graph.closePath();
    graph.fill();
    graph.stroke();
}

// Format name for display
const formatNameForDisplay = (name) => {
    if (!name || name.length === 0) return "Guest";
    
    // Check if it's a SOL address (32-44 chars, base58)
    if (name.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(name)) {
        return name.substring(0, 4) + '...' + name.substring(name.length - 4);
    }
    
    // For guest names or other formats, show up to 15 chars
    if (name.length > 15) {
        return name.substring(0, 12) + '...';
    }
    
    return name;
}

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    // Skin URLs
    const skins = [
        "https://i.imgur.com/zAOoOR6.png",
        "https://i.imgur.com/yDG1S2F.png",
        "https://i.imgur.com/a3a7lbR.png",
        "https://i.imgur.com/3giEfRY.png"
    ];
    
    const skinCache = window.skinCache || (window.skinCache = {});
    const playerSkins = window.playerSkins || (window.playerSkins = {});
    
    for (let cell of cells) {
        // Draw cell background
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth = 6;
        
        graph.beginPath();
        graph.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
        graph.closePath();
        graph.fill();
        graph.stroke();
        
        // Try to draw skin
        if (cell.name) {
            if (!playerSkins[cell.name]) {
                const skinUrl = skins[Math.floor(Math.random() * skins.length)];
                playerSkins[cell.name] = skinUrl;
                
                if (!skinCache[skinUrl]) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => skinCache[skinUrl] = img;
                    img.src = skinUrl;
                }
            }
            
            const img = skinCache[playerSkins[cell.name]];
            if (img && img.complete) {
                graph.save();
                graph.beginPath();
                graph.arc(cell.x, cell.y, cell.radius * 0.9, 0, Math.PI * 2);
                graph.closePath();
                graph.clip();
                graph.drawImage(img, cell.x - cell.radius * 0.9, cell.y - cell.radius * 0.9, cell.radius * 1.8, cell.radius * 1.8);
                graph.restore();
            }
        }
        
        // Draw name
        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = "round";
        graph.textAlign = "center";
        graph.textBaseline = "middle";
        graph.font = "bold " + fontSize + "px sans-serif";
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);
        
        if (toggleMassState === 1) {
            graph.font = "bold " + Math.max(fontSize / 3 * 2, 10) + "px sans-serif";
            if (cell.name.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#000000'
    graph.beginPath()
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath()
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder
};

// Cache pre načítané obrázky
const skinCache = {};

const loadSkin = (url, callback) => {
    if (skinCache[url]) {
        callback(skinCache[url]);
        return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        skinCache[url] = img;
        callback(img);
    };
    img.onerror = () => {
        console.error('Failed to load skin:', url);
        callback(null);
    };
    img.src = url;
};

// Uprav drawCells funkciu
const originalDrawCells = module.exports.drawCells;
module.exports.drawCells = function(cells, playerConfig, toggleMassState, borders, graph) {
    // Najprv vykresli normálne bunky
    originalDrawCells(cells, playerConfig, toggleMassState, borders, graph);
    
    // Potom pridaj skiny
    cells.forEach(cell => {
        if (cell.skin) {
            loadSkin(cell.skin, (img) => {
                if (img) {
                    const size = cell.radius * 2;
                    graph.save();
                    graph.globalAlpha = 0.8;
                    graph.beginPath();
                    graph.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                    graph.closePath();
                    graph.clip();
                    graph.drawImage(img, cell.x - cell.radius, cell.y - cell.radius, size, size);
                    graph.restore();
                }
            });
        }
    });
};
