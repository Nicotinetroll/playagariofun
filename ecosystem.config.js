module.exports = {
  apps: [{
    name: 'agar-server',
    script: './src/server/server.js',
    instances: 1,  // Len 1 inštancia namiesto 2
    exec_mode: 'fork',  // Fork namiesto cluster
    max_memory_restart: '500M',  // Reštartuj ak použije viac ako 500MB
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    merge_logs: true,
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
