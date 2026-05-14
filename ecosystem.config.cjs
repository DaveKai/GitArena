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
    {
      name: 'gitarena-demo',
      script: 'npx',
      args: 'tsx server/index.ts',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        PORT: '3003',
        SERVE_STATIC: '1',
        GITARENA_PAT: 'demo',
        GITARENA_ORG: '',
      },
    },
  ],
};
