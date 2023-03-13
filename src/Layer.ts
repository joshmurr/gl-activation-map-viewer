import { GL_Handler, Quad as GLQuad } from 'gl-handler'
import { HSVtoRGB } from './utils'
import Animator from './Animator'
import { QuadDesc } from './types'

export default class Layer {
  private _quads: QuadDesc[]
  constructor(
    G: GL_Handler,
    program: WebGLProgram,
    layerData: {
      activations: { [key: string]: Float32Array }
      shape: number[]
    },
    layerIdx: number,
    offset: number,
    total: number,
  ) {
    this._quads = []
    const quadIds = Object.keys(layerData.activations)
    const numQuads = quadIds.length
    const [w, h] = layerData.shape.slice(2)
    const animHandler = new Animator()
    for (let i = 0; i < numQuads; i++) {
      const quad = new GLQuad(G.gl)
      quad.linkProgram(program)

      const initialTranslation: [number, number, number] = [
        layerIdx * 3 - 25,
        0,
        5 - i / 2,
      ]

      quad.translate = initialTranslation
      quad.rotate = { speed: 0, angle: -Math.PI / 2, axis: [0, 0, 1] }
      const uid = this.generateColourUid(i + offset, 3)

      const data = layerData.activations[quadIds[i]]

      const texture = G.createTexture(w, h, {
        type: 'R32F',
        data: data,
      })

      const uniforms = {
        u_colour: HSVtoRGB((i + offset) / total, 1, 1),
        u_colourMult: [1, 1, 1],
        u_texture: texture,
      }

      const popUp: [number, number, number] = [
        layerIdx * 3 - 25,
        0.8,
        5 - i / 2,
      ]

      const animations = {
        translate: animHandler.animation(
          'translate',
          initialTranslation,
          popUp,
          3,
          'linear',
        ),
      }

      this._quads.push({ quad, uid, uniforms, animations })
    }
  }

  /* public updateActivations(layerData: {
    activations: { [key: string]: Float32Array }
    shape: number[]
  }) {
    const quadIds = Object.keys(layerData.activations)
    const numQuads = quadIds.length
    for (let i = 0; i < numQuads; i++) {

      const data = layerData.activations[quadIds[i]]

    }
  } */

  private generateColourUid(i: number, components = 4): Array<number> {
    const uid: Array<number> = []
    const id = i + 1
    for (let j = 0; j < components; j++) {
      uid.push(((id >> (j * 8)) & 0xff) / 0xff)
    }
    return uid
  }

  public get quads() {
    return this._quads
  }
}
