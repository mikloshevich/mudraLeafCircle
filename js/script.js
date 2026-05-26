window.addEventListener('load', () => {
    class Path {
        constructor(d, { x, y, width, height, hide }) {
            this.d = d
            this.x = x
            this.y = y
            this.width = width
            this.height = height

            this.pos = { x: 0, y: 0 }
            this.acc = { x: 0, y: 0 }
            this.vel = { x: 0, y: 0 }
            this.targetPos = { x: 0, y: 0 }

            this.delta = { x: 0, y: 0 }
            this.dist = 0

            this.springForce = { x: 0, y: 0 }
            this.dampingForce = { x: 0, y: 0 }
            this.force = { x: 0, y: 0 }

            this.alpha = 1
            this.strokeAlpha = 1
            this.fillColor = `hsla(0, 0%, 100%, ${this.alpha})`
            this.strokeColor = `hsla(0, 0%, 100%, ${this.strokeAlpha})`
            this.hide = hide
            this.moveRadius = -70
            this.maxDist = 50
        }

        draw(ctx) {
            const path1 = new Path2D(this.d)
            const path2 = new Path2D()
            ctx.fillStyle = this.fillColor
            ctx.strokeStyle = this.strokeColor
            path2.addPath(path1, new DOMMatrix(`translate(${this.pos.x}px, ${this.pos.y}px)`))
            ctx.fill(path2)
            ctx.stroke(path2)
        }

        // stiffness = 60, mass = 1.5, damping = 10 --- in project
        // stiffness = 60, mass = 1.8, damping = 20
        // stiffness = 60, mass = 3, damping = 20

        createSpringPosition(ctx, mouse, delta, { stiffness = 60, mass = 3, damping = 20 } = {}) { //stiffness = 60, mass = 3, damping = 20
            /**
             * F - Force
             * a - acceleration
             * k - Stiffnes
             * m - Mass
             * t - time interval (1/60 = 0.01666)
             *
             * F = -k*x
             * F = m*a
             *
             * m*a = -k*x
             * a = -k *x / m - Acceleration
             *
             * vel2 = vel1 + a*t - Velocity
             * pos2 =  pos1 + v*t - Position
             */

            // Stiffnes
            let k = -stiffness
            // Damping
            let d = -damping

            const dt = Math.max(Math.min(delta, 40), 1) / 1000

            this.delta.x = mouse.x - (this.x + this.width / 2)
            this.delta.y = mouse.y - (this.y + this.height / 2)

            this.dist = Math.sqrt(this.delta.x * this.delta.x + this.delta.y * this.delta.y)

            if (this.dist !== 0) {
                this.force.x = this.delta.x / this.dist
                this.force.y = this.delta.y / this.dist
            }

            this.targetPos.x = 0
            this.targetPos.y = 0

            if (Math.abs(this.pos.x) <= 5 && Math.abs(this.pos.y) <= 5) {
                if (this.hide) {
                    this.alpha = lerp(this.alpha, 1, 0.1)
                    this.strokeAlpha = lerp(this.strokeAlpha, 1, 0.01)
                    this.fillColor = `hsla(0, 0%, 100%, ${this.alpha})`
                    this.strokeColor = `hsla(0, 0%, 100%, ${this.strokeAlpha})`
                }
                // ctx.shadowColor = `hsla(0, 0%, 0%, 0)`
                // ctx.shadowBlur = 0
            }

            if (this.dist < this.maxDist) {
                this.targetPos.x = this.force.x * this.moveRadius
                this.targetPos.y = this.force.y * this.moveRadius
                if (this.hide) {
                    this.alpha = 0
                    this.strokeAlpha = 0
                    this.fillColor = `hsla(0, 0%, 100%, ${this.alpha})`
                    this.strokeColor = `hsla(0, 0%, 100%, ${this.strokeAlpha})`
                }
            }
            this.springForce.x = k * (this.pos.x - this.targetPos.x)
            this.springForce.y = k * (this.pos.y - this.targetPos.y)

            this.dampingForce.x = d * this.vel.x
            this.dampingForce.y = d * this.vel.y

            this.acc.x = (this.springForce.x + this.dampingForce.x) / mass
            this.acc.y = (this.springForce.y + this.dampingForce.y) / mass

            this.vel.x += this.acc.x * dt
            this.vel.y += this.acc.y * dt

            this.pos.x += this.vel.x * dt
            this.pos.y += this.vel.y * dt

            // if (distance < 30 && Math.abs(this.pos.x) >= 0.5 && Math.abs(this.pos.y) >= 0.5) {
            //     ctx.shadowColor = `hsla(0, 0%, 0%, 0.1)`
            //     ctx.shadowBlur = 3
            // }
        }
    }

    class Sound {
        constructor(audioEl, volume) {
            this.audioEl = audioEl
            // this.audioEl.volume = 1.0
            this.fftSize = 64
            this.audioCtx = new AudioContext()
            this.audioSource = this.audioCtx.createMediaElementSource(this.audioEl)
            this.analyser = new AnalyserNode(this.audioCtx, {
                fftSize: this.fftSize,
                smoothingTimeConstant: 0,
                // minDecibels: -90,
                // maxDecibels: -25,
            })
            this.gainNode = this.audioCtx.createGain()
            this.gainNode.connect(this.audioCtx.destination)
            this.analyser.connect(this.audioCtx.destination)
            this.audioSource.connect(this.gainNode).connect(this.analyser)

            this.bufferLength = this.analyser.frequencyBinCount
            this.dataArray = new Uint8Array(this.bufferLength)
            this.dataSmoothArray = new Uint8Array(this.bufferLength)

            this.setVolume(volume)

            this.mute = false
            this.timeoutId
            this.maxVolume = 1.0
        }

        volumeFadeOut(volume = 0.01, fadeTime = 1) {
            this.setVolume(this.gainNode.gain.value)
            this.mute = true
            this.gainNode.gain.exponentialRampToValueAtTime(volume, this.audioCtx.currentTime + fadeTime)
            this.timeoutId = setTimeout(() => {
                this.suspend()
            }, fadeTime * 1000)
        }
        volumeFadeIn(fadeTime = 1) {
            if (!this.mute) return

            this.mute = false

            if (this.timeoutId) {
                clearTimeout(this.timeoutId)
            }

            this.setVolume(this.gainNode.gain.value)
            this.resume()
            this.gainNode.gain.exponentialRampToValueAtTime(this.maxVolume, this.audioCtx.currentTime + fadeTime)
        }

        setVolume(val) {
            this.gainNode.gain.setValueAtTime(val, this.audioCtx.currentTime)
        }

        suspend() {
            if (this.audioCtx.state === 'running') {
                this.audioCtx.suspend()
                this.audioEl.pause()
            }
        }

        resume() {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume()
                this.audioEl.play()
            }
        }

        getNormData() {
            this.analyser.getByteTimeDomainData(this.dataArray)
            let normalizedSamples = [...this.dataArray].map((sample) => sample / 128 - 1)
            return normalizedSamples
        }
        getData() {
            // this.analyser.getByteFrequencyData(this.dataArray)
            this.analyser.getByteTimeDomainData(this.dataArray)
            return this.dataArray
        }

        getSmoothData() {
            this.analyser.getByteTimeDomainData(this.dataSmoothArray)
            let normalizedSamples = [...this.dataSmoothArray].map((sample) => sample / 128 - 1)
            return normalizedSamples
        }
    }

    const volume = 0.2
    const audioEl = new Audio('../assets/audio/another_pad3.5-fade.mp3')
    const sound = new Sound(audioEl, volume)

    // sound.maxVolume = volume
    // sound.setVolume(volume)
    sound.audioEl.loop = true
    sound.audioEl.autoplay = true

    document.querySelector('button').addEventListener('click', () => {
        sound.resume()
        sound.audioEl.play()
        sound.gainNode.gain.value = volume
        sound.setVolume(volume)
        // audioEl.play()
    })

    const canvasContainer = document.querySelector('.canvas-container')
    const svgLeaf = canvasContainer.querySelector('[data-svg-leaf]')
    const leafCnv = canvasContainer.querySelector('#leaf-cnv')
    const soundCnv = canvasContainer.querySelector('#sound-cnv')

    const leafCtx = leafCnv.getContext('2d')
    const soundCtx = soundCnv.getContext('2d')

    let svgRect = svgLeaf.getBoundingClientRect()

    leafCnv.width = svgRect.width
    leafCnv.height = svgRect.height

    const gradient = soundCtx.createLinearGradient(
        0,
        soundCnv.height * 0.5,
        soundCnv.width,
        soundCnv.height * 0.5
    )
    gradient.addColorStop(0, 'hsl(50deg, 85%, 70%)')
    gradient.addColorStop(1, 'hsl(184deg, 100%, 65%)')

    const mouse = {
        x: null,
        y: null
    }

    let pathList = getPathData()

    window.addEventListener('resize', () => {
        pathList = getPathData()
    })

    document.addEventListener('mousemove', (e) => {
        mouse.x = e.x - svgRect.left
        mouse.y = e.y - svgRect.top
    })

    let lastTime = 0

    function animate(currentTime) {
        const dt = (currentTime - lastTime) // * 0.001

        leafCtx.clearRect(0, 0, leafCnv.width, leafCnv.height)

        drawSound(sound, soundCnv, soundCtx, gradient, dt)

        for (let i = 0; i < pathList.length; i++) {
            if (mouse.x && mouse.y) {
                pathList[i].createSpringPosition(leafCtx, mouse, dt)

                // if (!checkIddle(pathList.current, pathList.current.length)) {
                //     setShowSound(false)
                // } else {
                //     setShowSound(true)
                // }
            }
            pathList[i].draw(leafCtx)
        }

        lastTime = currentTime
        window.requestAnimationFrame(animate)
    }
    animate()

    function getPathData() {
        const arr = []
        svgRect = svgLeaf.getBoundingClientRect()

        // const scaleFactor = canvasContainer.offsetWidth / 400

        // leafCnv.width = canvasContainer.offsetWidth
        // leafCnv.height = canvasContainer.offsetHeight
        // console.log(canvasContainer.offsetWidth)

        // leafCtx.translate(leafCnv.width*0.5, leafCnv.height*0.5)
        // leafCtx.scale(scaleFactor, scaleFactor)
        // leafCtx.translate(-leafCnv.width*0.5, -leafCnv.height*0.5)

        // leafCtx.setTransform(1, 0, 0, 1, 0, 0)

        svgLeaf.querySelectorAll('path').forEach((path) => {
            const { x, y, width, height } = path.getBBox()
            const d = path.getAttribute('d')
            const hide = path.dataset.name === 'hide'
            arr.push(new Path(d, { x, y, width, height, hide }))
        })
        return arr
    }

    function drawSound(soundInstance, cnv, ctx, soundGradient, dt) {
        ctx.fillStyle = 'hsla(0deg, 0%, 16%, 0.06)' //0.03
        // ctx.fillStyle = 'hsla(0deg, 0%, 16%, 1)'
        ctx.fillRect(0, 0, cnv.width, cnv.height)
        // ctx.clearRect(0, 0, cnv.width, cnv.height)

        ctx.strokeStyle = soundGradient
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 4

        if (soundInstance) {
            const buffer = soundInstance.bufferLength

            for (let i = 0; i < buffer; i++) {
                const wave = soundInstance.getData()[i] / 128 - 1
                // let smoothWave = wave - soundInstance.getSmoothData()[i]
                soundInstance.getSmoothData()[i] += (wave - soundInstance.getSmoothData()[i]) * dt * 0.001
                // const theta = degToRad(gradAngle.current * 50 + (i * 360) / buffer)
                const theta = degToRad((i * 360) / buffer)

                const force = wave * 800
                // const force = soundInstance.getSmoothData()[i] * 800

                // let x =
                //     Math.cos(theta) * (cnv.width * 0.43) +
                //     Math.cos(theta + i * 0.18) * force * (cnv.width * vectorLength)
                // let y =
                //     Math.sin(theta) * (cnv.height * 0.43) +
                //     Math.sin(theta + i * 0.2 * (wave + 1)) * force * (cnv.height * vectorLength)
                let x = Math.cos(theta) * (cnv.width * 0.3) + Math.cos(theta + i * 0.1) * force
                let y = Math.sin(theta) * (cnv.height * 0.3) + Math.sin(theta) * force

                // x = Math.round(x)
                // y = Math.round(y)

                if (i === 0) {
                    ctx.beginPath()
                    ctx.moveTo(x + cnv.width / 2, y + cnv.height / 2)
                } else {
                    ctx.lineTo(x + cnv.width / 2, y + cnv.height / 2)
                    ctx.stroke()
                }

                if (i === buffer - 1) {
                    ctx.closePath()
                    ctx.stroke()
                }
            }
        }

        // ctx.beginPath()
        // ctx.fillStyle = 'hsl(0, 0%, 100%)'
        // ctx.arc(cnv.width / 2, cnv.height / 2, cnv.width * 0.4, 0, Math.PI * 2)
        // ctx.fill()
    }

    function degToRad(deg) {
        return deg * (Math.PI / 180)
    }

    function lerp(start, end, t) {
        return start * (1 - t) + end * t
    }
})