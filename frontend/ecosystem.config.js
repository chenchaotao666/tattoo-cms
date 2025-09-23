module.exports = {
  apps: [
    {
      name: 'tattoo-cms-frontend-dev',
      script: 'npm',
      args: 'run start:dev',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 8000,
        REACT_APP_ENV: 'dev',
        UMI_ENV: 'dev'
      },
      error_file: './logs/frontend-dev-err.log',
      out_file: './logs/frontend-dev-out.log',
      log_file: './logs/frontend-dev-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    },
    {
      name: 'tattoo-cms-frontend-prod',
      script: 'node_modules/umi-serve/bin/umi-serve.js',
      args: 'dist --port 8000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      // 进程管理配置
      min_uptime: '10s',
      max_restarts: 10,
      // 健康检查
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/tattoo-cms.git',
      path: '/var/www/tattoo-cms',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}