const { expo } = require('./app.json');

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  ...expo,
  name: IS_DEV ? 'KonaFit Test' : expo.name,
  android: {
    ...expo.android,
    package: IS_DEV ? 'com.syreeseofficial.konafit.test' : expo.android.package,
  },
};
