import * as tf from '@tensorflow/tfjs'
import {
  ActivationSelection,
  EditorButton,
  FillFn,
  LayerInfo,
  ModelInfo,
  NamedCallback,
  RectCoords,
} from './types'
import Draggable from './Draggable'

import { fill, rect, rotate, scale, TransformationFn } from './transformations'
import { act2ImageData } from './conversions'
import { getLayerDims, swapClasses } from './utils'

type TransformationCache = {
  name: string
  transformationFn: TransformationFn
  applyToAll: boolean
  args: unknown[]
}

export default class Editor {
  private editor: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private overlayCanvas: HTMLCanvasElement
  private overlayCtx: CanvasRenderingContext2D

  private tools: HTMLElement
  private tooltipCont: HTMLElement
  private SHIFT = false
  private _needsUpdate = false
  private _applyToAll = true
  private currentActSelection: ActivationSelection
  private _brushSize = 3
  private _scaleFactor = 1
  private _overlayGridScaleFactor = 10
  private _buttons: HTMLButtonElement[] = []
  private _sliders: HTMLInputElement[] = []
  private _nFillColors = 10
  private _fillColor = 'rgb(0, 0, 0)'
  private _transformationCache: TransformationCache[] = []
  private _changesMade = false

  constructor() {
    this.buildContainer()
  }

  private buildContainer() {
    const draggable = new Draggable({ top: '0%', left: '0%' })
    this.editor = draggable.container //document.createElement('div')
    this.editor.id = 'editor'
    const editorWrapper = document.createElement('div')
    editorWrapper.classList.add('editor-wrapper')

    this.tools = document.createElement('div')
    this.tools.id = 'tools'

    const topRow = document.createElement('div')
    const bottomRow = document.createElement('div')

    const finalRow = document.createElement('div')

    topRow.classList.add('row')
    bottomRow.classList.add('row')
    finalRow.classList.add('row')

    const buttons: EditorButton[] = [
      {
        text: 'Cancel',
        parent: finalRow,
        id: 'cancel',
        classList: ['cancel'],
        callbacks: [
          [
            'click',
            () => {
              this._transformationCache = []
              this.hideDisplay()
            },
          ],
        ],
      },
      {
        text: 'Commit Changes',
        parent: finalRow,
        id: 'commit',
        classList: ['commit'],
        callbacks: [
          [
            'click',
            () => {
              this.updateActivation()
              this.hideDisplay()
            },
          ],
          [
            'mouseover',
            () => this.showTooltip(this.stringifyTransformationCache()),
          ],
          ['mouseout', () => this.hideTooltip()],
          ['mousemove', (e: MouseEvent) => this.updateTooltip(e)],
        ],
      },
      {
        text: 'Fill',
        parent: topRow,
        id: null,
        callbacks: [['click', () => this.fill(this._fillColor)]],
      },
      {
        text: 'Rect',
        parent: topRow,
        id: null,
        callbacks: [['click', () => this.autoFillRect(this._fillColor)]],
      },
      {
        text: 'Rotate',
        parent: topRow,
        id: null,
        callbacks: [['click', () => this.rotate()]],
      },
      {
        text: 'Scale',
        parent: topRow,
        id: null,
        callbacks: [['click', () => this.scale()]],
      },
      {
        text: 'Apply to Stack',
        parent: topRow,
        id: 'apply-to-all',
        classList: ['active'],
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

    buttons.forEach(({ text, parent, callbacks, id, classList }) =>
      this.addButton(text, parent, callbacks, id, classList),
    )

    const colorPicker = this.makeColorPicker()
    bottomRow.appendChild(colorPicker)

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
        parent: bottomRow,
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
        parent: bottomRow,
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
    this.tools.appendChild(topRow)
    this.tools.appendChild(bottomRow)
    this.tools.appendChild(finalRow)
    editorWrapper.appendChild(this.tools)

    this.editor.appendChild(editorWrapper)

    this.tools.appendChild(this.tooltipCont)

    document.body.appendChild(this.editor)
    this.hideDisplay()
  }

  public show(currentAct: ActivationSelection, { data_format }: ModelInfo) {
    this.currentActSelection = currentAct
    const { relativeId, layer } = currentAct
    const [w, h] = getLayerDims(layer.shape, data_format)

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
    classList?: string[],
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
    if (classList) button.classList.add(...classList)
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
    container.classList.add('vertical-container')

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

  private makeColorPicker() {
    function handleMouseOver() {
      this.classList.add('highlight')
    }
    function handleMouseOut() {
      this.classList.remove('highlight')
    }
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      this._fillColor = target.style.backgroundColor
      this.removeClassFromSiblings(target, 'chosen')
      target.classList.add('chosen')
    }

    const container = document.createElement('div')
    container.classList.add('vertical-container')

    const swatches = document.createElement('div')
    swatches.classList.add('color-picker')
    const colors = [...new Array(this._nFillColors - 1)].map((_, i) =>
      Math.floor(255 * (i / (this._nFillColors - 1))),
    )
    colors.push(255)
    colors.forEach((color) => {
      const swatch = document.createElement('span')
      swatch.classList.add('swatch')
      swatch.style.backgroundColor = `rgb(${color}, ${color}, ${color})`

      swatch.addEventListener('mouseover', handleMouseOver)
      swatch.addEventListener('mouseout', handleMouseOut)
      swatch.addEventListener('click', handleClick)

      swatches.appendChild(swatch)
    })

    container.appendChild(swatches)

    const text = document.createElement('p')
    text.innerText = 'Fill colour'
    text.classList.add('text-container', 'reset')

    container.appendChild(text)

    return container
  }

  private removeClassFromSiblings(el: HTMLElement, className: string) {
    const siblings = el.parentNode.children
    for (const child of siblings) {
      child.classList.remove(className)
    }
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
    /* this.toggleApplyToAll(false) */
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

  private rgbStringToFloatColours(rgbString: string) {
    const start = rgbString.indexOf('(') + 1
    const stop = rgbString.indexOf(',')
    const greyscaleVal = Number(rgbString.slice(start, stop))
    return greyscaleVal / 255
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

  private updateActivation() {
    if (!this.currentActSelection) return
    const { width, height } = this.canvas

    this._transformationCache.forEach(({ transformationFn, applyToAll }) => {
      if (applyToAll) {
        this.currentActSelection.layer.activations.forEach((quad) => {
          const newData = transformationFn(quad.data, width, height)
          quad.update(newData)
        })
      } else {
        const { relativeId, layer } = this.currentActSelection
        const quad = layer.activations[relativeId]
        const newData = transformationFn(quad.data, width, height)
        quad.update(newData)
      }
    })

    this._transformationCache = []
    this._changesMade = true
  }

  public remakeActivation(layer: LayerInfo, { data_format }: ModelInfo) {
    const { activations } = layer
    const [w, h] = getLayerDims(layer.shape, data_format)
    const layerTensors = activations.map((quad) => {
      return tf.tensor(quad.data).reshape([w, h, 1, 1]).squeeze()
    })

    const axis = data_format === 'channels_first' ? 0 : -1
    const act = tf.stack(layerTensors, axis).expandDims(0)

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

    const colourValue = this.rgbStringToFloatColours(colour)
    const fillFn = (_: number) => colourValue
    this.applyRect(coords, fillFn, colourValue)
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
    deferredTransormation.displayName = transformationFn.displayName

    this._transformationCache.push({
      name: transformationFn.displayName,
      transformationFn: deferredTransormation,
      applyToAll: this._applyToAll,
      args: args,
    })
  }

  private applyRect(coords: RectCoords, fillFn: FillFn, ...args: unknown[]) {
    this.genericTransformation(rect, coords, fillFn, args)
  }

  private fill(colour: string) {
    const colourValue = this.rgbStringToFloatColours(colour)
    this.genericTransformation(fill, colourValue)
  }

  private rotate() {
    const angle = Math.PI / 2
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
    document
      .getElementById('apply-to-all')
      .classList.toggle('active', this._applyToAll)
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
    const { offsetHeight: tooltipHeight } = this.tooltipCont
    const offsetY =
      clientY + tooltipHeight + 30 > window.innerHeight
        ? clientY - tooltipHeight - 10
        : clientY + 10

    this.tooltipCont.style.left = `${clientX + 10}px`
    this.tooltipCont.style.top = `${offsetY}px`
  }

  private stringifyTransformationCache() {
    const transformationDescriptionReducer = ({
      name,
      args,
    }: Omit<TransformationCache, 'transformationFn' | 'applyToAll'>) => {
      switch (name) {
        case 'Scale':
          return `Scaling by a factor of ${(args[0] as number).toFixed(2)}`
        case 'Rotate':
          return `Rotating ${args[0]} times.`
        case 'Fill':
          return `Filling entire image with ${(args[0] as number).toFixed(2)}`
        case 'Fill Rect':
          return `Drawing a rectangle with colour ${(
            (args[args.length - 1] as number[])[0] as number
          ).toFixed(2)}`
      }
    }

    return this._transformationCache.reduce(
      (output, { name, applyToAll, args }) => {
        return (
          output +
          `${transformationDescriptionReducer({ name, args })}${
            applyToAll ? ' stack\n' : '\n'
          }`
        )
      },
      'Pending Transformations:\n',
    )
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

  public get changesMade() {
    return this._changesMade
  }
  public set changesMade(val: boolean) {
    this._changesMade = val
  }
}
