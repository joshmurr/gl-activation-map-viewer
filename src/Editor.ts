import * as tf from '@tensorflow/tfjs'
import { ActivationSelection, FillFn, LayerInfo, RectCoords } from './types'

import { fill, rect, rotate } from './transformations'
import { act2ImageData } from './conversions'
import { TypedArray } from './typedArrays'

type Callback = (e?: MouseEvent) => void
type NamedCallback = [name: string, cb: Callback]

export default class Editor {
  private editor: HTMLElement
  private activationsCont: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private overlayCanvas: HTMLCanvasElement
  private overlayCtx: CanvasRenderingContext2D

  private tools: HTMLElement
  private tooltipCont: HTMLElement
  private SHIFT = false
  /* private SCALE = 25 */
  private _needsUpdate = false
  private _applyToAll = false
  private currentActSelection: ActivationSelection
  private _brushSize = 3
  private rotationCounter = 1

  constructor() {
    this.buildContainer()
    this.activationsCont = document.createElement('div')
    this.activationsCont.id = 'activations'
    document.body.appendChild(this.activationsCont)
  }

  private buildContainer() {
    this.editor = document.createElement('div')
    this.editor.id = 'editor'

    this.hideDisplay()

    this.tools = document.createElement('div')
    this.tools.id = 'tools'

    const buttons = [
      {
        text: 'X',
        parent: this.editor,
        id: 'close',
        callbacks: [['click', () => this.hideDisplay()]],
      },
      {
        text: 'Black',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.fill('black')]],
      },
      {
        text: 'White',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.fill('white')]],
      },
      {
        text: 'Grey',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.fill('grey')]],
      },
      {
        text: 'Rect',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.autoFillRect('grey')]],
      },
      {
        text: 'Rotate',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.rotate()]],
      },
      {
        text: 'Apply to Stack',
        parent: this.tools,
        id: 'all',
        callbacks: [
          ['click', () => this.toggleApplyToAll()],
          [
            'mouseover',
            () =>
              this.showTooltip(
                'When selected, the transformation will apply to the entire activation map.',
              ),
          ],
          ['mouseout', () => this.hideTooltip()],
          ['mousemove', (e: MouseEvent) => this.updateTooltip(e)],
        ],
      },
    ]

    buttons.forEach(({ text, parent, callbacks, id }) =>
      this.addButton(text, parent, callbacks, id),
    )

    const sliders = [
      {
        name: 'brush',
        eventListener: 'change',
        label: 'Brush Size',
        min: 1,
        max: 12,
        value: 6,
        callback: () => {
          const el = document.querySelector(
            'input[name="brush"]',
          ) as HTMLInputElement
          const val = el.value
          this.brushSize = Number(val)
        },
        parent: this.tools,
      },
    ]

    sliders.forEach(
      ({ name, parent, eventListener, callback, min, max, value, label }) =>
        this.addSlider(
          name,
          parent,
          eventListener,
          callback,
          min,
          max,
          value,
          label,
        ),
    )

    this.tooltipCont = document.createElement('div')
    this.tooltipCont.classList.add('tooltip', 'hide')

    const canvasCont = document.createElement('div')
    canvasCont.classList.add('canvasCont')

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    this.overlayCanvas = document.createElement('canvas')
    this.overlayCtx = this.overlayCanvas.getContext('2d')
    this.overlayCtx.globalCompositeOperation = 'multiply'

    canvasCont.appendChild(this.canvas)
    canvasCont.appendChild(this.overlayCanvas)
    this.editor.appendChild(canvasCont)
    this.editor.appendChild(this.tools)
    document.body.appendChild(this.tooltipCont)
    document.body.appendChild(this.editor)
  }

  public show(currentAct: ActivationSelection) {
    this.rotationCounter = 1
    this.currentActSelection = currentAct
    const { relativeId, layer } = currentAct
    const [w, h] = layer.shape.slice(2)

    this.initCanvas(this.canvas, w, h)
    this.initCanvas(this.overlayCanvas, w, h, 10)

    const canvasContainer = document.querySelector('.canvasCont') as HTMLElement
    canvasContainer.style.width = `${w * this.screenScale(w)}px`
    canvasContainer.style.height = `${h * this.screenScale(w)}px`

    const { data } = layer.activations[relativeId]
    const imageData = act2ImageData(data, w, h)

    this.ctx.putImageData(imageData, 0, 0)
    this.showDisplay()
  }

  private initCanvas(
    canvas: HTMLCanvasElement,
    w: number,
    h: number,
    scale = 1,
  ) {
    canvas.width = w * scale
    canvas.height = h * scale
    canvas.style.width = `${w * this.screenScale(w)}px`
    canvas.style.height = `${h * this.screenScale(h)}px`
  }

  private addButton(
    text: string,
    parent: HTMLElement,
    callbacks: NamedCallback[],
    id?: string,
  ) {
    const button = document.createElement('button')
    button.type = 'button'
    button.value = text
    button.innerHTML = text
    for (const callback of callbacks) {
      const [type, cb] = callback
      button.addEventListener(type, cb)
    }
    if (id) button.id = id
    parent.appendChild(button)
  }

  private addSlider(
    name: string,
    parent: HTMLElement,
    eventListener: string,
    callback: (e?: MouseEvent) => void,
    min: number,
    max: number,
    value: number,
    label: string,
  ) {
    const sliderEl = document.createElement('input') as HTMLInputElement
    sliderEl.type = 'range'
    sliderEl.name = name
    sliderEl.id = name
    sliderEl.min = min.toString()
    sliderEl.max = max.toString()
    sliderEl.value = value.toString()
    sliderEl.addEventListener(eventListener, callback)
    parent.appendChild(sliderEl)

    const labelEl = document.createElement('label')
    labelEl.htmlFor = name
    labelEl.innerText = label
    parent.appendChild(labelEl)
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.shiftKey) this.SHIFT = true
  }

  private handleKeyUp() {
    this.SHIFT = false
  }

  private showDisplay() {
    this.editor.classList.remove('hide')
    this.editor.classList.add('show')
    this.overlayCanvas.addEventListener('click', (e) => this.draw(e))
    this.overlayCanvas.addEventListener('mousemove', (e) => this.drawBrush(e))

    document.addEventListener('keydown', (e) => this.handleKeyDown(e))
    document.addEventListener('keyup', () => this.handleKeyUp())
  }

  private hideDisplay() {
    this.editor.classList.add('hide')
    this.editor.classList.remove('show')
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.draw)
    }
    if (this.overlayCanvas) {
      this.overlayCanvas.removeEventListener('mousemove', (e) =>
        this.drawBrush(e),
      )
    }
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
  }

  public get needsUpdate(): boolean {
    const currentStatus = this._needsUpdate
    this._needsUpdate = false
    return currentStatus
  }

  private text2Colour(colour: string): number {
    switch (colour) {
      case 'black':
        return 5
      case 'white':
        return 250
      case 'grey':
      default:
        return 128
    }
  }

  private draw(event: MouseEvent) {
    const { left, top } = this.canvas.getBoundingClientRect()
    const { width } = this.canvas
    const scale = this.screenScale(width)
    const x1 = Math.floor((event.clientX - left) / scale)
    const y1 = Math.floor((event.clientY - top) / scale)

    const x2 = x1 + this._brushSize
    const y2 = y1 + this._brushSize

    const coords: RectCoords = [x1, y1, x2, y2]

    const fillFn = (c: number) => {
      const out = this.SHIFT ? c - 0.1 : c + 0.1
      return out
    }

    this.applyRect(coords, fillFn)
  }

  private drawBrush(event: MouseEvent) {
    const { width: sWidth } = this.canvas
    const { width, height } = this.overlayCanvas
    const scale = this.screenScale(sWidth) / 10

    const { left, top } = this.overlayCanvas.getBoundingClientRect()
    const x = Math.floor(Math.floor((event.clientX - left) / scale) / 10) * 10 // Snap
    const y = Math.floor(Math.floor((event.clientY - top) / scale) / 10) * 10 // Snap

    this.overlayCtx.beginPath()
    this.overlayCtx.clearRect(0, 0, width, height)
    this.overlayCtx.strokeStyle = 'rgba(255,0,0,0.5)'
    this.overlayCtx.rect(x, y, this._brushSize * 10, this._brushSize * 10)
    this.overlayCtx.stroke()
    this.overlayCtx.closePath()
  }

  private updateActivation(
    newData: Float32Array,
    transformation: (...args: unknown[]) => TypedArray,
  ) {
    if (!this.currentActSelection) return
    const { width, height } = this.canvas

    if (this._applyToAll) {
      this.currentActSelection.layer.activations.forEach((quad) => {
        const newData = transformation(quad.data, width, height) as Float32Array
        quad.update(newData)
      })
    } else {
      const { relativeId, layer } = this.currentActSelection
      const quad = layer.activations[relativeId]
      quad.update(newData)
    }
  }

  public remakeActivation(layer: LayerInfo) {
    const { activations } = layer
    const [w, h] = layer.shape.slice(2)
    const layerTensors = activations.map((quad) => {
      return tf.tensor(quad.data).reshape([w, h, 1, 1]).squeeze()
    })

    const act = tf.stack(layerTensors).expandDims(0)

    return { layer, act }
  }

  private autoFillRect(colour: string) {
    const { width, height } = this.canvas

    const rw = Math.floor(width * 0.6)
    const x1 = Math.floor((width - rw) / 2)
    const y1 = Math.floor((height - rw) / 2)
    const x2 = Math.floor(x1 + rw)
    const y2 = Math.floor(y1 + rw)

    this.fillRect(colour, [x1, y1, x2, y2])
  }

  private fillRect(colour: string, coords: RectCoords) {
    const fillColour = this.text2Colour(colour) / 255
    const fillFn = (_: number) => fillColour
    this.applyRect(coords, fillFn)
  }

  private applyRect(coords: RectCoords, fillFn: FillFn) {
    const { width, height } = this.canvas
    const { relativeId, layer } = this.currentActSelection
    const { data } = layer.activations[relativeId]
    const newData = rect(data, width, coords, fillFn)

    const imageData = act2ImageData(newData, width, height)
    this.ctx.putImageData(imageData, 0, 0)

    const transformationFn = (_d: Float32Array, _w: number, _h: number) =>
      rect(_d, width, coords, fillFn)

    this.updateActivation(newData, transformationFn)
  }

  private fill(colour: string) {
    const { width, height } = this.canvas
    const { relativeId, layer } = this.currentActSelection
    const { data } = layer.activations[relativeId]
    const fillColour = this.text2Colour(colour) / 255
    const newData = fill(data, fillColour) /* true: same ref */
    const imageData = act2ImageData(newData, width, height)
    this.ctx.putImageData(imageData, 0, 0)

    const transformationFn = (_d: Float32Array, _w: number, _h: number) =>
      fill(_d, fillColour)

    this.updateActivation(newData, transformationFn)
  }

  private rotate() {
    const { width, height } = this.canvas
    const { relativeId, layer } = this.currentActSelection
    const { data } = layer.activations[relativeId]

    const angle = (Math.PI / 2) * this.rotationCounter++
    const newData = rotate(data, width, height, angle)
    const imageData = act2ImageData(newData, width, height)
    this.ctx.putImageData(imageData, 0, 0)

    const transformationFn = (_d: Float32Array, _w: number, _h: number) =>
      rotate(_d, _w, _h, angle)

    this.updateActivation(newData, transformationFn)
  }

  private screenScale(w: number) {
    const maxLen = Math.min(window.innerHeight, window.innerWidth)
    const targetSize = maxLen * 0.8
    const scale = targetSize / w
    return scale
  }

  private toggleApplyToAll() {
    this._applyToAll = !this._applyToAll
    document.getElementById('all').classList.toggle('active', this._applyToAll)
    console.log(this._applyToAll)
  }

  private showTooltip(message: string) {
    this.tooltipCont.innerText = message
    this.tooltipCont.classList.remove('hide')
    this.tooltipCont.classList.add('show')
  }

  private hideTooltip() {
    this.tooltipCont.classList.remove('show')
    this.tooltipCont.classList.add('hide')
  }

  private updateTooltip(event: MouseEvent) {
    const { clientX, clientY } = event
    this.tooltipCont.style.left = `${clientX + 10}px`
    this.tooltipCont.style.top = `${clientY + 10}px`
  }

  public get applyToAll() {
    return this._applyToAll
  }

  public set brushSize(val: number) {
    this._brushSize = val
  }

  /* private combineRGBData(
    a: Uint8ClampedArray,
    b: Uint8ClampedArray,
    blendMode: string,
  ) {
    const bOff = blendMode === 'alpha' ? 3 : 0
    const grayscale = a.reduce((acc, c, i) => {
      if (i % 4 === 0) {
        const overlayCol = b[i + bOff] / 255
        const origCol = c / 255
        overlayCol > 0 ? acc.push(overlayCol + origCol) : acc.push(origCol)
      }
      return acc
    }, [])
    return new Float32Array(grayscale)
  }

  private combineFloatData(a: Float32Array, b: Float32Array) {
    return a.map((c, i) => {
      return b[i] > 0 ? b[i] : c
    })
  } */
}
