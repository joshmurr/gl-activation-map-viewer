import type Quad from './Quad'

export interface ModelInfo {
  description: string
  url: string
  size: number
  latent_dim: number
  draw_multiplier: number
  data_format: string
}

export interface Button {
  selector: string
  eventListener: string
  callback: () => void
}

export interface Dropdown {
  selector: string
  callback: () => void
}

export interface Slider {
  name: string
  eventListener: string
  callback: () => void
}

export interface Accordion {
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

export interface LayerInfo {
  name: string
  shape: number[]
  activations: Quad[]
}

export interface ActivationSelection {
  id: number
  relativeId: number
  layerName: string
  layer: LayerInfo
}

export type RectCoords = [number, number, number, number]

export type FillFn = (c: number, i?: number) => number
