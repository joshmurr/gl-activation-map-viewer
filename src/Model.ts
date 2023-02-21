import * as tf from '@tensorflow/tfjs'
import { ModelInfo } from './types'

export default class Model {
  protected training = false
  protected model: tf.LayersModel
  protected _loaded = false

  public info: ModelInfo

  constructor(info: ModelInfo) {
    this.info = info
  }

  public async load(opts: { [key: string]: unknown }) {
    this.model = await tf.loadLayersModel(this.info.url, opts)
    this._loaded = true
  }

  public getLayers() {
    if (!this.loaded) return
    const layers = []
    for (let i = 0; i <= this.model.layers.length - 1; i++) {
      const layer = this.model.getLayer(undefined, i)
      layers.push(layer)
    }
    return layers
  }

  get loaded() {
    return this._loaded
  }

  public dispose() {
    this.model.dispose()
    tf.disposeVariables()
  }
}
