console.log("Testing server syntax...");
try {
    require('./bin/server/server.js');
    console.log("Server syntax OK!");
} catch(e) {
    console.error("Server syntax error:", e.message);
    console.error("At line:", e.stack.split('\n')[0]);
}
