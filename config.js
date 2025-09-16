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
    gameWidth: 2500,            // ZMENA - polovičná šírka
    gameHeight: 2500,           // ZMENA - polovičná výška
    adminPass: "kokot",
    gameMass: 10000,            // ZMENA - menej masy pre menšiu mapu
    maxFood: 500,               // ZMENA - menej jedla pre menšiu mapu
    maxVirus: 25,               // ZMENA - menej vírusov pre menšiu mapu
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
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
