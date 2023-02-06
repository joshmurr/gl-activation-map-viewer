import { GL_Handler, Quad as GLQuad } from 'gl-handler'
import Animator from './Animator'
import Quad from './Quad'

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
    const mesh = new GLQuad(this.G.gl)
    mesh.linkProgram(this.program)

    const uid = this.generateColourUid(quadIdx + offset, 3)

    const [w, h] = this.shape
    const texture = this.G.createTexture(w, h, {
      type: 'R32F',
      data: data,
    })

    const initialTranslation: [number, number, number] = [
      layerIdx * 3 - 25,
      0,
      5 - quadIdx / 2,
    ]
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

    mesh.translate = initialTranslation
    mesh.rotate = { speed: 0, angle: -Math.PI / 2, axis: [0, 0, 1] }

    const quad = new Quad(mesh, data, [w, h], uid, texture, animations)
    quad.updateFunc = (_tex: WebGLTexture, _data: Float32Array) => {
      const gl = this.G.gl
      gl.bindTexture(gl.TEXTURE_2D, _tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, _data)
    }

    return quad
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
