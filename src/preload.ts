const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (arg0: any) => any) => {
      let validChannels = ["league-open", "league-closed", "champ-select-entered", "game-ended"];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event: Electron.IpcRendererEvent, ...args: [any]) => func(...args));
      }
    },
    send: (channel: string, data: any) => {
      let validChannels = ["isPlaying", "game-ended"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel: string, data: any) => {
      let validChannels = ["isPlaying", "game-ended"];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
  }
});
