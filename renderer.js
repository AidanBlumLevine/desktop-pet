const electron = require('electron')
const { Point, Vector, Circle, Line, Ray, Segment, Arc, Box, Polygon, Matrix, PlanarSet, Multiline } = require('@flatten-js/core')
const BrowserWindow = electron.remote.BrowserWindow
const win = BrowserWindow.getAllWindows()[0]

const TransparencyMouseFix = require('electron-transparency-mouse-fix')
const fix = new TransparencyMouseFix({
    log: true,
    fixPointerEvents: 'auto'
})

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
        this.speed = 1
        this.angleVel = 0
        this.leftShift = 0
        this.reentry = 0
        this.animation = 0

        this.hitbox = document.getElementById('hitbox')
        this.hitbox.onclick = () => {
            this.speed = 15
        }
        // this.hitbox.onmouseover = () => fishes[0].moving = false
        // this.hitbox.onmouseleave = () => fishes[0].moving = true
    }

    update(delta) {
        delta *= Math.max(1, Math.min(this.speed, 2))

        if (!this.hunting)
            this.speed -= Math.max(0, this.speed - .95) * delta / 1000

        this.animation += delta

        this.drawHorn(true)
        this.drawHorn()
        this.draw(true)
        this.draw()

        var angleChange = 0
        if (this.reentry == 0) {
            angleChange = this.angleVel
            var wallIntersectPoint = wallRaycast(new Ray(this.pos, this.dir.rotate90CCW()))

            if (wallIntersectPoint == undefined)
                this.reentry = 1000
            else if (this.hunting) {
                if(!ball.stuck)
                this.angleVel += angle(this.dir, new Vector(this.pos, ball.pos)) * delta / 450
            } else {
                var mouseAngle = angle(this.dir, new Vector(this.pos, mouse))
                var mouseWariness = Math.min(500, this.pos.distanceTo(mouse)[0]).map(0, 500, 10, 0) / Math.max(1, Math.abs(mouseAngle) * 4)
                this.angleVel -= Math.sign(mouseAngle) * mouseWariness * mouseWariness / 1000

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

            if (ball.active) {
                var ballAngle = Math.abs(angle(this.dir, new Vector(this.pos, ball.pos)))
                ctx.fillText(ballAngle, 10, 40)
                if (ballAngle < .5) {
                    ctx.fillText(Math.random() * this.pos.distanceTo(ball.pos)[0], 10, 10)
                    if (Math.random() * this.pos.distanceTo(ball.pos)[0] < delta) {
                        this.hunting = true
                        this.speed = 1.5
                    }
                }
            }
        } else {
            if (this.reentry > 0) {
                //still leaving
                this.reentry -= delta
                if (this.reentry <= 0) {
                    this.dir = new Vector(0, 1).rotate(Math.random() * 2 * Math.PI)
                    this.newSpawn = new Point(width / 2, height / 2).translate(this.dir.multiply(-Math.max(width, height) - 100))
                    this.pos = this.newSpawn
                    this.reentryDist = new Vector(this.newSpawn, wallRaycast(new Ray(this.pos, this.dir.rotate90CCW()))).length
                    if (ball.stuck)
                        ball.pos = new Point(1000000, 0);
                    ball.stuck = false
                    this.hunting = false
                }
            } else {
                //re entering
                if (this.reentryDist < new Vector(this.pos, this.newSpawn).length) {
                    this.reentry = 0
                    this.angleVel = 0
                    this.leftShift = 0
                    this.speed = 1
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

        this.hitbox.style.top = (this.pos.y - 50) + "px"
        this.hitbox.style.left = (this.pos.x - 50) + "px"
    }

    draw(outline = false) {
        ctx.lineWidth = 4
        ctx.strokeStyle = "#030303"
        ctx.fillStyle = "#6FB2C3"
        ctx.fillStyle = "#7EBAC9"
        var finWiggle = Math.sin(this.animation / 800) / 6
        var finWiggle2 = Math.sin(this.animation / 700 + 2) / 6
        var finLeftBase = this.pos.translate(this.dir.multiply(26).rotate(-1.8))
        var finRightBase = this.pos.translate(this.dir.multiply(26).rotate(1.8))
        var finLeftOutCPoint = finLeftBase.translate(this.dir.multiply(12).rotate(-1.8 + finWiggle))
        var finRightOutCPoint = finRightBase.translate(this.dir.multiply(12).rotate(1.8 + finWiggle2))
        var finLeftPoint = finLeftBase.translate(this.dir.multiply(25).rotate(-2.8 + finWiggle))
        var finRightPoint = finRightBase.translate(this.dir.multiply(25).rotate(2.8 + finWiggle2))
        var finLeftInCPoint = finLeftBase.translate(this.dir.multiply(16).rotate(-3.8 + finWiggle))
        var finRightInCPoint = finRightBase.translate(this.dir.multiply(16).rotate(3.8 + finWiggle2))
        ctx.beginPath()
        ctx.moveTo(finLeftBase.x, finLeftBase.y)
        ctx.quadraticCurveTo(finLeftOutCPoint.x, finLeftOutCPoint.y, finLeftPoint.x, finLeftPoint.y)
        ctx.quadraticCurveTo(finLeftInCPoint.x, finLeftInCPoint.y, finLeftBase.x, finLeftBase.y)
        if (outline)
            ctx.stroke()
        else
            ctx.fill()
        ctx.beginPath()
        ctx.moveTo(finRightBase.x, finRightBase.y)
        ctx.quadraticCurveTo(finRightOutCPoint.x, finRightOutCPoint.y, finRightPoint.x, finRightPoint.y)
        ctx.quadraticCurveTo(finRightInCPoint.x, finRightInCPoint.y, finRightBase.x, finRightBase.y)
        if (outline)
            ctx.stroke()
        else
            ctx.fill()

        ctx.save()
        ctx.fillStyle = "#9ecbd6"
        ctx.beginPath()

        var endAngle = angle(this.tailEnd, this.dir.invert())
        var wiggle = Math.sin(this.animation / 300) / 6
        wiggle /= Math.max(1, endAngle * 4)
        var animatedMid = this.tailMid.rotate(wiggle / 2)
        var animatedEnd = this.tailEnd.rotate(wiggle)

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

        var tailCenter = this.pos.translate(animatedEnd.multiply(1.17))
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
            circle(eyeLeft.x, eyeLeft.y, 8, "black")
            circle(eyeRight.x, eyeRight.y, 8, "black")
            circle(eyeLeft.x, eyeLeft.y, 4, "#ddd")
            circle(eyeRight.x, eyeRight.y, 4, "#ddd")
            ctx.restore()
        }
    }

    drawHorn(outline = false) {
        ctx.lineWidth = 4
        ctx.strokeStyle = "#030303"

        var hornLeft = this.pos.translate(this.dir.rotate90CCW().multiply(12))
        var hornPoint = this.pos.translate(this.dir.multiply(50))
        var hornRight = this.pos.translate(this.dir.rotate90CW().multiply(12))
        var hornLeftHalf = new Point((hornLeft.x + hornPoint.x * 4) / 5, (hornLeft.y + hornPoint.y * 4) / 5)
        var hornRightHalf = new Point((hornRight.x + hornPoint.x * 4) / 5, (hornRight.y + hornPoint.y * 4) / 5)
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
    }
}

class Ball {
    constructor() {
        this.xvel = Math.random() > .5 ? 1 : -1
        this.yvel = 0
        this.pos = new Point(width / 2 - width * this.xvel, Math.random() * 200)
        this.radius = 30
        this.active = true
        this.stuck = false
        this.rotation = 0
        this.rotationSpeed = Math.random() * 8 - 4
    }

    update(delta) {
        if (this.stuck) {
            this.pos = narwhal.pos.translate(narwhal.dir.multiply(this.stuckDist).rotate(this.stuckAngle))
        } else if (this.pos.distanceTo(narwhal.pos.translate(narwhal.dir.multiply(35)))[0] < this.radius) {
            narwhal.hunting = true
            narwhal.speed = 1.5
            this.stuck = true
            this.stuckDist = this.pos.distanceTo(narwhal.pos)[0]
            this.stuckAngle = narwhal.dir.angleTo(new Vector(narwhal.pos, this.pos))
        } else {
            this.yvel += delta / 15
            var ydelta = this.yvel * delta / 1000
            if (this.pos.y + this.radius + ydelta > height) {
                this.pos.y = height - this.radius
                this.yvel *= -(Math.random() / 3 + .7)
            }
            else
                this.pos = this.pos.translate(new Vector(this.xvel * delta / 15, ydelta))

            this.active = true
            if (this.xvel > 0 ? this.pos.x : width - this.pos.x > width + this.radius)
                this.active = false
            if (this.xvel > 0 ? this.pos.x : width - this.pos.x < this.radius)
                this.active = false
        }

        circle(this.pos.x, this.pos.y, this.radius, "black")
        var r = Math.PI / 3

        if(!this.stuck)
            this.rotation += this.rotationSpeed * delta / 1000

        circle(this.pos.x, this.pos.y, this.radius - 2, "#fcfa4a", this.rotation + 0 * r - 1, this.rotation + r + 1)
        circle(this.pos.x, this.pos.y, this.radius - 2, "#fdb44f", this.rotation + 1 * r, this.rotation + 2 * r + 1)
        circle(this.pos.x, this.pos.y, this.radius - 2, "#fe79a9", this.rotation + 2 * r, this.rotation + 3 * r + 1)
        circle(this.pos.x, this.pos.y, this.radius - 2, "#c788ff", this.rotation + 3 * r, this.rotation + 4 * r + 1)
        circle(this.pos.x, this.pos.y, this.radius - 2, "#8ec9ff", this.rotation + 4 * r, this.rotation + 5 * r + 1)
        circle(this.pos.x, this.pos.y, this.radius - 2, "#77ff86", this.rotation + 5 * r, this.rotation + 0)
        circle(this.pos.x, this.pos.y, this.radius / 3.5, "white")
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

ball = new Ball()
narwhal = new Narwal(400, 200)
objects.push(narwhal)
objects.push(ball)
setInterval(() => {
    ball = new Ball()
    objects[1] = ball
}, 60000 + Math.random() * 20000)

function circle(x, y, radius, color, from = 0, to = Math.PI * 2) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, radius, from, to, false)
    ctx.fillStyle = color
    ctx.fill()
}

