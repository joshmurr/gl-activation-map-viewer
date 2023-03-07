import * as tf from '@tensorflow/tfjs'
import { GL_Handler, Camera, Types as T } from 'gl-handler'
import { Accordion, ActivationSelection, Button, Dropdown } from './types'
import { vec3, mat4 } from 'gl-matrix'
import Generator from './Generator'
import ModelVis from './ModelVis'
import GUI from './GUI'
import { Tensor, Tensor2D } from '@tensorflow/tfjs'
import Editor from './Editor'
import { pickingFrag, pickingVert, renderFrag, renderVert } from './shaders'
import { findLayer, getLayerDims, swapClasses, waitForRepaint } from './utils'
import './styles/main.scss'
import { modelInfo } from './modelInfo'

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

const gui = new GUI(document.querySelector('.sidebar'))
const base = document.getElementById('model-base-output') as HTMLCanvasElement
const output = document.getElementById('model-output') as HTMLCanvasElement

const editor = new Editor()

const vis = new ModelVis()

let initialAct: Tensor | null = null

async function init(chosenModel: string) {
  const currentActSelection: ActivationSelection = {
    id: -1,
    relativeId: -1,
    layerName: 'none',
    layer: null,
  }

  // MODEL ------------------------------
  document.body.classList.add('hideOverflow')
  const loadingParent = document.querySelector('.loading__text')
  swapClasses(loadingParent.parentElement, 'hide', 'show')
  const loadingText = loadingParent.firstElementChild as HTMLElement
  const pctEl = loadingText.firstElementChild as HTMLElement
  pctEl.innerText = '0%'

  const MODEL_INFO = modelInfo[chosenModel]

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
  vis.init(gen)
  let layers = vis.getActivations(G, program, MODEL_INFO)

  /* GUI */
  const handleInitialOutputClick = () => {
    const [w, h] = getLayerDims(
      layers[layers.length - 1].shape,
      MODEL_INFO.data_format,
    )
    editor.showOutput(w, h)
    if (MODEL_INFO.data_format === 'channels_first')
      gen.displayOutTranspose(initialAct, editor.displayCanvas)
    else gen.displayOut(initialAct, editor.displayCanvas)
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

  const random = () => {
    const randBtn = document.querySelector('.rand-btn') as HTMLButtonElement
    randBtn.innerText = 'Loading...'

    waitForRepaint(() => {
      /**
       * We're not tf.tidy-ing here so we don't dispose the tensor
       * so that we can render it in the gui callbacks above using
       * `initialAct`.
       */
      const currentZ = tf.randomNormal([1, MODEL_INFO.latent_dim]) as Tensor2D
      const logits = gen.run(currentZ) as tf.Tensor
      vis.update(currentZ)
      layers = vis.getActivations(G, program, MODEL_INFO)
      initialAct = logits
      if (MODEL_INFO.data_format === 'channels_first')
        gen.displayOutTranspose(logits, gui.output.base)
      else gen.displayOut(logits, gui.output.base)
      randBtn.innerText = 'Random'
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

        const { act } = editor.remakeActivation(layer, MODEL_INFO)

        const activations = gen.runLayersGen(sliced, act, idx)
        let logits = null

        console.log('LOGITS: ', logits)
        console.log('MODEL_INFO: ', MODEL_INFO)

        let layerIdx = idx
        const layerOffset = Math.abs(tfLayers.length - layers.length)
        for ({ logits, layerIdx } of activations) {
          const layer = layers[layerIdx - layerOffset]
          vis.putActivations(layer, logits, MODEL_INFO)
        }

        if (MODEL_INFO.data_format === 'channels_first') {
          gen.displayOutTranspose(logits, gui.output.output)
        } else {
          gen.displayOut(logits, gui.output.output)
        }
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

  const dropdowns: Dropdown[] = [
    {
      selector: 'model-selection',
      callback: loadModel,
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
  /* GUI END */

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
      Object.assign(currentActSelection, selection)
    }
    if (mouseOnSlice) {
      const idEl = document.querySelector('#sidebar__debug__id') as HTMLElement
      const layerNameEl = document.querySelector(
        '#sidebar__debug__layername',
      ) as HTMLElement
      idEl.innerText = currentActSelection.id.toString()
      layerNameEl.innerText = currentActSelection.layerName
    }
  }

  function handleMouseDown() {
    if (!mouseOnSlice) return false
    editor.show(currentActSelection, MODEL_INFO)
  }

  function handleMouseUp() {
    if (!mouseOnSlice) return false
    editor.show(currentActSelection, MODEL_INFO)
  }

  function handleKeyDown(e: KeyboardEvent) {
    const { key } = e
    if (key === 'Escape') editor.hideDisplay()
  }

  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mousedown', handleMouseDown)
  canvas.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)

  const { act } = editor.remakeActivation(layers[layers.length - 1], MODEL_INFO)
  initialAct = act

  if (MODEL_INFO.data_format === 'channels_first')
    gen.displayOutTranspose(act, gui.output.base)
  else gen.displayOut(act, gui.output.base)

  function loadModel() {
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mousedown', handleMouseDown)
    canvas.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('keydown', handleKeyDown)
    const choice = this.options[this.selectedIndex].innerText
    console.log(`Restarting with model: ${choice}`)
    init(choice)
  }

  requestAnimationFrame(draw)
  // ------------------------------------
}

init('dcgan64')
