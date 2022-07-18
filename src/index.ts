import { GL_Handler, Quad, Types as T } from 'gl-handler'
import { vec3, mat4 } from 'gl-matrix'

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
uniform sampler2D u_Texture;
uniform vec3 u_id;

out vec4 OUTCOLOUR;

void main(){
  OUTCOLOUR = vec4(v_TexCoord, 0.0, 1.0);
}`

const G = new GL_Handler()
const canvas = G.canvas(512, 512)
const gl = G.gl
const program = G.shaderProgram(vert, outputFrag)
const pickProgram = G.shaderProgram(pickingVS, pickingFS)

let baseViewMat = G.viewMat({ pos: vec3.fromValues(8, 8, 16) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

function generateColourUid(i: number, components = 4): Array<number> {
  const uid: Array<number> = []
  const id = i + 1
  for (let j = 0; j < components; j++) {
    uid.push(((id >> (j * 8)) & 0xff) / 0xff)
  }
  return uid
}

const quads: Array<{ quad: Quad; uid: number[] }> = []

for (let i = 0, numQuads = 10; i < numQuads; i++) {
  const quad = new Quad(gl)
  quad.linkProgram(program)
  quad.translate = [0, 0, 5 - i]
  //quad.rotate = { speed: 0.0005, axis: [0, 0, 1] }
  const uid = generateColourUid(i, 3)

  quads.push({ quad, uid })
}

// UNIFORMS ---------------------------
const baseUniforms: T.UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: baseViewMat,
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
  depthBuffer
)
// ------------------------------------

canvas.addEventListener('mousemove', function (e) {
  const rect = this.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
})

let mouseX = -1
let mouseY = -1
let oldPickNdx = -1
let oldPickColor
let frame = 0

function draw(time: number) {
  // PICKING ----------------------
  gl.useProgram(pickProgram)
  gl.clearColor(0.9, 0.9, 0.9, 1)
  gl.bindFramebuffer(gl.FRAMEBUFFER, pickingFbo)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  quads.forEach(({ quad, uid }, i) => {
    gl.bindVertexArray(quad.VAO)
    G.setUniforms(pickUniformSetters, {
      ...baseUniforms,
      u_ModelMatrix: quad.updateModelMatrix(time),
      u_id: uid,
    })
    gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)
  })

  // Mouse pixel ---------
  const pixelX = (mouseX * gl.canvas.width) / gl.canvas.clientWidth
  const pixelY =
    gl.canvas.height - (mouseY * gl.canvas.height) / gl.canvas.clientHeight - 1
  const data = new Uint8Array(4)
  gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data)
  const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24)
  if (id > 0) {
    const idx = (id - 1) * 3
    console.log(id)
  }

  // RENDER -----------------------
  gl.useProgram(program)
  gl.clearColor(0.9, 0.9, 0.9, 1)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  quads.forEach(({ quad, uid }) => {
    gl.bindVertexArray(quad.VAO)
    G.setUniforms(renderUniformSetters, {
      ...baseUniforms,
      u_ModelMatrix: quad.updateModelMatrix(time),
      u_id: uid,
    })
    gl.drawElements(gl.TRIANGLES, quad.numIndices, gl.UNSIGNED_SHORT, 0)
  })

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)
