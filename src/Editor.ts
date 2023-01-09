import * as tf from '@tensorflow/tfjs'
import { ActivationSelection, LayerInfo, RectCoords } from './types'

import { fill, fillRect, rotate } from './transformations'
import { act2ImageData } from './conversions'
import { TypedArray } from './typedArrays'

export default class Editor {
  private editor: HTMLElement
  private activationsCont: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tools: HTMLElement
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
        text: 'close',
        parent: this.editor,
        id: null,
        callback: () => this.hideDisplay(),
      },
      {
        text: 'Black',
        parent: this.tools,
        id: null,
        callback: () => this.fill('black'),
      },
      {
        text: 'White',
        parent: this.tools,
        id: null,
        callback: () => this.fill('white'),
      },
      {
        text: 'Grey',
        parent: this.tools,
        id: null,
        callback: () => this.fill('grey'),
      },
      {
        text: 'Rect',
        parent: this.tools,
        id: null,
        callback: () => this.fillRect('grey'),
      },
      {
        text: 'Rotate',
        parent: this.tools,
        id: null,
        callback: () => this.rotate(),
      },
      {
        text: 'Apply to Stack',
        parent: this.tools,
        id: 'all',
        callback: () => this.toggleApplyToAll(),
      },
    ]

    buttons.forEach(({ text, parent, callback, id }) =>
      this.addButton(text, parent, callback, id),
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

    const canvasCont = document.createElement('div')
    canvasCont.classList.add('canvasCont')

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    canvasCont.appendChild(this.canvas)
    this.editor.appendChild(canvasCont)
    this.editor.appendChild(this.tools)
    document.body.appendChild(this.editor)
  }

  public show(currentAct: ActivationSelection) {
    this.rotationCounter = 1
    this.currentActSelection = currentAct
    const { relativeId, layer } = currentAct
    const [w, h] = layer.shape.slice(2)
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${w * this.screenScale(w)}px`
    this.canvas.style.height = `${h * this.screenScale(w)}px`

    const canvasContainer = document.querySelector('.canvasCont') as HTMLElement
    canvasContainer.style.width = `${w * this.screenScale(w)}px`
    canvasContainer.style.height = `${h * this.screenScale(w)}px`

    const { data } = layer.activations[relativeId]
    const imageData = act2ImageData(data, w, h)

    this.ctx.putImageData(imageData, 0, 0)
    this.showDisplay()
  }

  private addButton(
    text: string,
    parent: HTMLElement,
    callback: (e?: MouseEvent) => void,
    id?: string,
  ) {
    const button = document.createElement('span')
    button.innerText = text
    button.addEventListener('click', callback)
    button.id = id ? id : null
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
    this.canvas.addEventListener('click', (e) => {
      this.draw(e)
    })

    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e)
    })
    document.addEventListener('keyup', () => {
      this.handleKeyUp()
    })
  }

  private hideDisplay() {
    this.editor.classList.add('hide')
    this.editor.classList.remove('show')
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.draw)
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
    const rect = this.canvas.getBoundingClientRect()
    const { width } = this.canvas
    const scale = this.screenScale(width)
    const x = Math.floor((event.clientX - rect.left) / scale)
    const y = Math.floor((event.clientY - rect.top) / scale)

    this.brush(x, y, this._brushSize)
    /* this.updateActivation('alpha') */
  }

  private brush(x: number, y: number, size: number) {
    const offset = Math.floor(size / 2)

    const p = this.ctx.getImageData(x - offset, y - offset, size, size)
    const adder = this.SHIFT ? 10 : -10

    const newData = p.data.map((c, i) => ((i + 1) % 4 === 0 ? c + adder : 255))
    const newImageData = new ImageData(newData, size, size)

    this.ctx.putImageData(newImageData, x - offset, y - offset)
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

  private fillRect(colour: string) {
    const { width, height } = this.canvas
    const { relativeId, layer } = this.currentActSelection
    const { data } = layer.activations[relativeId]
    const fillColour = this.text2Colour(colour) / 255

    const rw = Math.floor(width * 0.6)
    const x1 = Math.floor((width - rw) / 2)
    const y1 = Math.floor((height - rw) / 2)
    const x2 = Math.floor(x1 + rw)
    const y2 = Math.floor(y1 + rw)

    const coords: RectCoords = [x1, y1, x2, y2]
    const newData = fillRect(data, width, coords, fillColour)

    const imageData = act2ImageData(newData, width, height)
    this.ctx.putImageData(imageData, 0, 0)

    const transformationFn = (_d: Float32Array, _w: number, _h: number) =>
      fillRect(_d, width, coords, fillColour)

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
    document
      .getElementById('all')
      .classList.toggle('highlight', this._applyToAll)
    console.log(this._applyToAll)
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
