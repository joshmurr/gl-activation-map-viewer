import { TypedArray } from './typedArrays'
import { FillFn, RectCoords } from './types'

const cos = Math.cos
const sin = Math.sin

export const xy2contig = (
  /**
   * Converts XY coord to contiguous array index
   */
  x: number,
  y: number,
  width: number,
  nChannels: number,
) => (x + width * y) * nChannels

export const pixel = (
  array: TypedArray,
  x: number,
  y: number,
  width: number,
  nChannels: number,
) => {
  /**
   * Grabs pixels values from contiguous array based
   * on XY coords.
   */
  const idx = xy2contig(x, y, width, nChannels)
  return array.slice(idx, idx + nChannels)
}

export const sliceRow = (
  array: TypedArray,
  x: number,
  y: number,
  width: number,
  nChannels: number,
) => {
  const idx = xy2contig(x, y, width, nChannels)
  return array.slice(idx, idx + nChannels * width)
}

export const rotate = (
  input: Float32Array,
  width: number,
  height: number,
  angle: number,
): Float32Array => {
  const center_x = (width - 1) / 2
  const center_y = (height - 1) / 2

  const nChannels = 1
  const newData = new Float32Array(input.length).fill(0)

  for (let i = 0; i < input.length; i += nChannels) {
    const index = Math.floor(i / nChannels)
    const x = index % width
    const y = (index - x) / width

    const data = pixel(input, x, y, width, nChannels)

    const xp = Math.round(
      (x - center_x) * cos(angle) - (y - center_y) * sin(angle) + center_x,
    )
    const yp = Math.round(
      (x - center_x) * sin(angle) + (y - center_y) * cos(angle) + center_y,
    )

    const newIdx = xy2contig(xp, yp, width, nChannels)
    if (newIdx < newData.length && newIdx >= 0) newData.set(data, newIdx)
  }

  return newData
}

export const fill = (input: Float32Array, color: number): Float32Array => {
  return input.fill(color)
}

export const rect = (
  input: Float32Array,
  imageWidth: number,
  coords: RectCoords,
  fillFn: FillFn,
): Float32Array => {
  const [x1, y1, x2, y2] = coords
  const width = x2 - x1

  for (let y = y1; y < y2; y += 1) {
    const data = sliceRow(input, x1, y, width, 1)
    const newData = new Float32Array(data.map(fillFn))
    const idx = xy2contig(x1, y, imageWidth, 1)
    input.set(newData, idx)
  }

  return input
}

/* export const rotateImageData = (image: ImageData, angle: number) => {
  const { width, height, data } = image

  const rawData = convert(data, rgba2r, Float32Array)
  const rotatedData = rotate(rawData, width, height, angle)

  const newImageData = new ImageData(width, height)
  newImageData.data.set(newData, 0)

  return newImageData
} */
