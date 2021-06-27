const electron = require('electron')
const BrowserWindow = electron.remote.BrowserWindow;
const win = BrowserWindow.getAllWindows()[0];

const TransparencyMouseFix = require('electron-transparency-mouse-fix')
const fix = new TransparencyMouseFix({
    log: true,
    fixPointerEvents: 'auto'
})

let canvas = document.getElementById('canvas')
hitb = document.getElementById('hitbox')
hitb.onclick = function () {
    fishes[0].click();
}
hitb.onmouseover = () => {
    fishes[0].moving = false;
}
hitb.onmouseleave = () => {
    fishes[0].moving = true;
}
var [width, height] = win.getSize();
width -= 10;
height -= 20;
this.canvas.width = width;
this.canvas.height = height;
let ctx = canvas.getContext('2d')

mouse = {
    x: -100,
    y: -100
}
electron.ipcRenderer.on('mouse', function (event, data) {
    mouse = data;
});

var fishes = []
// setInterval(() => {
//     ctx.clearRect(0, 0, width, height);
//     for (fish of fishes) {
//         fish.update(33, ctx)
//     }
// }, 33)

function update() {
    newtime = performance.now()
    delta = newtime - time
    time = newtime

    ctx.clearRect(0, 0, width, height);
    for (fish of fishes) {
        fish.update(delta, ctx)
    }
    window.requestAnimationFrame(update)
}
time = performance.now()
window.requestAnimationFrame(update)

class Fish {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 1;
        this.vy = 1;
        this.radius = 40;
        this.color = 'green';
        this.moving = true;
    }

    click() {
        this.color = '#' + Math.floor(Math.random() * 16777215).toString(16);
    }

    update(delta, ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        var l = 30
        ctx.quadraticCurveTo(this.x - this.vx * l, this.y - this.vy * l, this.x - this.vx * l * .7, this.y - this.vy * l * 2.2);
        ctx.quadraticCurveTo(this.x - this.vx * l * 1.5, this.y - this.vy * l * 1.5, this.x - this.vx * l * 2.2, this.y - this.vy * l * .7);
        ctx.quadraticCurveTo(this.x - this.vx * l, this.y - this.vy * l, this.x, this.y);
        ctx.fill();

        ctx.fillStyle = "black";
        ctx.fillRect(this.x - 8, this.y - 15, 5, 20)
        ctx.fillRect(this.x + 8, this.y - 15, -5, 20)

        ctx.beginPath();
        ctx.arc(this.x, this.y + 10, this.radius * .6, 0, Math.PI, false);
        ctx.fill();

        //if(Math.pow(mouse.x - this.x, 2) + Math.pow(mouse.y - this.y, 2) < this.radius * this.radius)
        if (!this.moving)
            return;

        this.x += this.vx * delta / 5;
        this.y += this.vy * delta / 5;

        //=====TEMP======
        hitb.style.top = (this.y - 50) + "px";
        hitb.style.left = (this.x - 50) + "px";

        if (this.x < this.radius)
            this.vx *= -1
        if (this.x > width - this.radius)
            this.vx *= -1
        if (this.y < this.radius)
            this.vy *= -1
        if (this.y > height - this.radius)
            this.vy *= -1
    }
}

fishes.push(new Fish(100, 100))