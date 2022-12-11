import * as tf from '@tensorflow/tfjs'
import { GL_Handler, Camera, Types as T } from 'gl-handler'
import { Button, ModelInfo } from './types'
import { vec3, mat4 } from 'gl-matrix'
import Debug from './Debug'
import Generator from './Generator'
import ModelVis from './ModelVis'
import GUI from './GUI'
import { Tensor2D } from '@tensorflow/tfjs'

const pickingVS = `#version 300 es
precision mediump float;

in vec3 i_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

out vec2 v_TexCoord;

void main(){
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(i_Position, 1.0);
}`

const pickingFS = `#version 300 es
precision highp float;

uniform vec3 u_id;

out vec4 outColor;

void main() {
   outColor = vec4(u_id, 0.0);
}
`

const vert = `#version 300 es
precision mediump float;

in vec3 i_Position;
in vec2 i_TexCoord;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

out vec2 v_TexCoord;
out vec4 v_Colour;

void main(){
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(i_Position, 1.0);
  v_TexCoord = i_TexCoord;
}`

const outputFrag = `#version 300 es
precision mediump float;

in vec2 v_TexCoord;
uniform sampler2D u_texture;
uniform vec3 u_colour;
uniform vec3 u_colourMult;

out vec4 OUTCOLOUR;

void main(){
  vec4 data = vec4(texture(u_texture, v_TexCoord).rrr, 1.0);
  OUTCOLOUR = data * vec4(u_colourMult, 1.0);
  //OUTCOLOUR = vec4(u_colour, 1.0) * vec4(u_colourMult, 1.0);
}`

const G = new GL_Handler()
const canvas = G.canvas(1024, 512)
const gl = G.gl
const program = G.shaderProgram(vert, outputFrag)
const pickProgram = G.shaderProgram(pickingVS, pickingFS)

const camPos: [number, number, number] = [5, 16, 26]
const C = new Camera({ pos: vec3.fromValues(...camPos) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

C.initArcball(canvas)

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: C.viewMat,
  u_ProjectionMatrix: projMat,
}
const pickUniformSetters = G.getUniformSetters(pickProgram)
const renderUniformSetters = G.getUniformSetters(program)
// ------------------------------------

// RENDER BUFFER FOR PICKING ----------
const { fb: pickingFbo, targetTexture, depthBuffer } = G.initPicking()
G.setFramebufferAttachmentSizes(
  canvas.width,
  canvas.height,
  targetTexture,
  depthBuffer,
)
// ------------------------------------

let mouseX = -1
let mouseY = -1
let oldPickNdx = -1
const currentActSelection = {
  id: -1,
  relativeId: -1,
  data: new Float32Array(1).fill(0),
  quad: null,
  layerShape: [-1, -1],
}
/* const mousedown = false */
/* let frame = 0 */

const debug = new Debug()
debug.addField('ID', () => oldPickNdx.toString())

async function init() {
  // MODEL ------------------------------
  const modelInfo: { [key: string]: ModelInfo } = {
    dcgan64: {
      description: 'DCGAN, 64x64 (16 MB)',
      /* url: 'https://storage.googleapis.com/store.alantian.net/tfjs_gan/chainer-dcgan-celebahq-64/tfjs_SmoothedGenerator_50000/model.json', */
      url: './model/model.json',
      size: 64,
      latent_dim: 128,
      draw_multiplier: 4,
      animate_frame: 200,
    },
  }

  const gen = new Generator(modelInfo.dcgan64)
  await gen.load()

  const vis = new ModelVis(gen)
  const filterByWord = (word: string) => (n: string) => n.includes(word)
  const name = 'activation'
  const filter = filterByWord(name)
  /* const filter = () => true */
  await vis.getActivations(filter)
  vis.showLayerOnCanvases('activation_9')
  vis.generateQuads(G, program)

  let activationStore = vis.activations
  const layerNames = Object.keys(activationStore).filter(filter)

  /* GUI */
  const gui = new GUI()
  const random = async () => {
    const z = tf.randomNormal([1, modelInfo.dcgan64.latent_dim]) as Tensor2D
    await gen.run(z)
    vis.update(gen, z)
    await vis.getActivations(filter)
    vis.generateQuads(G, program)
    activationStore = vis.activations
  }
  const buttons: Button[] = [
    {
      selector: '.rand-btn',
      eventListener: 'mouseup',
      callback: random,
    },
  ]
  gui.initButtons(buttons)
  /* GUI END */

  function draw(time: number) {
    // PICKING ----------------------

    gl.useProgram(pickProgram)
    gl.clearColor(0.9, 0.9, 0.9, 1)
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFbo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    let offset = 0
    layerNames.forEach((layerName) => {
      const actInfo = activationStore[layerName]

      const quads = actInfo.meshes

      quads.forEach(({ quad, uid }) => {
        gl.bindVertexArray(quad.VAO)
        G.setUniforms(pickUniformSetters, {
          ...baseUniforms,
          u_ViewMatrix: C.viewMat,
          u_ModelMatrix: quad.updateModelMatrix(time),
          u_id: uid,
        })
        gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)
      })

      // Mouse pixel ---------
      const pixelX = (mouseX * gl.canvas.width) / gl.canvas.clientWidth
      const pixelY =
        gl.canvas.height -
        (mouseY * gl.canvas.height) / gl.canvas.clientHeight -
        1
      const data = new Uint8Array(4)
      gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data)
      const id = data[0] + (data[1] << 8) + (data[2] << 16)
      quads.forEach(({ quad, uniforms, animations }, i) => {
        if (id - 1 === i + offset) {
          uniforms.u_colourMult = [0.3, 0.5, 0]
          quad.translate = animations.translate.step()
          oldPickNdx = id - 1
        } else {
          uniforms.u_colourMult = [1, 1, 1]
          quad.translate = animations.translate.reverse()
        }
      })

      offset += Object.keys(actInfo.activations).length

      debug.update()
    })
    gl.useProgram(program)
    gl.clearColor(0.9, 0.9, 0.9, 1)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    layerNames.forEach((layerName) => {
      const actInfo = activationStore[layerName]
      const quads = actInfo.meshes

      // RENDER -----------------------
      quads.forEach(({ quad, uniforms: quadUniforms }, i) => {
        gl.bindVertexArray(quad.VAO)

        const data = actInfo.activations[i]

        G.setUniforms(renderUniformSetters, {
          ...baseUniforms,
          u_ModelMatrix: quad.updateModelMatrix(time),
          u_ViewMatrix: C.viewMat,
          ...quadUniforms,
        })
        gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)
      })
    })

    C.arcball()

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    /* frame++ */

    requestAnimationFrame(draw)
  }

  canvas.addEventListener('mousemove', function (e) {
    const rect = this.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
  })

  canvas.addEventListener('mousedown', function () {
    const findLayer = (id: number) => {
      const bins = Object.values(activationStore).map(({ activations }) => {
        /* Count how many activations in each layer */
        /* return Object.keys(activations).reduce((n: number) => (n += 1), 0) */
        return activations.length
      })
      const findLayerIter = (
        id: number,
        i: number,
        bins: number[],
      ): number[] => {
        if (id > bins.reduce((a, k) => a + k, 0)) return [-1, id]
        if (bins[i] - id > 0) return [i, id]
        return findLayerIter(id - bins[i], (i += 1), bins)
      }

      return findLayerIter(id, 0, bins)
    }
    if (oldPickNdx > -1) {
      const [bin, relativeId] = findLayer(oldPickNdx)
      console.log(`ID: ${oldPickNdx} is in layer ${bin}`)
      const layerName = Object.keys(activationStore)[bin]
      const layer = activationStore[layerName]
      const layerShape = layer.shape.slice(0, 2)
      const data = layer.activations[relativeId]
      const quad = layer.meshes[relativeId]
      const selection = { id: oldPickNdx, relativeId, data, quad, layerShape }
      Object.assign(currentActSelection, selection)
    }
  })

  canvas.addEventListener('mouseup', function () {
    const { quad, data, layerShape } = currentActSelection
    const [w, h] = layerShape
    const newData = data.slice().fill(0)
    quad.uniforms.u_texture = G.createTexture(w, h, {
      type: 'R32F',
      data: newData,
    })
  })

  requestAnimationFrame(draw)
  // ------------------------------------
}

init()
