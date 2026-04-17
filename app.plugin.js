// Expo treats the package's `app.plugin.js` as the default plugin entry.
// Re-export the compiled plugin so `"plugins": ["@signalseal/react-native"]`
// in app.json resolves correctly.
module.exports = require('./plugin/build').default
