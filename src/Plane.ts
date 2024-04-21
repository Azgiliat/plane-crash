import {Observable} from "./Observable.ts";

enum UPDATE {
  INIT_BACK,
  INIT_PLANE,
  TAKE_OFF,
  FLY,
  RESIZE,
  LOAD_PLANE,
  LOAD_BACKGROUND,
  LOAD_CLOUD,
  MOVE_CLOUDS,
  UPDATE_MULTIPLIER,
  FINISH
}

type Cloud = {
  x: number,
  y: number,
  isLow: boolean
}

type ShakeDirection = 'up' | 'down'

export class Plane extends Observable {
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private canvasWidth = 0
  private canvasHeight = 0
  private xScale = 1
  private yScale = 1

  private boomTime = 10 * 1000

  private updates = new Set<UPDATE>([])

  private planePosition = {
    x: 0,
    y: 0
  }
  private backgroundStages = [0.2, 1]
  private backgroundPosition = this.backgroundStages[0]

  // 
  private planeSize = 30
  private flyOffset = 30
  private speed = 1 / (3 * 1000) // all canvas = 1, 5 sec to go from 0 to top corner

  // clouds data
  private cloudSize = {
    width: 60,
    height: 20
  }
  private cloudsPositions: Cloud[] = []

  // images
  private planeImage: HTMLImageElement | null = null
  private backgroundImage: HTMLImageElement | null = null
  private cloudImage: HTMLImageElement | null = null
  private boomImage: HTMLImageElement | null = null

  // timestamps
  private prevCloudsAddedTimestamp = performance.now()
  private prevTimestamp = performance.now()
  private takeoffTimestamp: DOMHighResTimeStamp | null = null
  private prevMultiplierUpdate: DOMHighResTimeStamp | null = null

  // space passed
  private totalPassedSpace = {
    x: 0,
    y: 0
  }
  private passedSpaceSinceLastFrame = {
    x: 0,
    y: 0
  }

  // stages
  private isTakeOffStage = false
  private isFlyStage = false
  private isCloudsStage = false
  private isFinished = false
  isInProgress = false

  // plane animation in fly tage
  private shakeDirection: ShakeDirection = 'down'
  private shakeDuration = 2 * 1000
  private shakeDistance = 20
  private lastShakeTimestamp = performance.now()

  // multiplier
  private multiplierUpdateInterval = 200
  private multiplierRange: [number, number] = [1, 10]
  private _multiplier = 1
  private get multiplier() {
    return this._multiplier
  }

  private set multiplier(v: number) {
    this._multiplier = v
    this.fireEvent("multiplierUpdate", this._multiplier)
  }

  constructor() {
    super()
    // customize some constants here if need
  }

  loadBackground(image: HTMLImageElement) {
    this.backgroundImage = image
    this.addUpdate(UPDATE.LOAD_BACKGROUND)
  }

  loadPlaneImage(image: HTMLImageElement) {
    this.planeImage = image
    this.addUpdate(UPDATE.LOAD_PLANE)
  }

  loadCloudImage(image: HTMLImageElement) {
    this.cloudImage = image
    this.cloudSize.height = Math.round(this.cloudSize.width * (image.height / image.width))
    this.addUpdate(UPDATE.LOAD_CLOUD)
  }

  loadBoomImage(image: HTMLImageElement) {
    this.boomImage = image
  }

  private checkStages(timestamp: DOMHighResTimeStamp) {
    if (this.isFinished) {
      this.addUpdate(UPDATE.FINISH)
      return
    }

    if (this.isTakeOffStage) {
      if (this.flyOffset < this.planePosition.y) {
        this.addUpdate(UPDATE.TAKE_OFF)
      } else {
        this.isTakeOffStage = false
        this.isFlyStage = true
        this.addUpdate(UPDATE.FLY)
      }
      if (this.takeoffTimestamp === null) {
        this.takeoffTimestamp = timestamp
        this.prevMultiplierUpdate = timestamp
      }
    } else if (this.isFlyStage) {
      if (!this.isCloudsStage && this.backgroundPosition >= 0.5) {
        this.addClouds(Math.random() * 10)
        this.prevCloudsAddedTimestamp = timestamp
        this.isCloudsStage = true
      }

      if (timestamp - this.lastShakeTimestamp >= this.shakeDuration) {
        this.lastShakeTimestamp = timestamp
        this.shakeDirection = this.shakeDirection === 'up' ? 'down' : 'up'
      }

      this.addUpdate(UPDATE.FLY)
    }

    if (this.isCloudsStage) {
      if (timestamp - this.prevCloudsAddedTimestamp >= 500) {
        this.addClouds(Math.random() * 10)
        this.prevCloudsAddedTimestamp = timestamp
      }
      this.addUpdate(UPDATE.MOVE_CLOUDS)
    }

    if (this.takeoffTimestamp && (timestamp - this.takeoffTimestamp >= this.boomTime)) {
      this.isFinished = true
      this.isInProgress = false
      this.isFlyStage = false
      this.isTakeOffStage = false
      this.fireEvent('finish')
      this.addUpdate(UPDATE.FINISH)
    }

    if (this.prevMultiplierUpdate && (timestamp - this.prevMultiplierUpdate) >= this.multiplierUpdateInterval) {
      this.addUpdate(UPDATE.UPDATE_MULTIPLIER)
    }
  }

  private generateCloud() {
    return {
      x: Math.random() * (this.canvasWidth / 2 + this.canvasWidth - this.cloudSize.width),
      y: -1 * this.cloudSize.height,
      isLow: false
    }
  }

  private addClouds(amount: number) {
    let i = 0
    while (i <= amount) {
      this.cloudsPositions.push(this.generateCloud())
      i++
    }
  }

  private removeLowClouds() {
    this.cloudsPositions = this.cloudsPositions.filter(cloud => !cloud.isLow)
  }

  private updateCloudsCoors() {
    this.cloudsPositions.forEach(cloud => {
      cloud.y += this.passedSpaceSinceLastFrame.y
      cloud.x -= this.passedSpaceSinceLastFrame.x

      if (cloud.y >= this.canvasHeight / 2) {
        cloud.isLow = true
      }
    })
  }

  private updatePlaneCoordsForTakeOff(timestamp: DOMHighResTimeStamp) {
    this.calcPassedSpace(timestamp)

    this.planePosition.x += this.passedSpaceSinceLastFrame.x
    this.planePosition.y -= this.passedSpaceSinceLastFrame.y

    if (this.planePosition.y < this.flyOffset) {
      this.planePosition.y = this.flyOffset
    }
    if (this.planePosition.x > this.canvasWidth - this.planeSize - this.flyOffset) {
      this.planePosition.x = this.canvasWidth - this.planeSize - this.flyOffset
    }
  }

  private updatePlaneCoordsForFly(timestamp: DOMHighResTimeStamp) {
    this.calcPassedSpace(timestamp)

    const timeDiff = timestamp - this.prevTimestamp
    const delta = (this.shakeDirection === 'down' ? 1 : -1) * (timeDiff * (this.shakeDistance / this.shakeDuration))

    this.planePosition.y -= delta
  }

  private updateBackgroundCoordsForFly() {
    this.backgroundPosition += this.passedSpaceSinceLastFrame.y * ((this.canvasHeight - this.planeSize - this.flyOffset) / (this.canvasWidth - this.planeSize - this.flyOffset)) / this.canvasHeight

    if (this.backgroundPosition > this.backgroundStages[1]) {
      this.backgroundPosition = this.backgroundStages[1]
    }
  }

  private updateMultiplier(timestamp: DOMHighResTimeStamp) {
    if (this.prevMultiplierUpdate) {
      const timeDiff = timestamp - this.prevMultiplierUpdate
      const delta = (this.multiplierRange[1] - this.multiplierRange[0]) / this.boomTime * timeDiff

      this.multiplier += delta
      this.prevMultiplierUpdate = timestamp
    }
  }

  private setInitPlaneCoords() {
    if (!this.canvas) {
      return
    }

    this.planePosition.x = 0
    this.planePosition.y = this.canvasHeight - this.planeSize
  }

  private setInitBackgroundPosition() {
    this.backgroundPosition = this.backgroundStages[0]
  }

  private recalculateCoords() {
    if (!this.canvas) {
      return
    }

    this.shakeDistance /= this.yScale

    if (this.isCloudsStage) {
      this.cloudSize.width /= this.xScale
      this.cloudSize.height /= this.yScale
      this.cloudsPositions.forEach(cloud => {
        cloud.x /= this.xScale
        cloud.y /= this.yScale
      })
    }

    if (this.isTakeOffStage) {
      this.planePosition.x /= this.xScale
      this.planePosition.y /= this.yScale
    } else if (this.isFlyStage) {
      this.planePosition.x = this.canvasWidth - this.planeSize - this.flyOffset
      this.planePosition.y = this.flyOffset
    } else {
      this.setInitPlaneCoords()
    }
  }

  updateCanvasSize(width: number, height: number) {
    if (!this.canvas) {
      return
    }

    this.canvas.width = width
    this.canvas.height = height

    this.xScale = this.canvasWidth / this.canvas.width
    this.yScale = this.canvasHeight / this.canvas.height
    this.canvasHeight = this.canvas.height
    this.canvasWidth = this.canvas.width

    this.addUpdate(UPDATE.RESIZE)
  }

  private drawPlane() {
    this.drawOnPlanePosition('plane')
  }

  private drawBoom() {
    this.drawOnPlanePosition('boom')
  }

  private drawOnPlanePosition(elem: 'plane' | 'boom') {
    if (!this.context) {
      return
    }
    
    const image = elem === 'plane' ? this.planeImage : this.boomImage

    if (image) {
      this.context.drawImage(image, this.planePosition.x, this.planePosition.y, this.planeSize, this.planeSize)
    }
  }

  private drawBackground() {
    if (!this.context || !this.canvas) {
      return
    }

    if (this.backgroundImage) {
      this.context.drawImage(this.backgroundImage, 0, this.canvasHeight - this.canvasHeight / this.backgroundPosition, this.canvasWidth, this.canvasHeight * (1 / this.backgroundPosition))
    } else {
      // sky
      this.context.fillStyle = 'blue'
      this.context.fillRect(0, 0, this.canvas.width, 2 / 3 * this.canvas.height)
      // ground
      this.context.fillStyle = 'green'
      this.context.fillRect(0, 2 / 3 * this.canvas.height, this.canvas.width, 1 / 3 * this.canvas.height)
    }
  }

  private drawCurve() {
    if (this.context) {
      const start = {
        x: 0,
        y: this.canvasHeight,
      }
      const end = {
        x: this.planePosition.x + Math.floor(this.planeSize / 2),
        y: this.planePosition.y + Math.floor(this.planeSize / 2),
      }
      const firstControlPoint = {
        x: (end.x - start.x) * 0.5,
        y: this.canvasHeight - 10
      }

      this.context.beginPath()
      this.context.strokeStyle = 'red'
      this.context.lineWidth = 4
      this.context.moveTo(start.x, start.y)
      this.context.quadraticCurveTo(firstControlPoint.x, firstControlPoint.y, end.x, end.y)
      this.context.stroke()
      this.context.closePath()
    }
  }

  private drawClouds() {
    if (this.context && this.cloudImage) {
      for (const cloud of this.cloudsPositions) {
        if (!cloud.isLow) {
          this.context.drawImage(this.cloudImage, cloud.x, cloud.y, this.cloudSize.width, this.cloudSize.height)
        }
      }
    }
  }

  private drawMultiplier() {
    if (!this.context) {
      return
    }

    this.context.font = '24px serif';
    this.context.fillStyle = 'red'
    this.context.fillText(`x${this.multiplier.toFixed(2)}`, 10, 50);
  }

  private draw() {
    this.drawBackground();
    if (this.isFlyStage || this.isTakeOffStage) {
      this.drawCurve()
      this.drawMultiplier()
    }
    if (this.isCloudsStage) {
      this.drawClouds()
    }
    if (this.isFinished) {
      this.drawBoom()
    } else {
      this.drawPlane()
    }
  }

  private afterDrawActions(timestamp: DOMHighResTimeStamp) {
    this.removeLowClouds()
    this.prevTimestamp = timestamp
  }

  private animate = (timestamp: DOMHighResTimeStamp) => {
    this.checkStages(timestamp)

    if (this.hasUpdates) {
      if (this.hasUpdate(UPDATE.INIT_BACK)) {
        this.setInitBackgroundPosition()
      }
      if (this.hasUpdate(UPDATE.INIT_PLANE)) {
        this.setInitPlaneCoords()
      }
      if (this.hasUpdate(UPDATE.UPDATE_MULTIPLIER)) {
        this.updateMultiplier(timestamp)
      }
      if (this.hasUpdate(UPDATE.TAKE_OFF)) {
        this.updatePlaneCoordsForTakeOff(timestamp)
      }
      if (this.hasUpdate(UPDATE.FLY)) {
        this.updatePlaneCoordsForFly(timestamp)
        this.updateBackgroundCoordsForFly()
      }
      if (this.hasUpdate(UPDATE.MOVE_CLOUDS)) {
        this.updateCloudsCoors()
      }
      if (this.hasUpdate(UPDATE.RESIZE)) {
        this.recalculateCoords()
      }

      this.clearCanvas()
      this.draw()
      this.clearUpdates()
    }

    this.afterDrawActions(timestamp);

    if (this.canvas) {
      requestAnimationFrame(this.animate)
    }
  }

  init() {
    this.reset()
    requestAnimationFrame(this.animate)
  }

  reset() {
    this.isFlyStage = false
    this.isCloudsStage = false
    this.isTakeOffStage = false
    this.isFinished = false
    this.isInProgress = false
    this.multiplier = 1
    this.takeoffTimestamp = null

    this.addUpdate(UPDATE.INIT_BACK)
    this.addUpdate(UPDATE.INIT_PLANE)
  }

  startTakeOff() {
    this.isTakeOffStage = true
    this.isInProgress = true
  }

  private clearCanvas() {
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  private get hasUpdates() {
    return !!this.updates.size
  }

  private addUpdate(update: UPDATE) {
    if (!this.updates.has(update)) {
      this.updates.add(update)
    }
  }

  // private removeUpdate(update: UPDATE) {
  //   this.updates.delete(update)
  // }

  private hasUpdate(update: UPDATE) {
    return this.updates.has(update)
  }

  private clearUpdates() {
    this.updates.clear()
  }

  attach(canvas: HTMLCanvasElement) {
    if (!this.canvas) {
      this.canvas = canvas
      this.context = canvas.getContext('2d')
      this.canvasWidth = this.canvas.width
      this.canvasHeight = this.canvas.height
    }
  }

  private convertXtoY(val: number) {
    // available y space / available x space
    return val * ((this.canvasHeight - this.planeSize - this.flyOffset) / (this.canvasWidth - this.planeSize - this.flyOffset))
  }

  private calcPassedSpace(timestamp: DOMHighResTimeStamp) {
    const timeDiff = timestamp - this.prevTimestamp
    const delta = this.speed * timeDiff * this.canvasWidth

    this.passedSpaceSinceLastFrame.x = delta
    this.totalPassedSpace.x += this.passedSpaceSinceLastFrame.x
    this.passedSpaceSinceLastFrame.y = this.convertXtoY(delta)
    this.totalPassedSpace.y -= this.passedSpaceSinceLastFrame.y
  }

  detach() {
    this.canvas = null
    this.context = null
    this.clearSubscriptions()
  }

  getMultiplier() {
    return this.multiplier
  }
}
