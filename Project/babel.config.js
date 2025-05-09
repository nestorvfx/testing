module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Add plugins to control import order and remove console statements in production
    plugins: [
      // Add any existing plugins here
      ['transform-remove-console', { exclude: ['error', 'warn'] }]
    ],
    env: {
      production: {
        plugins: ['transform-remove-console']
      }
    }
  };
};
