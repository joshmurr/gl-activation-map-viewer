import { GL_Handler, Quad as GLQuad } from 'gl-handler'
import Animator from './Animator'

export default class QuadFactory {
  private animHandler: Animator
  private G: GL_Handler
  private program: WebGLProgram
  private shape: number[]

  constructor(G: GL_Handler, program: WebGLProgram, layerShape: number[]) {
    this.G = G
    this.program = program
    this.animHandler = new Animator()
    this.shape = layerShape
  }

  public generate(
    data: Float32Array,
    quadIdx: number,
    layerIdx: number,
    offset: number,
  ) {
    const quad = new GLQuad(this.G.gl)
    quad.linkProgram(this.program)

    const initialTranslation: [number, number, number] = [
      layerIdx * 3 - 25,
      0,
      5 - quadIdx / 2,
    ]
    quad.translate = initialTranslation
    quad.rotate = { speed: 0, angle: -Math.PI / 2, axis: [0, 0, 1] }
    const uid = this.generateColourUid(quadIdx + offset, 3)

    const texture = this.G.createTexture(this.shape[2], this.shape[3], {
      type: 'R32F',
      data: data,
    })

    const uniforms = {
      u_colourMult: [1, 1, 1],
      u_texture: texture,
    }

    const popUp: [number, number, number] = [
      layerIdx * 3 - 25,
      0.8,
      5 - quadIdx / 2,
    ]

    const animations = {
      translate: this.animHandler.animation(
        'translate',
        initialTranslation,
        popUp,
        3,
        'linear',
      ),
    }
    return { mesh: quad, uid, uniforms, animations }
  }

  private generateColourUid(i: number, components = 4): Array<number> {
    const uid: Array<number> = []
    const id = i + 1
    for (let j = 0; j < components; j++) {
      uid.push(((id >> (j * 8)) & 0xff) / 0xff)
    }
    return uid
  }
}
