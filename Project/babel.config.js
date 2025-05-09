module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // If needed, add plugins to control import order
    plugins: [
      // Add any existing plugins here
    ],
  };
};
