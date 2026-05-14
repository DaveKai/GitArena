module.exports = {
  apps: [
    {
      name: 'gitarena-backend',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'gitarena-frontend',
      script: 'npx',
      args: 'vite --host',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
