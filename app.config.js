const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  "name": IS_DEV ? 'KonaFit Test' : 'KonaFit',
  "slug": "konafit",
  "version": "1.0.0",
  "scheme": "konafit",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "automatic",
  "backgroundColor": "#F8FAFC",
  "ios": {
    "supportsTablet": false
  },
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#0A0A0A",
      "foregroundImage": "./assets/android-icon-foreground.png",
      "backgroundImage": "./assets/android-icon-background.png",
      "monochromeImage": "./assets/android-icon-monochrome.png"
    },
    "predictiveBackGestureEnabled": false,
    "package": IS_DEV ? 'com.syreeseofficial.konafit.test' : 'com.syreeseofficial.konafit'
  },
  "web": {
    "favicon": "./assets/favicon.png"
  },
  "plugins": [
    "expo-router",
    "expo-sqlite",
    "expo-font",
    [
      "expo-image-picker",
      {
        "photosPermission": "KonaFit needs access to your photos to save progress photos.",
        "cameraPermission": "KonaFit needs camera access to take progress photos."
      }
    ]
  ],
  "extra": {
    "router": {},
    "eas": {
      "projectId": "07288a9e-0a36-4e52-afdb-646bac832915"
    }
  }
};
