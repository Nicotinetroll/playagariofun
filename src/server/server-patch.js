// Na začiatok server.js pridaj
const skins = [
    "https://i.imgur.com/zAOoOR6.png",
    "https://i.imgur.com/yDG1S2F.png",
    "https://i.imgur.com/a3a7lbR.png",
    "https://i.imgur.com/3giEfRY.png",
    "https://i.imgur.com/9WprJah.png",
    "https://i.imgur.com/xSOW2iR.png",
    "https://i.imgur.com/QaXMPh2.png",
    "https://i.imgur.com/0kVikzs.png",
    "https://i.imgur.com/pn6Uh3j.png",
    "https://i.imgur.com/uPIA36l.png",
    "https://i.imgur.com/q7ayjDZ.png",
    "https://i.imgur.com/Mpha1rE.png",
    "https://i.imgur.com/YOpUlnO.png",
    "https://i.imgur.com/rBgtCVV.png",
    "https://i.imgur.com/a4RmMmz.png"
];

function getRandomSkin() {
    return skins[Math.floor(Math.random() * skins.length)];
}

// V addPlayer funkcii pri "gotit" pridaj:
currentPlayer.skin = getRandomSkin();

// Pri posielaní dát klientovi uprav:
// V serverTellPlayerMove pridaj skin do userData
for (var i = 0; i < users.length; i++) {
    users[i].skin = users[i].skin || null;
}
