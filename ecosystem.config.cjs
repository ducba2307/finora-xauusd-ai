module.exports = {
  apps: [
    {
      name: 'finora-xauusd-ai',
      cwd: __dirname,
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 4173 --host',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
