export type NumericArray = number[] | TypedArray

export type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array

export type BigTypedArray = BigInt64Array | BigUint64Array

export type FloatArray = Float32Array | Float64Array

export type IntArray = Int8Array | Int16Array | Int32Array

export type UIntArray =
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array

export type FloatArrayConstructor =
  | Float32ArrayConstructor
  | Float64ArrayConstructor

export type IntArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor

export type UIntArrayConstructor =
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor

export type BigIntArrayConstructor =
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor

export type TypedArrayConstructor =
  | FloatArrayConstructor
  | IntArrayConstructor
  | UIntArrayConstructor
