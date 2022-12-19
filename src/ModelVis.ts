import { GL_Handler } from 'gl-handler'
import * as tf from '@tensorflow/tfjs'
import Layer from './Layer'
import Generator from './Generator'

export default class ModelVis {
  private layers: tf.layers.Layer[]
  private layerOutputs: { [key: string]: tf.Tensor }
  private layerNames: string[]
  private activationStore: {
    [key: string]: { [key: string]: any }
  }
  private numTensors: 0

  constructor(model: Generator) {
    this.init(model)
    this.activationStore = {}
  }

  public init(model: Generator) {
    const z = tf.randomNormal([1, model.info.latent_dim])
    this.layers = model.getLayers()
    this.layerOutputs = model.getLayerOutputs(this.layers, z)
    this.layerNames = Object.keys(this.layerOutputs)
  }

  public update(model: Generator, z: tf.Tensor2D) {
    this.layerOutputs = model.getLayerOutputs(this.layers, z)
  }

  public generateQuads(gl: GL_Handler, program: WebGLProgram) {
    let offset = 0
    const totalQuads = this.layerNames.reduce((acc, name) => {
      const layer = this.activationStore[name]
      if (!layer) return acc
      const k = Object.keys(layer.activations).length

      return (acc += k)
    }, 0)

    this.layerNames.forEach((name, layerIdx) => {
      const layer = this.activationStore[name]
      if (!layer) return
      const layerInfo = new Layer(
        gl,
        program,
        layer /* layerData */,
        layerIdx,
        offset /* by number of quads in each layer to uuid */,
        totalQuads,
      )
      this.activationStore[name].meshes = layerInfo.quads
      offset += Object.keys(layer.activations).length
    })
    this.numTensors = offset
  }

  /* public updateActivations() {
    this.layerNames.forEach((name, layerIdx) => {
      const layer = this.activationStore[name]
      if (!layer) return
      layer.updateActivations()
      })

  } */

  private separateActivations(act: tf.Tensor) {
    const activations = []

    const shape = act.shape
    const numActs = shape[1]

    for (let i = 0; i < numActs; i++) {
      const newShape = [shape[0], i + 1, shape[2], shape[3]]
      const chunk = act.stridedSlice([0, i, 0, 0], newShape, [1, 1, 1, 1])

      activations.push(chunk.squeeze())
    }
    return activations
  }

  public async getActivations(filter: (n: string) => boolean) {
    this.layerNames.filter(filter).forEach((name) => {
      const layer = this.layerOutputs[name]

      if (layer.shape.length < 3) return /* Filter out non-conv layers */

      this.activationStore[name] = {}
      this.activationStore[name].shape = layer.shape
      this.activationStore[name].activations = []

      const sepActs = this.separateActivations(layer)
      sepActs.forEach((act) => {
        /* const act_id = `${String(i).padStart(3, '0')}` */
        const data = act.dataSync()
        /* this.activationStore[name].activations[act_id] = data */
        this.activationStore[name].activations.push(data)
      })
    })
  }

  public showLayerOnCanvases(layerName: string) {
    const activationsCont =
      document.getElementById('activations') || document.createElement('div')
    activationsCont.id = 'activations'
    document.body.appendChild(activationsCont)

    const acts = this.activationStore[layerName].activations
    const shape = this.activationStore[layerName].shape
    const actIds = Object.keys(acts)

    actIds.forEach((id) => {
      const [w, h] = shape.slice(2)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.id = `act_${id}`
      const ctx = canvas.getContext('2d')
      const imageData = new ImageData(w, h)
      const data = acts[id]
      this.basicCanvasUpdate(imageData, data)
      ctx.putImageData(imageData, 0, 0)
      activationsCont.appendChild(canvas)
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

  public remakeActivations(layers: string[]) {
    const remadeModel: {
      layerName: string
      tensor: tf.Tensor
    }[] = []

    layers.forEach((name) => {
      const layer = this.activationStore[name]
      const activations = layer.activations
      const layerShape = layer.shape
      const [w, h] = layerShape.slice(2)
      const layerTensors: tf.Tensor[] = []
      activations.map((data: Float32Array) => {
        const tensor = tf.tensor(data).reshape([w, h, 1, 1]).squeeze()
        layerTensors.push(tensor)
      })
      const activationMap = tf.stack(layerTensors, -1).expandDims(0)

      remadeModel.push({ layerName: name, tensors: activationMap })
    })

    return remadeModel
  }

  get activations() {
    return this.activationStore
  }

  get maxTensors() {
    return this.numTensors
  }
}
