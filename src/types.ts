import * as tf from '@tensorflow/tfjs'

export interface ModelInfo {
  description: string
  url: string
  size: number
  latent_dim: number
  draw_multiplier: number
  animate_frame: number
}

export interface Quad {
  quad: Quad
  uid: number[]
  uniforms: { [key: string]: any }
}

export interface Button {
  selector: string
  eventListener: string
  callback: () => void
}

export interface Checkbox {
  name: string
  selector: string
}

export interface DropdownOpts {
  name: string
  callback: () => void
}

export interface PixelData {
  p: ImageData
  x: number
  y: number
}

export type DrawCallback = (k: string, data: PixelData) => void

export interface ActivationSelection {
  id: number
  relativeId: number
  data: Float32Array
  quad: Quad | null
  layerInfo: {
    name: string
    layer: any
  }
}
