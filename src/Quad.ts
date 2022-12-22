import { Quad as GLQuad } from 'gl_handler'

export default class Quad {
  private _data: Float32Array
  private _mesh: GLQuad
  private _uniforms: { [key: string]: any }
  private _animations: { [key: string]: any }
  private _uid: number[]
  private _updateSelf: (a: unknown) => any
  /* private _shape: [number, number] */
  /* private _initialTranslation: [number, number, number] */
  /* private _popUp: [number, number, number] */

  constructor(
    mesh: GLQuad,
    data: Float32Array,
    uid: number[],
    texture: WebGLTexture,
    animations: { [key: string]: any },
  ) {
    this._mesh = mesh
    this._data = data
    /* this._initialTranslation = [layerIdx * 3 - 25, 0, 5 - quadIdx / 2] */

    this._uid = uid
    /* this._shape = shape */

    this._uniforms = {
      u_colourMult: [1, 1, 1],
      u_texture: texture,
    }

    /* this._popUp = [layerIdx * 3 - 25, 0.8, 5 - quadIdx / 2] */

    this._animations = animations
  }

  public update(data: Float32Array) {
    this._data = data
    this._uniforms.u_texture = this._updateSelf(data)
  }

  public get uniforms() {
    return this._uniforms
  }
  public get data() {
    return this._data
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

  public set updateFunc(func: (a: unknown) => any) {
    this._updateSelf = func
  }
}
