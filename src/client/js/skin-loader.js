// Skin system pre Agar.io
const skins = [
    "https://i.imgur.com/zAOoOR6.png",
    "https://i.imgur.com/yDG1S2F.png",
    "https://i.imgur.com/a3a7lbR.png",
    "https://i.imgur.com/3giEfRY.png",
    "https://i.imgur.com/9WprJah.png",
    "https://i.imgur.com/xSOW2iR.png",
    "https://i.imgur.com/QaXMPh2.png",
    "https://i.imgur.com/0kVikzs.png"
];

const skinCache = {};
const playerSkins = {};

// Priraď náhodný skin hráčovi
function assignSkin(playerName) {
    if (!playerSkins[playerName]) {
        const skinUrl = skins[Math.floor(Math.random() * skins.length)];
        playerSkins[playerName] = skinUrl;
        
        // Preload obrázok
        if (!skinCache[skinUrl]) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                skinCache[skinUrl] = img;
            };
            img.src = skinUrl;
        }
    }
    return playerSkins[playerName];
}

// Vykresli skin na bunku
function drawSkin(ctx, x, y, radius, playerName) {
    const skinUrl = assignSkin(playerName || 'anonymous');
    const img = skinCache[skinUrl];
    
    if (img && img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Vykresli obrázok
        const size = radius * 2;
        ctx.drawImage(img, x - radius, y - radius, size, size);
        
        ctx.restore();
        return true;
    }
    return false;
}

module.exports = { drawSkin, assignSkin };
