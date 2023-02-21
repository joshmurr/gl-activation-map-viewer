import * as tf from '@tensorflow/tfjs'
import {
  ActivationSelection,
  FillFn,
  LayerInfo,
  ModelInfo,
  RectCoords,
} from './types'

import { fill, rect, rotate, scale } from './transformations'
import { act2ImageData } from './conversions'
import { TypedArray } from './typedArrays'
import { getLayerDims, swapClasses } from './utils'

type Callback = (e?: MouseEvent) => void
type NamedCallback = [name: string, cb: Callback]
type TransformationFn = (
  data: Float32Array,
  width: number,
  height: number,
  ...args: unknown[]
) => Float32Array

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
  private _needsUpdate = false
  private _applyToAll = false
  private currentActSelection: ActivationSelection
  private _brushSize = 3
  private _scaleFactor = 1
  private _overlayGridScaleFactor = 10
  private rotationCounter = 1
  private _buttons: HTMLButtonElement[] = []
  private _sliders: HTMLInputElement[] = []

  constructor() {
    this.buildContainer()
    this.activationsCont = document.createElement('div')
    this.activationsCont.id = 'activations'
    document.body.appendChild(this.activationsCont)
  }

  private buildContainer() {
    this.editor = document.createElement('div')
    this.editor.id = 'editor'
    const editorWrapper = document.createElement('div')
    editorWrapper.classList.add('editor-wrapper')

    this.tools = document.createElement('div')
    this.tools.id = 'tools'

    const buttons = [
      {
        text: '&check;',
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
        text: 'Scale',
        parent: this.tools,
        id: null,
        callbacks: [['click', () => this.scale()]],
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
        label: 'Brush Size:',
        min: 1,
        max: 12,
        step: 1,
        value: 6,
        outputId: 'brush-size',
        callback: () => {
          const el = document.querySelector(
            'input[name="brush"]',
          ) as HTMLInputElement
          const val = el.value
          this.brushSize = Number(val)
          document.getElementById('brush-size').innerText = val
        },
        parent: this.tools,
      },
      {
        name: 'scale',
        eventListener: 'change',
        label: 'Scale Factor:',
        min: 0.5,
        max: 2,
        step: 0.1,
        value: 1,
        outputId: 'scale-factor',
        callback: () => {
          const el = document.querySelector(
            'input[name="scale"]',
          ) as HTMLInputElement
          const val = el.value
          this._scaleFactor = 1 / Number(val)
          document.getElementById('scale-factor').innerText = val
        },
        parent: this.tools,
      },
    ]

    sliders.forEach(
      ({
        name,
        parent,
        eventListener,
        callback,
        min,
        max,
        step,
        value,
        label,
        outputId,
      }) =>
        this.addSlider(
          name,
          parent,
          eventListener,
          callback,
          min,
          max,
          step,
          value,
          label,
          outputId,
        ),
    )

    this.tooltipCont = document.createElement('div')
    this.tooltipCont.classList.add('tooltip', 'hide')

    const canvasCont = document.createElement('div')
    canvasCont.classList.add('canvas-cont')

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    this.overlayCanvas = document.createElement('canvas')
    this.overlayCtx = this.overlayCanvas.getContext('2d')
    this.overlayCtx.globalCompositeOperation = 'multiply'

    canvasCont.appendChild(this.canvas)
    canvasCont.appendChild(this.overlayCanvas)

    editorWrapper.appendChild(canvasCont)
    editorWrapper.appendChild(this.tools)

    this.editor.appendChild(editorWrapper)

    this.tools.appendChild(this.tooltipCont)

    document.body.appendChild(this.editor)
    this.hideDisplay()
  }

  public show(currentAct: ActivationSelection, { data_format }: ModelInfo) {
    this.rotationCounter = 1
    this.currentActSelection = currentAct
    const { relativeId, layer } = currentAct
    const [w, h] = getLayerDims(layer.shape, data_format)

    console.log(layer.shape)

    this.enableTools()

    this.initCanvas(this.canvas, w, h)
    this.initCanvas(this.overlayCanvas, w, h, this._overlayGridScaleFactor)

    const { data } = layer.activations[relativeId]
    const imageData = act2ImageData(data, w, h)

    this.ctx.putImageData(imageData, 0, 0)
    this.showDisplay()
  }

  public showOutput(width: number, height: number) {
    this.initCanvas(this.canvas, width, height)
    this.disableTools()
    this.showDisplay()
  }

  private disableTools() {
    this._buttons.forEach((button) => {
      if (button.id === 'close') return
      button.disabled = true
    })
    this._sliders.forEach((slider) => {
      slider.disabled = true
    })
  }

  private enableTools() {
    this._buttons.forEach((button) => {
      button.disabled = false
    })
    this._sliders.forEach((slider) => {
      slider.disabled = false
    })
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

    const canvasContainer = document.querySelector(
      '.canvas-cont',
    ) as HTMLElement
    canvasContainer.style.width = `${w * this.screenScale(w)}px`
    canvasContainer.style.height = `${h * this.screenScale(w)}px`
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
    /* Using a for .. of to preserve `this` */
    for (const callback of callbacks) {
      const [type, cb] = callback
      button.addEventListener(type, cb)
    }
    if (id) button.id = id
    parent.appendChild(button)

    this._buttons.push(button)
  }

  private addSlider(
    name: string,
    parent: HTMLElement,
    eventListener: string,
    callback: (e?: MouseEvent) => void,
    min: number,
    max: number,
    step: number,
    value: number,
    label: string,
    outputId: string,
  ) {
    const container = document.createElement('div')
    container.classList.add('slider-container')

    const sliderEl = document.createElement('input') as HTMLInputElement
    sliderEl.type = 'range'
    sliderEl.name = name
    sliderEl.id = name
    sliderEl.min = min.toString()
    sliderEl.max = max.toString()
    sliderEl.step = step.toString()
    sliderEl.value = value.toString()
    sliderEl.addEventListener(eventListener, callback)
    container.appendChild(sliderEl)

    const textContainer = document.createElement('div')
    textContainer.classList.add('text-container')

    const labelEl = document.createElement('label')
    labelEl.htmlFor = name
    labelEl.innerText = label + ' '

    const valOutput = document.createElement('span')
    valOutput.innerText = value.toString()
    valOutput.id = outputId

    textContainer.appendChild(labelEl)
    textContainer.appendChild(valOutput)

    container.appendChild(textContainer)
    parent.appendChild(container)

    this._sliders.push(sliderEl)
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.shiftKey) this.SHIFT = true
  }

  private handleKeyUp() {
    this.SHIFT = false
  }

  private showDisplay() {
    swapClasses(this.editor, 'hide', 'show')
    this.overlayCanvas.addEventListener('click', (e) => this.draw(e))
    this.overlayCanvas.addEventListener('mousemove', (e) => this.drawBrush(e))

    document.addEventListener('keydown', (e) => this.handleKeyDown(e))
    document.addEventListener('keyup', () => this.handleKeyUp())
  }

  public hideDisplay() {
    swapClasses(this.editor, 'show', 'hide')
    this.toggleApplyToAll(false)
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

  private text2FloatColour(colour: string) {
    return this.text2Colour(colour) / 255
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
    const scale = this.screenScale(sWidth) / this._overlayGridScaleFactor

    const { left, top } = this.overlayCanvas.getBoundingClientRect()
    const x =
      Math.floor(
        Math.floor((event.clientX - left) / scale) /
          this._overlayGridScaleFactor,
      ) * this._overlayGridScaleFactor // Snap
    const y =
      Math.floor(
        Math.floor((event.clientY - top) / scale) /
          this._overlayGridScaleFactor,
      ) * this._overlayGridScaleFactor // Snap

    this.overlayCtx.beginPath()
    this.overlayCtx.clearRect(0, 0, width, height)
    this.overlayCtx.strokeStyle = 'rgba(255,0,0,0.8)'
    this.overlayCtx.lineWidth = 1
    this.overlayCtx.rect(
      x,
      y,
      this._brushSize * this._overlayGridScaleFactor,
      this._brushSize * this._overlayGridScaleFactor,
    )
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

  public remakeActivation(layer: LayerInfo, { data_format }: ModelInfo) {
    const { activations } = layer
    const [w, h] = getLayerDims(layer.shape, data_format)
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

    const coords: RectCoords = [x1, y1, x2, y2]

    const fillColour = this.text2FloatColour(colour)
    const fillFn = (_: number) => fillColour
    this.applyRect(coords, fillFn)
  }

  private genericTransformation(
    transformationFn: TransformationFn,
    ...args: unknown[]
  ) {
    const { width, height } = this.canvas
    const { relativeId, layer } = this.currentActSelection
    const { data } = layer.activations[relativeId]

    const newData = transformationFn(data, width, height, ...args)

    const imageData = act2ImageData(newData, width, height)
    this.ctx.putImageData(imageData, 0, 0)

    const deferredTransormation = (_d: Float32Array, _w: number, _h: number) =>
      transformationFn(_d, _w, _h, ...args)

    this.updateActivation(newData, deferredTransormation)
  }

  private applyRect(coords: RectCoords, fillFn: FillFn) {
    this.genericTransformation(rect, coords, fillFn)
  }

  private fill(colour: string) {
    const colourValue = this.text2FloatColour(colour)
    this.genericTransformation(fill, colourValue)
  }

  private rotate() {
    const angle = (Math.PI / 2) * this.rotationCounter++
    this.genericTransformation(rotate, angle)
  }

  private scale() {
    this.genericTransformation(scale, this._scaleFactor)
  }

  private screenScale(w: number) {
    const maxLen = Math.min(window.innerHeight, window.innerWidth)
    const targetSize = maxLen * 0.75
    const scale = targetSize / w
    return scale
  }

  private toggleApplyToAll(force?: boolean) {
    this._applyToAll = typeof force === 'boolean' ? force : !this._applyToAll
    console.log(`applyToAll: ${this._applyToAll}`)
    document.getElementById('all').classList.toggle('active', this._applyToAll)
  }

  private showTooltip(message: string) {
    this.tooltipCont.innerText = message
    swapClasses(this.tooltipCont, 'hide', 'show')
  }

  private hideTooltip() {
    swapClasses(this.tooltipCont, 'show', 'hide')
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

  public set scaleFactor(val: number) {
    this._scaleFactor = val
  }

  public get displayCanvas() {
    return this.canvas
  }
}
