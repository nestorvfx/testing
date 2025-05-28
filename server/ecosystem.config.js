module.exports = {
  apps: [{
    name: 'photo-and-analyze-server',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logging configuration
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Process management
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Standard PM2 features
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Log rotation
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    
    // Environment specific settings
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
