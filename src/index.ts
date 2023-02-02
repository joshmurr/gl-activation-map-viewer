import * as tf from '@tensorflow/tfjs'
import { GL_Handler, Camera, Types as T } from 'gl-handler'
import { ActivationSelection, Button, ModelInfo } from './types'
import { vec3, mat4 } from 'gl-matrix'
/* import Debug from './Debug' */
import Generator from './Generator'
import ModelVis from './ModelVis'
import GUI from './GUI'
import { Tensor2D } from '@tensorflow/tfjs'
import Editor from './Editor'
import { pickingFrag, pickingVert, renderFrag, renderVert } from './shaders'
import './styles.scss'
import { findLayer, waitForRepaint } from './utils'

const G = new GL_Handler()
const containerEl = document.getElementById('model-vis-container')
const { width } = screen
const canvas = G.canvas(width, Math.floor(width * 0.5), {}, containerEl)
const gl = G.gl
const program = G.shaderProgram(renderVert, renderFrag)
const pickProgram = G.shaderProgram(pickingVert, pickingFrag)

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
let mouseOnSlice = false
let oldPickNdx = -1
const currentActSelection: ActivationSelection = {
  id: -1,
  relativeId: -1,
  layerName: 'none',
  layer: null,
}

/* const debug = new Debug() */
/* debug.addField('ID', () => oldPickNdx.toString()) */

const modelUrl =
  process.env.NODE_ENV === 'development'
    ? './model/model.json'
    : 'https://storage.googleapis.com/store.alantian.net/tfjs_gan/chainer-dcgan-celebahq-64/tfjs_SmoothedGenerator_50000/model.json'

async function init() {
  // MODEL ------------------------------
  const modelInfo: { [key: string]: ModelInfo } = {
    dcgan64: {
      description: 'DCGAN, 64x64 (16 MB)',
      url: modelUrl,
      size: 64,
      latent_dim: 128,
      draw_multiplier: 4,
      animate_frame: 200,
    },
  }

  const gen = new Generator(modelInfo.dcgan64)
  await gen.load()

  const vis = new ModelVis(gen)
  let layers = vis.getActivations(G, program)

  /* GUI */
  const gui = new GUI(document.querySelector('.sidebar'))
  gui.initImageOutput(
    'base',
    document.getElementById('model-base-output') as HTMLCanvasElement,
  )
  gui.initImageOutput(
    'output',
    document.getElementById('model-output') as HTMLCanvasElement,
  )

  const random = () => {
    const randBtn = document.querySelector('.rand-btn') as HTMLButtonElement
    randBtn.innerText = 'Loading...'

    waitForRepaint(() => {
      return tf.tidy(() => {
        const currentZ = tf.randomNormal([
          1,
          modelInfo.dcgan64.latent_dim,
        ]) as Tensor2D
        const logits = gen.run(currentZ) as tf.Tensor
        vis.update(currentZ)
        layers = vis.getActivations(G, program)
        gen.displayOut(logits, gui.output.base)
        randBtn.innerText = 'Random'
      })
    })
  }

  const predict = async () => {
    const predictBtn = document.querySelector(
      '.predict-btn',
    ) as HTMLButtonElement
    predictBtn.innerText = 'Loading...'

    waitForRepaint(() => {
      return tf.tidy(() => {
        const tfLayers = vis.tfLayers
        const layer = currentActSelection.layer
          ? currentActSelection.layer
          : layers[0]

        const { name } = layer

        const idx = tfLayers.indexOf(tfLayers.find((l) => l.name === name)) + 1
        const sliced = tfLayers.slice(idx)

        const { act } = editor.remakeActivation(layer)

        const activations = gen.runLayersGen(sliced, act, idx)
        let logits = null
        let layerIdx = idx
        const layerOffset = Math.abs(tfLayers.length - layers.length)
        for ({ logits, layerIdx } of activations) {
          const layer = layers[layerIdx - layerOffset]
          vis.putActivations(layer, logits)
        }

        gen.displayOut(logits, gui.output.output)
        predictBtn.innerText = 'Predict'
      })
    })
  }
  const buttons: Button[] = [
    {
      selector: '.rand-btn',
      eventListener: 'mouseup',
      callback: random,
    },
    {
      selector: '.predict-btn',
      eventListener: 'mouseup',
      callback: predict,
    },
  ]
  gui.initButtons(buttons)
  /* GUI END */

  const editor = new Editor()

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
    layers.forEach(({ activations, shape }) => {
      activations.forEach(({ mesh, uid }) => {
        gl.bindVertexArray(mesh.VAO)
        G.setUniforms(pickUniformSetters, {
          ...baseUniforms,
          u_ViewMatrix: C.viewMat,
          u_ModelMatrix: mesh.updateModelMatrix(time),
          u_id: uid,
        })
        gl.drawElements(gl.TRIANGLES, mesh.numIndices, gl.UNSIGNED_SHORT, 0)
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
      mouseOnSlice = id < vis.maxTensors
      activations.forEach(({ mesh, uniforms, animations }, i) => {
        if (id - 1 === i + offset) {
          /* Mouse on slice with ID */
          uniforms.u_colourMult = [0.3, 0.5, 0]
          mesh.translate = animations.translate.step()
          oldPickNdx = id - 1
          mouseOnSlice = true
        } else {
          uniforms.u_colourMult = [1, 1, 1]
          mesh.translate = animations.translate.reverse()
        }
      })

      offset += shape[1]

      /* debug.update() */
    })
    gl.useProgram(program)
    gl.clearColor(0.9, 0.9, 0.9, 1)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.CULL_FACE)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    layers.forEach(({ activations }) => {
      // RENDER -----------------------
      activations.forEach(({ mesh, uniforms }) => {
        gl.bindVertexArray(mesh.VAO)
        G.setUniforms(renderUniformSetters, {
          ...baseUniforms,
          u_ModelMatrix: mesh.updateModelMatrix(time),
          u_ViewMatrix: C.viewMat,
          ...uniforms,
        })
        gl.drawElements(gl.TRIANGLES, mesh.numIndices, gl.UNSIGNED_SHORT, 0)
      })
    })

    C.arcball()

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

    requestAnimationFrame(draw)
  }

  canvas.addEventListener('mousemove', function (e) {
    const rect = this.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
  })

  canvas.addEventListener('mousedown', function () {
    if (oldPickNdx > -1) {
      const [layerIdx, relativeId] = findLayer(oldPickNdx, layers)
      const layer = layers[layerIdx]
      const layerName = layer.name

      const selection = {
        id: oldPickNdx,
        relativeId,
        layerName,
        layer,
      }
      Object.assign(currentActSelection, selection)
    }
  })

  canvas.addEventListener('mouseup', function () {
    if (!mouseOnSlice) return false
    editor.show(currentActSelection)
  })

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const { key } = e
    if (key === 'Escape') editor.hideDisplay()
  })

  requestAnimationFrame(draw)
  // ------------------------------------
}

init()
