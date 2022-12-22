import * as tf from '@tensorflow/tfjs'
import { ActivationSelection } from './types'

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
        callback: () => this.fillRect('black', [6, 6]),
      },
      {
        text: 'Rotate',
        parent: this.tools,
        id: null,
        callback: () => this.rotate(),
      },
      {
        text: 'DO LAYER',
        parent: this.tools,
        id: null,
        callback: () => this.doLayer(),
      },
      {
        text: 'All',
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
      ({ name, parent, eventListener, callback, min, max, label }) =>
        this.addSlider(name, parent, eventListener, callback, min, max, label),
    )

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    this.editor.appendChild(this.canvas)
    this.editor.appendChild(this.tools)
    document.body.appendChild(this.editor)
  }

  public show(currentAct: ActivationSelection) {
    this.currentActSelection = currentAct
    const { relativeId, layer } = currentAct
    const [w, h] = layer.shape.slice(2)
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${w * this.screenScale(w)}px`
    this.canvas.style.height = `${h * this.screenScale(w)}px`

    const imageData = new ImageData(w, h)
    const { data } = layer.activations[relativeId]
    this.act2RGB(imageData, data)

    this.ctx.putImageData(imageData, 0, 0)
    this.showDisplay()
  }

  private act2RGB(
    imageData: ImageData,
    data: Float32Array | Int32Array | Uint8Array,
  ) {
    const { width: w, height: h } = imageData
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const ix = (y * w + x) * 4
        const iv = y * w + x
        imageData.data[ix + 0] = Math.floor(255 * data[iv])
        imageData.data[ix + 1] = Math.floor(255 * data[iv])
        imageData.data[ix + 2] = Math.floor(255 * data[iv])
        imageData.data[ix + 3] = 255
      }
    }
  }

  private rgb2grayscale(data: ImageData) {
    return data.data.reduce((acc, p, i) => {
      if (i % 4 === 0) {
        acc.push(p / 255)
      }
      return acc
    }, [])
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
    label: string,
  ) {
    const sliderEl = document.createElement('input') as HTMLInputElement
    sliderEl.type = 'range'
    sliderEl.name = name
    sliderEl.id = name
    sliderEl.min = min.toString()
    sliderEl.max = max.toString()
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
    this.updateActivation()
  }

  private brush(x: number, y: number, size: number) {
    const offset = Math.floor(size / 2)

    const p = this.ctx.getImageData(x - offset, y - offset, size, size)
    const adder = this.SHIFT ? 10 : -10

    const newData = p.data.map((c, i) => ((i + 1) % 4 === 0 ? c : c + adder))
    const newImageData = new ImageData(newData, size, size)

    this.ctx.putImageData(newImageData, x - offset, y - offset)
  }

  private doLayer(ctx: CanvasRenderingContext2D) {
    const { width, height } = ctx.canvas
    const imageData = ctx.getImageData(0, 0, width, height)
    const fillColour = this.text2Colour('grey')
    const data = imageData.data.map((c, i) =>
      (i + 1) % 4 === 0 ? c : fillColour,
    )
    const newImageData = new ImageData(data, width, height)
    ctx.putImageData(newImageData, 0, 0)
  }

  private updateActivation() {
    if (!this.currentActSelection) return
    const rgbData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    )
    const grayscaleData = this.rgb2grayscale(rgbData)
    const { relativeId, layer } = this.currentActSelection
    const quad = layer.activations[relativeId]
    quad.update(grayscaleData)
  }

  /* private generateCtxsForLayer() {
    const { activations, shape } =
      this.currentActSelection.layerInfo.layer
    const [w, h] = shape.slice(2)
    const ctxs = activations.map((data: Float32Array) => {
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      const imageData = new ImageData(w, h)
      this.act2RGB(imageData, data)
      ctx.putImageData(imageData, 0, 0)

      return { data, ctx }
    })
    return ctxs
  } */

  public remakeActivation() {
    const { layer } = this.currentActSelection
    const { activations } = layer
    const [w, h] = layer.shape.slice(2)
    const layerTensors: tf.Tensor[] = []
    activations.map((data: Float32Array) => {
      const tensor = tf.tensor(data).reshape([w, h, 1, 1]).squeeze()
      layerTensors.push(tensor)
    })

    const act = tf.stack(layerTensors).expandDims(0)

    return { layer, name, act }
  }

  private fillRect(colour: string, size: [number, number]) {
    const { width, height } = this.canvas
    const fillColour = this.text2Colour(colour)
    const newImageData = new ImageData(...size)
    newImageData.data.fill(fillColour)
    const x_off = Math.floor((width - size[0]) / 2)
    const y_off = Math.floor((height - size[1]) / 2)
    this.ctx.putImageData(newImageData, x_off, y_off)
    this.updateActivation()
  }

  private fill(colour: string) {
    const { width, height } = this.canvas
    const imageData = this.ctx.getImageData(0, 0, width, height)
    const fillColour = this.text2Colour(colour)
    const data = imageData.data.map((c, i) =>
      (i + 1) % 4 === 0 ? c : fillColour,
    )
    const newImageData = new ImageData(data, width, height)
    this.ctx.putImageData(newImageData, 0, 0)
    this.updateActivation()
  }

  private rotate() {
    const { width, height } = this.canvas
    //const imageData = this.ctx.getImageData(0, 0, width, height)
    this.ctx.save()
    this.ctx.translate(width / 2, height / 2)
    this.ctx.rotate((90 * Math.PI) / 180)
    this.ctx.drawImage(this.canvas, -width / 2, -height / 2)
    this.ctx.restore()
    this.updateActivation()
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
}
