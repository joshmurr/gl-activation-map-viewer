import type { TypedArray } from './typedArrays'

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

/* export function convert(data: TypedArray, converter: Converter): TypedArray {
  const ArrayType = data.constructor
  return data.reduce(converter, new ArrayType(data.length))
} */
