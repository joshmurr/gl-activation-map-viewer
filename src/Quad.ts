import { Quad as GLQuad } from 'gl-handler'
import { IAnim } from './Animator'

export default class Quad {
  private _data: Float32Array
  private _mesh: GLQuad
  private _uniforms: { [key: string]: unknown }
  private _animations: { [key: string]: IAnim }
  private _uid: number[]
  private _updateSelf: (a: unknown, b: unknown) => void
  private _needsUpdate = false
  private _shape: [number, number]

  constructor(
    mesh: GLQuad,
    data: Float32Array,
    shape: [number, number],
    uid: number[],
    texture: WebGLTexture,
    animations: { [key: string]: IAnim },
  ) {
    this._mesh = mesh
    this._data = data

    this._uid = uid

    this._shape = shape

    this._uniforms = {
      u_colourMult: [1, 1, 1],
      u_texture: texture,
    }

    this._animations = animations
  }

  public update(data: Float32Array) {
    this._data.set(data, 0)
    this._updateSelf(this._uniforms.u_texture, this._data)
  }

  public destroy() {
    this._mesh.destroy()
  }

  public get uniforms() {
    return this._uniforms
  }
  public get data() {
    return this._data
  }
  public set data(data: Float32Array) {
    this._data.set(data, 0)
  }
  public get uid() {
    return this._uid
  }
  public get animations() {
    return this._animations
  }
  public get mesh() {
    return this._mesh
  }
  public get shape() {
    return this._shape
  }

  public get texture() {
    return this._uniforms.u_texture
  }
  public set texture(_tex: WebGLTexture) {
    this.uniforms.u_texture = _tex
  }

  public set updateFunc(func: (...args: unknown[]) => void) {
    /* Takes a decorated function to handle the visual update.
     * Nameley updating the texture..
     */
    this._updateSelf = func
  }

  public get needsUpdate() {
    return this._needsUpdate
  }
  public set needsUpdate(val: boolean) {
    this._needsUpdate = val
  }
}
