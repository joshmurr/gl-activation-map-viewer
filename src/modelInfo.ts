import { ModelInfo } from './types'

export const modelInfo: { [key: string]: ModelInfo } = {
  dcgan64: {
    name: 'dcgan64',
    description: 'DCGAN, 64x64 (16 MB)',
    url:
      process.env.NODE_ENV === 'development'
        ? './model/dcgan_64/model.json'
        : 'https://storage.googleapis.com/gl-activation-map-viewer/dcgan_64/model.json',
    size: 64,
    latent_dim: 128,
    draw_multiplier: 4,
    data_format: 'channels_first',
  },
  dcgan128: {
    name: 'dcgan128',
    description: 'DCGAN, 128x128',
    url:
      process.env.NODE_ENV === 'development'
        ? './model/dcgan_128/model.json'
        : 'https://storage.googleapis.com/gl-activation-map-viewer/dcgan_128/model.json',
    size: 128,
    latent_dim: 128,
    draw_multiplier: 4,
    data_format: 'channels_first',
  },
}
