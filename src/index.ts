import { GL_Handler, Camera, Types as T } from 'gl-handler'
import { Button, ModelInfo } from './types'
import { vec3, mat4 } from 'gl-matrix'
import Debug from './Debug'
import Generator from './Generator'
import ModelVis from './ModelVis'
import GUI from './GUI'

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

//const quads: Array<{
//quad: Quad
//uid: number[]
//uniforms: { [key: string]: any }
//animations: { [key: string]: any }
//}> = []

//for (let i = 0, numQuads = 10; i < numQuads; i++) {
//const quad = new Quad(gl)
//quad.linkProgram(program)

//const initialTranslation: [number, number, number] = [0, 0, 5 - i]

//quad.translate = initialTranslation
////quad.rotate = { speed: 0.0005, axis: [0, 0, 1] }
//const uid = generateColourUid(i, 3)

//const uniforms = {
//u_colour: HSVtoRGB(i / numQuads, 1, 1),
//u_colourMult: [1, 1, 1],
//}

//const popUp: [number, number, number] = [0, 0.8, 5 - i]

//const animations = {
//translate: animHandler.animation(
//'translate',
//initialTranslation,
//popUp,
//24,
//'easeOutQuart'
//),
//}

//quads.push({ quad, uid, uniforms, animations })
//}

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

canvas.addEventListener('mousemove', function (e) {
  const rect = this.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

let mouseX = -1
let mouseY = -1
const mousedown = false
let oldPickNdx = -1
let frame = 0

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
  await vis.getActivations()
  vis.showLayerOnCanvases('activation_9')
  vis.generateQuads(G, program)

  const activationStore = vis.activations
  const layerNames = Object.keys(activationStore).filter(
    (name) => activationStore[name],
    //(name) => name.includes('activation')
  )

  /* GUI */
  const gui = new GUI()
  const predict = () => {
    gen.run()
  }
  const buttons: Button[] = [
    {
      selector: '.predict-btn',
      eventListener: 'mouseup',
      callback: predict,
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

      quads.forEach(({ quad, uniforms }) => {
        gl.bindVertexArray(quad.VAO)
        G.setUniforms(renderUniformSetters, {
          ...baseUniforms,
          u_ModelMatrix: quad.updateModelMatrix(time),
          u_ViewMatrix: C.viewMat,
          ...uniforms,
        })
        gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)
      })
    })

    C.arcball()

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    frame++

    requestAnimationFrame(draw)
  }

  //canvas.addEventListener('mousemove', (e) => {
  //const rect = canvas.getBoundingClientRect()
  //mouseX = e.clientX - rect.left
  //mouseY = e.clientY - rect.top

  //if (mousedown) {
  //arcball.updateRotation(mouseX, mouseY)
  //arcball.applyRotationMatrix(modelMat)
  //}
  //})

  //canvas.addEventListener('mousedown', () => {
  //mousedown = true
  //arcball.startRotation(mouseX, mouseY)
  //})

  //canvas.addEventListener('mouseup', () => {
  //mousedown = false
  //arcball.stopRotation()
  //})

  //canvas.addEventListener('mouseout', () => {
  //mousedown = false
  //arcball.stopRotation()
  //})

  //canvas.addEventListener('wheel', (e) => {
  //e.preventDefault()
  //camPos[2] = camPos[2] - e.deltaY * -0.001
  //viewMat = G.viewMat({ pos: vec3.fromValues(...camPos) })
  //})

  requestAnimationFrame(draw)
  // ------------------------------------
}

init()
