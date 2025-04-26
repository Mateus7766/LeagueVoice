import { app, BrowserWindow, session, ipcMain } from 'electron/main'
import path from 'node:path'
import LoL from "./LoL.js"


function createWindow() {
    const win = new BrowserWindow({
        icon: path.join(__dirname, '../images/logo.png'),
        autoHideMenuBar: true,
        width: 600,
        height: 400,
        resizable: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    
    win.loadFile('../public/NotGame.html')
    LoL.Window = win
}

app.whenReady().then(() => {
    createWindow()

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
        } else {
            callback(false);
        }
    });

    ipcMain.handle("minimize", (event) =>
        BrowserWindow.getFocusedWindow()?.minimize()
    )
    ipcMain.handle("close", (event) => BrowserWindow.getFocusedWindow()?.close());
    ipcMain.handle("maxmize", (event) =>
        !BrowserWindow.getFocusedWindow()?.isMaximized() ? BrowserWindow.getFocusedWindow()?.maximize() : BrowserWindow.getFocusedWindow()?.unmaximize()
    );

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})