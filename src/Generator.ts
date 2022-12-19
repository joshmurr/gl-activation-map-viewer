import * as tf from '@tensorflow/tfjs'
import Model from './Model'
import { ModelInfo } from './types'

export default class Generator extends Model {
  constructor(info: ModelInfo) {
    super(info)
  }

  public async run(inputZ?: tf.Tensor) {
    return tf.tidy(() => {
      const z = inputZ || tf.randomNormal([1, this.info.latent_dim])
      return this.model.predict(z)
    })
  }

  private image_enlarge(y: tf.Tensor2D, draw_multiplier: number) {
    if (draw_multiplier === 1) {
      return y
    }
    const size = y.shape[0]
    return y
      .expandDims(2)
      .tile([1, 1, draw_multiplier, 1])
      .reshape([size, size * draw_multiplier, 3])
      .expandDims(1)
      .tile([1, draw_multiplier, 1, 1])
      .reshape([size * draw_multiplier, size * draw_multiplier, 3])
  }

  public display(logits: tf.Tensor, canvas: HTMLCanvasElement) {
    const outputImg = logits.squeeze().reshape([28, 28]) as tf.Tensor2D
    tf.browser.toPixels(outputImg, canvas)
  }

  public async displayOut(logits: tf.Tensor, canvas: HTMLCanvasElement) {
    const y = tf.tidy(() => {
      const y = logits
        .squeeze()
        .transpose([1, 2, 0])
        .div(tf.scalar(2))
        .add(tf.scalar(0.5)) as tf.Tensor2D
      return this.image_enlarge(y, this.info.draw_multiplier)
    })
    await tf.browser.toPixels(y, canvas)
  }

  public getLayerOutputs(layers: tf.layers.Layer[], X: tf.Tensor) {
    const activations: { [key: string]: tf.Tensor } = {}
    let input = X
    layers.forEach((layer) => {
      const act = layer.call(input, { training: false }) as tf.Tensor
      input = activations[layer.name] = act
    })
    return activations
  }

  public runLayers(layers: tf.layers.Layer[], activation: tf.Tensor) {
    let act = activation
    layers.forEach((layer) => {
      act = layer.call(act, { training: false }) as tf.Tensor
    })
    return act
  }
}
