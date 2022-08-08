import * as tf from '@tensorflow/tfjs'
import Model from './Model'
import { ModelInfo } from './types'

export default class Generator extends Model {
  constructor(info: ModelInfo) {
    super(info)
  }

  public async run() {
    const y = tf.tidy(() => {
      const z = tf.randomNormal([1, this.info.latent_dim])
      const y = this.model
        .predict(z)
        .squeeze()
        .transpose([1, 2, 0])
        .div(tf.scalar(2))
        .add(tf.scalar(0.5))
      //return image_enlarge(y, draw_multiplier)
      return y
    })
    const c = document.getElementById('c') as HTMLCanvasElement
    await tf.browser.toPixels(y, c)
  }

  public display(logits: tf.Tensor, canvas: HTMLCanvasElement) {
    const outputImg = logits.squeeze().reshape([28, 28]) as tf.Tensor2D
    tf.browser.toPixels(outputImg, canvas)
  }

  public getLayerOutputs(layers: tf.layers.Layer[], X: tf.Tensor) {
    const activations: { [key: string]: tf.Tensor } = {}
    let input = X
    layers.forEach((layer) => {
      const act = layer.call(input, null) as tf.Tensor
      input = activations[layer.name] = act
    })
    return activations
  }

  public runLayers(layers: tf.layers.Layer[], activation: tf.Tensor) {
    let act = activation
    layers.forEach((layer) => {
      act = layer.call(act, null) as tf.Tensor
    })
    return act
  }
}
