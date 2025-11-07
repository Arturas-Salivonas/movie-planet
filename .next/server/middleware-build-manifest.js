self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [
    "static/chunks/runtime.js",
    "static/chunks/vendors.js",
    "static/chunks/main-app.js"
  ],
  "pages": {
    "/_app": []
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];