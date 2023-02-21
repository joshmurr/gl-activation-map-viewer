import type { GL_Handler } from 'gl-handler'
import * as tf from '@tensorflow/tfjs'
import { LayerInfo, ModelInfo } from './types'
import QuadFactory from './QuadFactory'
import type Generator from './Generator'
import { getLayerDims } from './utils'
export default class ModelVis {
  private _tfLayers: tf.layers.Layer[]
  private layerOutputs: { [key: string]: tf.Tensor }
  private layerNames: string[]
  private _layers: LayerInfo[] = []
  private numTensors = 0
  private model: Generator

  constructor() {}

  public init(model: Generator) {
    this.model = model
    const z = tf.randomNormal([1, model.info.latent_dim])
    this._tfLayers = model.getLayers()
    this.layerOutputs = model.getLayerOutputs(this._tfLayers, z)
    this.layerNames = Object.keys(this.layerOutputs)
  }

  public update(z: tf.Tensor2D) {
    this._tfLayers = this.model.getLayers()
    this.layerOutputs = this.model.getLayerOutputs(this._tfLayers, z)
  }

  private separateActivations(act: tf.Tensor, data_format: string) {
    const activations = []

    const shape = act.shape
    const numActs = data_format === 'channels_first' ? shape[1] : shape[3]

    if (shape.length < 3) {
      for (let i = 0; i < numActs; i++) {
        const newShape = [shape[0], i + 1]
        const chunk = act.stridedSlice([0, i], newShape, [1, 1])

        activations.push(chunk.squeeze())
      }
    } else {
      for (let i = 0; i < numActs; i++) {
        const newShape =
          data_format === 'channels_first'
            ? [shape[0], i + 1, shape[2], shape[3]]
            : [shape[0], shape[1], shape[2], i + 1]

        const inShape =
          data_format === 'channels_first' ? [0, i, 0, 0] : [0, 0, 0, i]

        const chunk = act.stridedSlice(inShape, newShape, [1, 1, 1, 1])

        activations.push(chunk.squeeze())
      }
    }
    return activations
  }

  public getActivations(
    G: GL_Handler,
    program: WebGLProgram,
    { data_format }: ModelInfo,
  ) {
    this._layers = []
    let offset = 0
    this.layerNames.forEach((name, layerIdx) => {
      const layer = this.layerOutputs[name]

      /**
       * -- Filter out non-conv layers --
       * You can render all layers now if you want, but it runs super slow.
       * It would be nice to generate textures, rather than 8000-odd
       * quads for the input layer, and just render those on a cuboid,
       * but that's a-whole-nother thing.
       */
      if (layer.shape.length < 3) {
        return
      }

      /* const [w, h] = layer.shape.length < 3 ? [1, 1] : layer.shape.slice(2) */
      const [w, h] = getLayerDims(layer.shape, data_format)

      const layerInfo: LayerInfo = {
        name,
        shape: layer.shape,
        activations: [],
      }

      const quadFactory = new QuadFactory(G, program, [w, h])

      const sepActs = this.separateActivations(layer, data_format)
      sepActs.forEach((act, actIdx) => {
        const data = act.dataSync()
        const activation = quadFactory.generate(
          data,
          actIdx,
          layerIdx,
          sepActs.length,
          offset,
        )
        layerInfo.activations.push(activation)
      })
      this._layers.push(layerInfo)
      offset +=
        data_format === 'channels_first' ? layer.shape[1] : layer.shape[3]
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

  get layers() {
    return this._layers
  }

  get maxTensors() {
    return this.numTensors
  }

  get tfLayers() {
    return this._tfLayers
  }
}
