const { app, BrowserWindow, screen } = require('electron')
const path = require('path')

interval = undefined;
app.allowRendererProcessReuse = false

function createWindow() {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        },
        frame: false,
        transparent: true,
        minimizable: false,
        alwaysOnTop: true,
        hasShadow: false,
    })
    win.loadFile('index.html')

    win.setIgnoreMouseEvents(true)
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "floating", 1);
    win.setFullScreenable(false);
    win.maximize()
    app.dock.show()

    interval = setInterval(() => {
        var mousepos = screen.getCursorScreenPoint()
        mousepos.x -= 8;
        mousepos.y -= 36;
        if(open)
            win.webContents.send('mouse', mousepos);
    }, 33);
}

app.on('window-all-closed', function () {
    app.quit()
    open = false;
    clearInterval(interval)
})

app.whenReady().then(() => {
    createWindow()
    open = true

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})