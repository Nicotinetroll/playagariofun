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
    gameWidth: 3000,  // Always small
    gameHeight: 3000, // Always small
    adminPass: "kokot",
    gameMass: 15000,
    maxFood: 400,
    maxVirus: 20,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 30,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: false,
    newPlayerInitialPosition: "random",
    massLossRate: 1,
    minMassLoss: 50,
    maxPlayers: 30,
    // Round settings
    roundTime: 600000,  // 10 minutes
    roundEndWarning: 60000,
    roundBreakTime: 60000,
    minPlayersToStart: 5,
    enableRounds: true,
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
