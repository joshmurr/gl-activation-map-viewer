import { UniformDescs } from 'gl-handler/lib/types'
import type { Quad as GLQuad } from 'gl-handler'
import type Quad from './Quad'

export interface ModelInfo {
  name: string
  description: string
  url: string
  size: number
  latent_dim: number
  draw_multiplier: number
  data_format: string
}

export type MouseCallback = (e?: MouseEvent) => void
export type NamedCallback = [name: string, cb: MouseCallback]

export interface Button {
  selector: string
  eventListener: string
  callback: () => void
}

export interface EditorButton {
  text: string
  parent: HTMLElement
  id: string | null
  classList?: string[]
  callbacks?: NamedCallback[]
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

export interface QuadDesc {
  quad: GLQuad
  uid: number[]
  uniforms: UniformDescs
  animations: unknown
}

export type RectCoords = [number, number, number, number]

export type FillFn = (c: number, i?: number) => number

export type Tuple = [number, number, number]
