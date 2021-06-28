const electron = require('electron')
const { Point, Vector, Circle, Line, Ray, Segment, Arc, Box, Polygon, Matrix, PlanarSet, Multiline } = require('@flatten-js/core')
const BrowserWindow = electron.remote.BrowserWindow
const win = BrowserWindow.getAllWindows()[0]

const TransparencyMouseFix = require('electron-transparency-mouse-fix')
const fix = new TransparencyMouseFix({
    log: true,
    fixPointerEvents: 'auto'
})


// hitb = document.getElementById('hitbox')
// hitb.onclick = () => fishes[0].click()
// hitb.onmouseover = () => fishes[0].moving = false
// hitb.onmouseleave = () => fishes[0].moving = true

var [width, height] = win.getSize()
width -= 10
height -= 20
let canvas = document.getElementById('canvas')
this.canvas.width = width
this.canvas.height = height
let ctx = canvas.getContext('2d')

topleft = new Point(0, 0)
topright = new Point(width, 0)
bottomleft = new Point(0, height)
bottomright = new Point(width, height)
wall = new Multiline([new Segment(topleft, topright), new Segment(topright, bottomright), new Segment(bottomright, bottomleft), new Segment(bottomleft, topleft)])

mouse = new Point(-100, -100)
electron.ipcRenderer.on('mouse', function (event, data) {
    mouse.x = data.x
    mouse.y = data.y
})

var objects = []

function update() {
    delta = performance.now() - time
    time += delta

    ctx.clearRect(0, 0, width, height)
    for (obj of objects)
        obj.update(delta, ctx)

    window.requestAnimationFrame(update)
}
time = performance.now()
window.requestAnimationFrame(update)

class Narwal {
    constructor(x, y) {
        this.pos = new Point(x, y)
        this.dir = new Vector(-1, -1).normalize()
        this.tailMid = this.dir.multiply(-43)
        this.tailEnd = this.dir.multiply(-50)
        this.angleVel = 0
        this.leftShift = 0
        this.reentry = 0
        this.animation = 0
    }

    update(delta, ctx) {
        this.animation += delta

        this.draw(true)
        this.draw()

        var angleChange = 0
        if (this.reentry == 0) {
            angleChange = this.angleVel

            var mouseAngle = angle(this.dir, new Vector(this.pos, mouse))
            var mouseWariness = Math.min(500, this.pos.distanceTo(mouse)[0]).map(0, 500, 10, 0) / Math.max(1, Math.abs(mouseAngle) * 4)
            // circle(ctx, this.pos.x, this.pos.y, mouseWariness * 2, "cyan")
            this.angleVel -= Math.sign(mouseAngle) * mouseWariness * mouseWariness / 1000

            var wallIntersectPoint = wallRaycast(new Ray(this.pos, this.dir.rotate90CCW()))

            var wallDist = 99999
            if (wallIntersectPoint == undefined)
                this.reentry = 1000
            else {
                var wallDist = new Vector(this.pos, wallIntersectPoint).length
                if (wallDist < 150) {
                    var leftRightCastPoint = new Point(this.pos.x * .1 + wallIntersectPoint.x * .9, this.pos.y * .1 + wallIntersectPoint.y * .9)
                    var wallDistLeft = wallRaycast(new Ray(leftRightCastPoint, this.dir.invert()))
                    var wallDistRight = wallRaycast(new Ray(leftRightCastPoint, this.dir))
                    wallDistLeft = new Vector(leftRightCastPoint, wallDistLeft).length + this.leftShift
                    wallDistRight = new Vector(leftRightCastPoint, wallDistRight).length
                    if (Math.abs(wallDistLeft - wallDistRight) < 10)
                        this.leftShift = Math.sign(Math.random() - .5) * 1000

                    this.angleVel += Math.sign(wallDistLeft - wallDistRight) * (150 - wallDist) / 1000
                }
            }

            this.angleVel *= (1 - delta / 1000 * 1.5)
            this.leftShift -= Math.sign(this.leftShift) * delta
        } else {
            if (this.reentry > 0) {
                //still leaving
                this.reentry -= delta
                if (this.reentry <= 0) {
                    this.dir = new Vector(0, 1).rotate(Math.random() * 2 * Math.PI)
                    this.newSpawn = new Point(width / 2, height / 2).translate(this.dir.multiply(-Math.max(width, height) - 100))
                    this.pos = this.newSpawn
                    this.reentryDist = new Vector(this.newSpawn, wallRaycast(new Ray(this.pos, this.dir.rotate90CCW()))).length
                }
            } else {
                //re entering
                if (this.reentryDist < new Vector(this.pos, this.newSpawn).length) {
                    this.reentry = 0
                    this.angleVel = 0
                    this.leftShift = 0
                }
            }
        }


        //movement and animation
        this.pos = this.pos.translate(this.dir.multiply(delta / 10))
        this.dir = this.dir.rotate(angleChange * delta / 1000)
        var midDelta = angle(this.tailMid, this.dir.invert())
        var endDelta = angle(this.tailEnd, this.dir.invert())
        this.tailMid = this.tailMid.rotate(midDelta * delta / 125 * midDelta * Math.sign(midDelta))
        this.tailEnd = this.tailEnd.rotate(endDelta * delta / 150 * endDelta * Math.sign(endDelta))
    }

    draw(outline = false) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#030303"

        var hornLeft = this.pos.translate(this.dir.rotate90CCW().multiply(12))
        var hornPoint = this.pos.translate(this.dir.multiply(50))
        var hornRight = this.pos.translate(this.dir.rotate90CW().multiply(12))
        var hornLeftHalf = new Point((hornLeft.x + hornPoint.x * 4) / 5, (hornLeft.y + hornPoint.y * 4) / 5);
        var hornRightHalf = new Point((hornRight.x + hornPoint.x * 4) / 5, (hornRight.y + hornPoint.y * 4) / 5);
        ctx.fillStyle = "#dcba82"
        ctx.beginPath()
        ctx.moveTo(hornLeft.x, hornLeft.y)

        ctx.lineTo(hornLeftHalf.x, hornLeftHalf.y)
        ctx.quadraticCurveTo(hornPoint.x, hornPoint.y, hornRightHalf.x, hornRightHalf.y)
        ctx.lineTo(hornRight.x, hornRight.y)
        if (outline)
            ctx.stroke()
        else
            ctx.fill()

        ctx.save()
        ctx.fillStyle = "#9ecbd6"
        ctx.beginPath()

        var wiggle = Math.sin(this.animation / 300) / 4
        var animatedMid = this.tailMid.rotate(wiggle / 2)
        var animatedEnd = this.tailEnd.rotate(wiggle)

        var endAngle = angle(this.tailEnd, this.dir.invert())
        var leftTailBase = this.pos.translate(this.dir.multiply(-30).rotate(-.85 - Math.max(endAngle, 0)))
        var leftTailBaseNormal = leftTailBase.translate(this.dir.multiply(15).rotate(-.85 - Math.max(endAngle, 0)).rotate90CW())
        var leftTailEnd = this.pos.translate(animatedEnd.add(animatedEnd.normalize().rotate90CW().multiply(8)))
        var leftTailMid = this.pos.translate(animatedMid.add(animatedMid.normalize().rotate90CW().multiply(4)))

        var rightTailBase = this.pos.translate(this.dir.multiply(-30).rotate(.85 + Math.max(-endAngle, 0)))
        var rightTailBaseNormal = rightTailBase.translate(this.dir.multiply(15).rotate(.85 + Math.max(-endAngle, 0)).rotate90CCW())
        var rightTailEnd = this.pos.translate(animatedEnd.add(animatedEnd.normalize().rotate90CCW().multiply(8)))
        var rightTailMid = this.pos.translate(animatedMid.add(animatedMid.normalize().rotate90CCW().multiply(4)))

        var tailAnimatedLeft = animatedEnd.rotate90CW().normalize().rotate(wiggle / 2)
        var tailAnimatedRight = tailAnimatedLeft.invert()

        var tailCenter = this.pos.translate(animatedEnd.multiply(1.17));
        var tailTipLeft = this.pos.translate(animatedEnd.multiply(1.27).add(tailAnimatedLeft.multiply(25)))
        var tailTipRight = this.pos.translate(animatedEnd.multiply(1.27).add(tailAnimatedRight.multiply(25)))
        var tailTipLeftLowerC = this.pos.translate(animatedEnd.multiply(1).add(tailAnimatedLeft.multiply(20)))
        var tailTipLeftUpperC = this.pos.translate(animatedEnd.multiply(1.33).add(tailAnimatedLeft.multiply(15)))
        var tailTipRightLowerC = this.pos.translate(animatedEnd.multiply(1).add(tailAnimatedRight.multiply(20)))
        var tailTipRightUpperC = this.pos.translate(animatedEnd.multiply(1.33).add(tailAnimatedRight.multiply(15)))
        ctx.moveTo(leftTailBase.x, leftTailBase.y)
        ctx.bezierCurveTo(leftTailBaseNormal.x, leftTailBaseNormal.y, leftTailMid.x, leftTailMid.y, leftTailEnd.x, leftTailEnd.y)
        ctx.quadraticCurveTo(tailTipLeftLowerC.x, tailTipLeftLowerC.y, tailTipLeft.x, tailTipLeft.y)
        ctx.quadraticCurveTo(tailTipLeftUpperC.x, tailTipLeftUpperC.y, tailCenter.x, tailCenter.y)
        ctx.quadraticCurveTo(tailTipRightUpperC.x, tailTipRightUpperC.y, tailTipRight.x, tailTipRight.y)
        ctx.quadraticCurveTo(tailTipRightLowerC.x, tailTipRightLowerC.y, rightTailEnd.x, rightTailEnd.y)
        ctx.bezierCurveTo(rightTailMid.x, rightTailMid.y, rightTailBaseNormal.x, rightTailBaseNormal.y, rightTailBase.x, rightTailBase.y)

        var rightTailBaseNormalInv = rightTailBase.translate(this.dir.multiply(-30).rotate(.85 + Math.max(-endAngle, 0)).rotate90CCW())
        var leftTailBaseNormalInv = leftTailBase.translate(this.dir.multiply(-30).rotate(-.85 - Math.max(endAngle, 0)).rotate90CW())
        var nose = this.pos.translate(this.dir.multiply(30))
        var noseRightNormal = this.pos.translate(this.dir.multiply(30).rotate(-.5))
        var noseLeftNormal = this.pos.translate(this.dir.multiply(30).rotate(.5))
        noseRightNormal = this.pos.translate(this.dir.multiply(30).add(this.dir.rotate90CW().multiply(20)))
        noseLeftNormal = this.pos.translate(this.dir.multiply(30).add(this.dir.rotate90CCW().multiply(20)))

        ctx.bezierCurveTo(rightTailBaseNormalInv.x, rightTailBaseNormalInv.y, noseRightNormal.x, noseRightNormal.y, nose.x, nose.y)
        ctx.bezierCurveTo(noseLeftNormal.x, noseLeftNormal.y, leftTailBaseNormalInv.x, leftTailBaseNormalInv.y, leftTailBase.x, leftTailBase.y)
        if (outline)
            ctx.stroke()
        else {
            ctx.fill()
            ctx.clip()
            var eyeLeft = this.pos.translate(this.dir.rotate90CCW().multiply(20)).translate(this.dir.multiply(22))
            var eyeRight = this.pos.translate(this.dir.rotate90CW().multiply(20)).translate(this.dir.multiply(22))
            circle(ctx, eyeLeft.x, eyeLeft.y, 8, "black")
            circle(ctx, eyeRight.x, eyeRight.y, 8, "black")
            circle(ctx, eyeLeft.x, eyeLeft.y, 4, "white")
            circle(ctx, eyeRight.x, eyeRight.y, 4, "white")
            ctx.restore()
        }
    }
}


function wallRaycast(ray) {
    var hit
    for (var e of wall.edges) {
        var intersections = ray.intersect(e.shape)
        for (var h of intersections)
            if (hit == undefined || (h.x - ray.pt.x) * (h.x - ray.pt.x) + (h.y - ray.pt.y) * (h.y - ray.pt.y) < (hit.x - ray.pt.x) * (hit.x - ray.pt.x) + (hit.y - ray.pt.y) * (hit.y - ray.pt.y))
                hit = h
    }
    return hit
}

function angle(v1, v2) {
    var raw = v1.angleTo(v2)
    if (raw > Math.PI)
        raw -= Math.PI * 2
    return raw
}

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
}

class Fish {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.vx = 1
        this.vy = 1
        this.radius = 40
        this.color = 'green'
        this.moving = true
    }

    click() {
        this.color = '#' + Math.floor(Math.random() * 16777215).toString(16)
    }

    update(delta, ctx) {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false)
        ctx.fillStyle = this.color
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        var l = 30
        ctx.quadraticCurveTo(this.x - this.vx * l, this.y - this.vy * l, this.x - this.vx * l * .7, this.y - this.vy * l * 2.2)
        ctx.quadraticCurveTo(this.x - this.vx * l * 1.5, this.y - this.vy * l * 1.5, this.x - this.vx * l * 2.2, this.y - this.vy * l * .7)
        ctx.quadraticCurveTo(this.x - this.vx * l, this.y - this.vy * l, this.x, this.y)
        ctx.fill()

        ctx.fillStyle = "black"
        ctx.fillRect(this.x - 8, this.y - 15, 5, 20)
        ctx.fillRect(this.x + 8, this.y - 15, -5, 20)


        ctx.beginPath()
        ctx.arc(this.x, this.y + 10, this.radius * .6, 0, Math.PI, false)
        ctx.fill()

        //if(Math.pow(mouse.x - this.x, 2) + Math.pow(mouse.y - this.y, 2) < this.radius * this.radius)
        if (!this.moving)
            return

        this.x += this.vx * delta / 5
        this.y += this.vy * delta / 5

        //=====TEMP======
        // hitb.style.top = (this.y - 50) + "px"
        // hitb.style.left = (this.x - 50) + "px"

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

//objects.push(new Fish(100, 100))
objects.push(new Narwal(400, 200))


function wallDist(p) {
    dist = 100000
    for (e of wall.edges) {
        dist = Math.min(dist, e.shape.distanceTo(p)[0])
    }
    return dist
}

function circle(ctx, x, y, radius, color) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
    ctx.fillStyle = color
    ctx.fill()
}