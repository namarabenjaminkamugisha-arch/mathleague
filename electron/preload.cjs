// preload.cjs — deliberately tiny.
// The game is pure front-end and stores progress in localStorage, so the
// renderer needs no privileged APIs. We expose only a version string.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mathleague', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
