module.exports = {
    host: "0.0.0.0",
    port: 3000,
    logpath: "logger.php",
    foodMass: 1,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
    virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
    },
    gameWidth: 3750,            // ZMENA - zväčšené o 50%
    gameHeight: 3750,           // ZMENA - zväčšené o 50%
    adminPass: "kokot",
    gameMass: 15000,            // ZMENA - viac masy pre väčšiu mapu
    maxFood: 750,               // ZMENA - viac jedla pre väčšiu mapu
    maxVirus: 35,               // ZMENA - viac vírusov pre väčšiu mapu
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 1,
    minMassLoss: 50,
    enableRounds: true,
    minPlayersToStart: 3,
    roundTime: 120000,          // 2 minúty
    roundBreakTime: 30000,      // 30 sekúnd prestávka
    spectatorZoom: 2.5,         // NOVÉ - zoom pre spectator mode
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
