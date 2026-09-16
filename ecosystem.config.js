module.exports = {
  apps: [
    {
      name:        'seo1-backend',
      script:      'src/index.js',
      cwd:         './backend',
      env: {
        NODE_ENV: 'production',
      },
      // Tự restart nếu crash
      autorestart:  true,
      max_restarts: 10,
      watch:        false,
    },
    {
      name:        'seo1-admin',
      script:      'node_modules/.bin/next',
      args:        'start -p 3000',
      cwd:         './admin',
      env: {
        NODE_ENV: 'production',
      },
      autorestart:  true,
      max_restarts: 10,
      watch:        false,
    },
  ],
}
