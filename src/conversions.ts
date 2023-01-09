import type { TypedArray, TypedArrayConstructor } from './typedArrays'

export function rgb2grayscale(data: TypedArray): TypedArray {
  const grayscale = data.reduce((acc, p, i) => {
    if (i % 4 === 0) {
      acc.push(p / 255)
    }
    return acc
  }, [])
  return grayscale
}

export function rgba2r<T extends TypedArray>(
  acc: T,
  item: number,
  i: number,
): T {
  if (i % 4 === 0) {
    acc[i] = item / 255
  }
  return acc
}

type Converter = <T extends TypedArray>(acc: T, item: number, i: number) => T

export function convert(
  data: TypedArray,
  converter: Converter,
  constructor: TypedArrayConstructor,
): TypedArray {
  return new constructor(data.reduce(converter, []))
}

export function act2ImageData(
  data: Float32Array | Int32Array | Uint8Array,
  width: number,
  height: number,
) {
  const imageData = new ImageData(width, height)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const ix = (y * width + x) * 4
      const iv = y * width + x
      imageData.data[ix + 0] = Math.floor(255 * data[iv])
      imageData.data[ix + 1] = Math.floor(255 * data[iv])
      imageData.data[ix + 2] = Math.floor(255 * data[iv])
      imageData.data[ix + 3] = 255
    }
  }
  return imageData
}

export function combineFloatWithRGBData(
  a: Float32Array,
  b: Uint8ClampedArray,
  blendMode: string,
) {
  const bOff = blendMode === 'alpha' ? 3 : 0
  const grayscale = a.map((c, i) => {
    const overlayAlpha = b[i * 4 + bOff] / 255
    return blendMode === 'alpha'
      ? overlayAlpha > 0
        ? overlayAlpha + c
        : c
      : overlayAlpha
  })

  return new Float32Array(grayscale)
}
