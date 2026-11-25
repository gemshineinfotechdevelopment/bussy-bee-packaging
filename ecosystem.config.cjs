/**
 * PM2 Process Manager Ecosystem Configuration
 * For Bussy Bee Application on VPS
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production
 *   pm2 logs bussy-bee-api
 *   pm2 status
 */

module.exports = {
  apps: [
    {
      name: 'bussy-bee-api',
      script: './server/dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      exp_backoff_restart_delay: 100,

      // Environment variables passed to backend
      env: {
        NODE_ENV: 'development',
        PORT: 5035,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5035,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/bussy_bee',
      },

      // Logging configuration
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};
