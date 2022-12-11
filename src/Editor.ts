import * as tf from '@tensorflow/tfjs'
import { DrawCallback, PixelData } from './types'
import { float32toUint8 } from './utils'

export default class Editor {
  private editor: HTMLElement
  private activationsCont: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tools: HTMLElement
  private SHIFT = false
  private SCALE = 25
  private _needsUpdate = false
  private _applyToAll = false
  private currentUpdateActCB: DrawCallback
  private currentKernel: string

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
        text: 'All',
        parent: this.tools,
        id: 'all',
        callback: () => this.toggleApplyToAll(),
      },
    ]

    buttons.forEach(({ text, parent, callback, id }) =>
      this.addButton(text, parent, callback, id),
    )

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')

    this.editor.appendChild(this.canvas)
    this.editor.appendChild(this.tools)
    document.body.appendChild(this.editor)
  }

  public show(currentAct: unknown) {
    const { data, layerShape } = currentAct
    const [w, h] = layerShape
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${w * this.SCALE}px`
    this.canvas.style.height = `${h * this.SCALE}px`

    const imageData = new ImageData(w, h)
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
    const x = Math.floor((event.clientX - rect.left) / this.SCALE)
    const y = Math.floor((event.clientY - rect.top) / this.SCALE)
    const p = this.ctx.getImageData(x, y, 1, 1)
    const data = p.data
    const adder = this.SHIFT ? 10 : -10
    data[0] += adder
    data[1] += adder
    data[2] += adder
    this.ctx.putImageData(p, x, y)
    if (this.currentUpdateActCB) {
      this._needsUpdate = true
      this.currentUpdateActCB(this.currentKernel, { p, x, y })
    }
  }

  imageToTensor(data: ImageData): tf.Tensor {
    const grayscale = data.data.reduce((acc, p, i) => {
      if (i % 4 === 0) {
        acc.push(p / 255)
      }
      return acc
    }, [])

    const tensor = tf.tensor(grayscale).reshape([data.width, data.height, 1, 1])

    return tensor
  }

  public remakeActivation() {
    const activations = this.activationsCont.getElementsByTagName('canvas')
    const { layer } = this.activationsCont.dataset
    const remake: tf.Tensor[] = []
    for (let i = 0; activations[i]; i++) {
      const act = activations[i]
      const ctx = act.getContext('2d')
      const data = ctx.getImageData(0, 0, act.width, act.height)
      const tensor = this.imageToTensor(data).squeeze()
      remake.push(tensor)
    }

    const act = tf.stack(remake, -1).expandDims(0)
    return { layer, act }
  }

  private fillRect(colour: string, size: [number, number]) {
    const { width, height } = this.canvas
    //const imageData = this.ctx.getImageData(0, 0, width, height)
    const fillColour = this.text2Colour(colour)
    const newImageData = new ImageData(...size)
    newImageData.data.fill(fillColour)
    const x_off = Math.floor((width - size[0]) / 2)
    const y_off = Math.floor((height - size[1]) / 2)
    this.ctx.putImageData(newImageData, x_off, y_off)
    if (this.currentUpdateActCB) {
      this._needsUpdate = true
      this.currentUpdateActCB(this.currentKernel, {
        p: newImageData,
        x: x_off,
        y: y_off,
      })
    }
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
    if (this.currentUpdateActCB) {
      this._needsUpdate = true
      this.currentUpdateActCB(this.currentKernel, {
        p: newImageData,
        x: 0,
        y: 0,
      })
    }
  }

  private rotate() {
    const { width, height } = this.canvas
    //const imageData = this.ctx.getImageData(0, 0, width, height)
    this.ctx.save()
    this.ctx.translate(width / 2, height / 2)
    this.ctx.rotate((90 * Math.PI) / 180)
    this.ctx.drawImage(this.canvas, -width / 2, -height / 2)
    this.ctx.restore()
    if (this.currentUpdateActCB) {
      this._needsUpdate = true
      this.currentUpdateActCB(this.currentKernel, {
        p: this.ctx.getImageData(0, 0, width, height),
        x: 0,
        y: 0,
      })
    }
  }

  private separateActivations(act: tf.Tensor) {
    const activations = []

    const shape = act.shape
    const numActs = shape[3]

    for (let i = 0; i < numActs; i++) {
      const newShape = [shape[0], shape[1], shape[2], i + 1]
      const chunk = act.stridedSlice([0, 0, 0, i], newShape, [1, 1, 1, 1])

      activations.push(chunk.squeeze())
    }
    return activations
  }

  public showActivation(layerName: string, act: tf.Tensor) {
    const sepActs = this.separateActivations(act)
    const store: { [key: string]: HTMLCanvasElement } = {}
    this.activationsCont.innerHTML = ''
    this.activationsCont.dataset.layer = layerName
    sepActs.forEach((act, i) => {
      const [w, h] = act.shape
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const act_id = `$a_${String(i).padStart(2, '0')}`
      canvas.id = act_id
      const ctx = canvas.getContext('2d')
      const imageData = new ImageData(w, h)
      const data = act.dataSync()
      this.basicCanvasUpdate(imageData, data)
      ctx.putImageData(imageData, 0, 0)
      canvas.addEventListener('click', (e) => {
        this.show(e, this.updateActivation)
      })
      this.activationsCont.appendChild(canvas)
      store[act_id] = canvas
    })
  }

  private basicCanvasUpdate(
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

  public updateActivation(id: string, data: PixelData) {
    const canvas = <HTMLCanvasElement>document.getElementById(id)
    const canvasesToUpdate = this._applyToAll
      ? this.activationsCont.getElementsByTagName('canvas')
      : [canvas]
    for (let i = 0; i < canvasesToUpdate.length; i++) {
      const canvas = canvasesToUpdate[i]
      const ctx = canvas.getContext('2d')
      ctx.putImageData(data.p, data.x, data.y)
    }
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
}