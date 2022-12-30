/* import * as tf from '@tensorflow/tfjs' */
import { Quad as GLQuad } from 'gl-handler'
import type Quad from './Quad'

export interface ModelInfo {
  description: string
  url: string
  size: number
  latent_dim: number
  draw_multiplier: number
  animate_frame: number
}

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
  mesh: GLQuad
  uid: number[]
  uniforms: { [key: string]: any }
  animations: { [key: string]: any }
  data: Float32Array
}

export interface ActivationInfo {
  data: Float32Array
  quad: QuadInfo
}

export interface LayerInfo {
  name: string
  shape: number[]
  activations: Quad[]
}

export type Activations = ActivationInfo[]

export interface ActivationSelection {
  id: number
  relativeId: number
  layerName: string
  layer: LayerInfo
}
