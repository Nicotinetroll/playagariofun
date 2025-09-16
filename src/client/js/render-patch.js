// Pridaj toto do render.js do funkcie drawCells hneď za vykreslenie kruhu:

// Po tomto riadku:
// drawRoundObject(cell, cell.radius, graph);

// Pridaj:
try {
    const skinModule = require('./skin-loader');
    if (cell.name) {
        skinModule.drawSkin(graph, cell.x, cell.y, cell.radius * 0.9, cell.name);
    }
} catch(e) {
    // Fallback ak skiny nefungujú
}
