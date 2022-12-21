/* import * as tf from '@tensorflow/tfjs' */
import { Quad } from 'gl-handler'

export interface ModelInfo {
  description: string
  url: string
  size: number
  latent_dim: number
  draw_multiplier: number
  animate_frame: number
}

/* export interface Quad {
  quad: Quad
  uid: number[]
  uniforms: { [key: string]: any }
} */

export interface Button {
  selector: string
  eventListener: string
  callback: () => void
}

export interface Slider {
  name: string
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

export interface ActivationStore {
  [key: string]: { [key: string]: any }
}

export interface QuadInfo {
  mesh: Quad
  uid: number[]
  uniforms: { [key: string]: any }
  animations: { [key: string]: any }
}

export interface ActivationInfo {
  data: Float32Array
  quad: QuadInfo
}

export interface LayerInfo {
  name: string
  shape: number[]
  activations: ActivationInfo[]
}
export type Activations = ActivationInfo[]

export interface ActivationSelection {
  id: number
  relativeId: number
  layerName: string
  layer: any
}
