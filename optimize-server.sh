#!/bin/bash

# 1. Nastav server na performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# 2. Zvýš network buffer
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
sudo sysctl -w net.core.netdev_max_backlog=5000
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr

# 3. Optimalizuj Node.js
export UV_THREADPOOL_SIZE=8
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=3584 --expose-gc"

echo "✅ Server optimalizovaný!"
