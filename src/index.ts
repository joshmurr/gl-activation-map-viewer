import * as tf from '@tensorflow/tfjs'
import { GL_Handler, Camera, Types as T } from 'gl-handler'
import { Accordion, ActivationSelection, Button, Dropdown } from './types'
import { vec3, mat4 } from 'gl-matrix'
import Generator from './Generator'
import ModelVis from './ModelVis'
import GUI from './GUI'
import type { Tensor, Tensor2D } from '@tensorflow/tfjs'
import Editor from './Editor'
import { pickingFrag, pickingVert, renderFrag, renderVert } from './shaders'
import {
  findLayer,
  getLayerDims,
  promiseWithTimeoutAndDelay,
  swapClasses,
  waitForRepaint,
} from './utils'
import './styles/main.scss'
import { modelInfo } from './modelInfo'
import { PREDICT_BTN_TEXT, RANDOM_BTN_TEXT } from './constants'

const G = new GL_Handler()
const containerEl = document.getElementById('model-vis-container')
const { width, height } = screen
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

let gen: Generator
let currentZ: tf.Tensor2D

const gui = new GUI(document.querySelector('.sidebar'))
const base = document.getElementById('model-base-output') as HTMLCanvasElement
const output = document.getElementById('model-output') as HTMLCanvasElement

const editor = new Editor()
const vis = new ModelVis()
let initialAct: Tensor | null = null

function getModelNameFromURL() {
  const queryString = window.location.search
  const urlParams = new URLSearchParams(queryString)
  return urlParams.get('model')
}

async function init() {
  const chosenModel = getModelNameFromURL() || 'dcgan64'

  const currentActSelection: ActivationSelection = {
    id: -1,
    relativeId: -1,
    layerName: 'none',
    layer: null,
  }
  const currentActHover = { ...currentActSelection }

  // MODEL ------------------------------
  document.body.classList.add('hideOverflow')
  const loadingParent = document.querySelector('.loading__text')
  swapClasses(loadingParent.parentElement, 'hide', 'show')
  const loadingText = loadingParent.firstElementChild as HTMLElement
  const pctEl = loadingText.firstElementChild as HTMLElement
  pctEl.innerText = '0%'

  const MODEL_INFO = modelInfo[chosenModel]
  currentZ = tf.randomNormal([1, MODEL_INFO.latent_dim]) as Tensor2D

  if (gen) gen.dispose()
  gen = new Generator(MODEL_INFO)
  await gen.load({
    onProgress: (pct: number) => {
      const rounded = Math.round(pct * 100)
      pctEl.innerText = `${rounded}%`
      if (rounded === 100) {
        waitForRepaint(() => {
          swapClasses(loadingParent.parentElement, 'show', 'hide')
          document.body.classList.remove('hideOverflow')
        })
      }
    },
  })
  vis.init(gen, currentZ)
  let layers = vis.getActivations(G, program, MODEL_INFO)

  const handleInitialOutputClick = () => {
    const [w, h] = getLayerDims(
      layers[layers.length - 1].shape,
      MODEL_INFO.data_format,
    )
    editor.showOutput(w, h)
    if (MODEL_INFO.data_format === 'channels_first') {
      gen.displayOutTranspose(initialAct, editor.displayCanvas)
    } else {
      gen.displayOut(initialAct, editor.displayCanvas)
    }
  }

  const handleOutputClick = () => {
    const [w, h] = getLayerDims(
      layers[layers.length - 1].shape,
      MODEL_INFO.data_format,
    )
    editor.showOutput(w, h)
    const { act } = editor.remakeActivation(
      layers[layers.length - 1],
      MODEL_INFO,
    )
    if (MODEL_INFO.data_format === 'channels_first')
      gen.displayOutTranspose(act, editor.displayCanvas)
    else gen.displayOut(act, editor.displayCanvas)
  }

  gui.initImageOutput('base', base, handleInitialOutputClick)
  gui.initImageOutput('output', output, handleOutputClick)

  const random = async () => {
    const randBtn = document.querySelector('.rand-btn') as HTMLButtonElement
    randBtn.innerText = 'Loading...'

    return waitForRepaint(async () => {
      /**
       * We're not tf.tidy-ing here so we don't dispose the tensor
       * so that we can render it in the gui callbacks above using
       * `initialAct`.
       */
      currentZ = tf.randomNormal([1, MODEL_INFO.latent_dim]) as Tensor2D
      const logits = gen.run(currentZ) as tf.Tensor
      vis.update(currentZ)
      layers = vis.getActivations(G, program, MODEL_INFO)
      initialAct = logits

      if (MODEL_INFO.data_format === 'channels_first') {
        await gen.displayOutTranspose(logits, gui.output.base)
      } else {
        await gen.displayOut(logits, gui.output.base)
      }

      randBtn.innerText = RANDOM_BTN_TEXT
      editor.changesMade = false
    })
  }

  const predict = async () => {
    const predictBtn = document.querySelector<HTMLButtonElement>('.predict-btn')
    predictBtn.innerText = 'Loading...'
    predictBtn.classList.remove('look-at-me')

    if (!editor.changesMade) {
      const { promiseOrTimeout, timeoutId } = promiseWithTimeoutAndDelay(
        new Promise((resolve, reject) => {
          const logits = gen.run(currentZ) as tf.Tensor
          if (logits) {
            predictBtn.innerText = PREDICT_BTN_TEXT
            resolve(gen.displayOutTranspose(logits, gui.output.output))
          } else {
            predictBtn.innerText = PREDICT_BTN_TEXT
            reject(new Error('Error displaying image'))
            return
          }
        }),
      )

      try {
        return await promiseOrTimeout
      } catch (error) {
        console.error(error)
      } finally {
        clearTimeout(timeoutId)
      }
    }

    const { promiseOrTimeout, timeoutId } = promiseWithTimeoutAndDelay(
      new Promise((resolve, reject) => {
        const tfLayers = vis.tfLayers
        const layer = currentActSelection.layer
          ? currentActSelection.layer
          : layers[0]
        const { name } = layer

        const idx = tfLayers.indexOf(tfLayers.find((l) => l.name === name)) + 1
        const sliced = tfLayers.slice(idx)

        const { act } = editor.remakeActivation(layer, MODEL_INFO)

        const activations = gen.runLayersGen(sliced, act, idx)

        let layerIdx = idx
        let logits = null
        const layerOffset = Math.abs(tfLayers.length - layers.length)
        for ({ logits, layerIdx } of activations) {
          const layer = layers[layerIdx - layerOffset]
          vis.putActivations(layer, logits, MODEL_INFO)
          predictBtn.innerText = PREDICT_BTN_TEXT
        }

        if (!logits) {
          predictBtn.innerText = PREDICT_BTN_TEXT
          reject(new Error('Error displaying image'))
          return
        }

        if (MODEL_INFO.data_format === 'channels_first') {
          resolve(gen.displayOutTranspose(logits, gui.output.output))
        } else {
          resolve(gen.displayOut(logits, gui.output.output))
        }
      }),
    )
    try {
      return await promiseOrTimeout
    } catch (error) {
      console.log('error', error)
      predictBtn.innerText = PREDICT_BTN_TEXT
    } finally {
      clearTimeout(timeoutId)
    }
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

  const dropdowns: Dropdown[] = [
    {
      selector: 'model-selection',
      /* callback: loadModel, */
      callback: loadModelWithPageLoad,
    },
  ]
  gui.initDropdown(dropdowns)
  gui.populateDropdown('model-selection', Object.keys(modelInfo), chosenModel)

  const accordions: Accordion[] = [...new Array(3)].map((_, i) => ({
    selector: `#section-${i + 1}`,
    eventListener: 'click',
    callback: function () {
      const moreSymbol = this.firstElementChild as HTMLElement
      moreSymbol.innerText = moreSymbol.innerText === '+' ? '-' : '+'
      const panel = this.nextElementSibling as HTMLElement
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px'
      }
    },
  }))

  gui.initAccordions(accordions)

  function draw(time: number) {
    // PICKING ----------------------
    gl.useProgram(pickProgram)
    gl.clearColor(1, 1, 1, 1)
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
      const pixelX = (mouseX * gl.canvas.width) / canvas.clientWidth
      const pixelY =
        gl.canvas.height - (mouseY * gl.canvas.height) / canvas.clientHeight - 1
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

      offset +=
        MODEL_INFO.data_format === 'channels_first' ? shape[1] : shape[3]
    })
    gl.useProgram(program)
    gl.clearColor(0.95, 0.96, 0.98, 1)
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
          u_resolution: [width, height],
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

  function handleMouseMove(e: MouseEvent) {
    const rect = this.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top

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
      Object.assign(currentActHover, selection)
      if (mouseOnSlice) {
        console.log('mouseOnSlice', mouseOnSlice)
        const idEl = document.querySelector(
          '#sidebar__debug__id',
        ) as HTMLElement
        const layerNameEl = document.querySelector(
          '#sidebar__debug__layername',
        ) as HTMLElement
        idEl.innerText = selection.id.toString()
        layerNameEl.innerText = selection.layerName
      }
    }
  }

  function handleMouseUp(e: MouseEvent) {
    e.stopPropagation()
    if (!mouseOnSlice) return false
    Object.assign(currentActSelection, currentActHover)
    editor.show(currentActSelection, MODEL_INFO)
  }

  function handleKeyDown(e: KeyboardEvent) {
    const { key } = e
    if (key === 'Escape') editor.hideDisplay()
  }

  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)

  const { act } = editor.remakeActivation(layers[layers.length - 1], MODEL_INFO)
  initialAct = act

  if (MODEL_INFO.data_format === 'channels_first')
    gen.displayOutTranspose(act, gui.output.base)
  else gen.displayOut(act, gui.output.base)

  /* function loadModel() {
    // This unfortunately was just more hassle than it was worth.
    // All the callbacks in the app mean was just too much of a pain to
    // track down all the dangling refs to various arrays of arrays of objects.

    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mousedown', handleMouseDown)
    canvas.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('keydown', handleKeyDown)

    const choice = this.options[this.selectedIndex].innerText
    vis.destroy()
    initialAct.dispose()
    console.log(`Restarting with model: ${choice}`)
    init()
  } */

  function loadModelWithPageLoad() {
    const choice = this.options[this.selectedIndex].innerText
    window.location.assign(`${window.location.origin}/?model=${choice}`)
  }

  requestAnimationFrame(draw)
  // ------------------------------------
}

init()
