import type { GL_Handler } from 'gl-handler'
import * as tf from '@tensorflow/tfjs'
import { ActivationStore, LayerInfo } from './types'
import QuadFactory from './QuadFactory'
import type Generator from './Generator'

export default class ModelVis {
  private _tfLayers: tf.layers.Layer[]
  private layerOutputs: { [key: string]: tf.Tensor }
  private layerNames: string[]
  private activationStore: ActivationStore
  private _layers: LayerInfo[] = []
  private numTensors = 0
  private model: Generator

  constructor(model: Generator) {
    this.model = model
    this.init(model)
    this.activationStore = {}
  }

  public init(model: Generator) {
    const z = tf.randomNormal([1, model.info.latent_dim])
    this._tfLayers = model.getLayers()
    this.layerOutputs = model.getLayerOutputs(this._tfLayers, z)
    this.layerNames = Object.keys(this.layerOutputs)
  }

  public update(z: tf.Tensor2D) {
    this._tfLayers = this.model.getLayers()
    this.layerOutputs = this.model.getLayerOutputs(this._tfLayers, z)
  }

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

  public async getActivations(G: GL_Handler, program: WebGLProgram) {
    this._layers = []
    let offset = 0
    this.layerNames.forEach((name, layerIdx) => {
      const layer = this.layerOutputs[name]

      /* Filter out non-conv layers */
      if (layer.shape.length < 3) {
        return
      }

      const layerInfo: LayerInfo = {
        name,
        shape: layer.shape,
        activations: [],
      }

      const quadFactory = new QuadFactory(G, program, layer.shape)

      const sepActs = this.separateActivations(layer)
      sepActs.forEach((act, actIdx) => {
        const data = act.dataSync()
        const activation = quadFactory.generate(data, actIdx, layerIdx, offset)
        layerInfo.activations.push(activation)
      })
      this._layers.push(layerInfo)
      offset += layer.shape[1]
    })

    this.numTensors = offset

    return this._layers
  }

  public putActivations(layer: LayerInfo, act: tf.Tensor) {
    const sepActs = this.separateActivations(act)
    sepActs.forEach((act, actIdx) => {
      const data = act.dataSync()
      const quad = layer.activations[actIdx]
      quad.update(data)
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

  get __layers() {
    return this._layers
  }

  get maxTensors() {
    return this.numTensors
  }

  get tfLayers() {
    return this._tfLayers
  }
}
