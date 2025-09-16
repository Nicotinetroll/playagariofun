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
    gameWidth: 2500,
    gameHeight: 2500,
    adminPass: "kokot",
    gameMass: 15000,  // Znížené pre lepší výkon
    maxFood: 250,     // Menej jedla = lepší výkon
    maxVirus: 10,     // Menej vírusov
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 25,  // Menej network updatov
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 1,
    minMassLoss: 50,
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
