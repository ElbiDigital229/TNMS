module.exports = {
  apps: [{
    name: "tnms",
    script: "dist/server/index.js",
    cwd: "/home/ubuntu/TNMS",
    node_args: "--max-old-space-size=384",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    max_memory_restart: "400M",
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: "10s",
    autorestart: true,
  }],
};
