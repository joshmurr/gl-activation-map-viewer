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
