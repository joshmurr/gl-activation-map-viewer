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
) => {
  const pixelLoc = (x + width * y) * nChannels
  return pixelLoc
}

export const pixel = (
  array: TypedArray,
  x: number,
  y: number,
  width: number,
  nChannels: number,
) => {
  /**
   * Grabs input values from contiguous array based
   * on XY coords.
   */
  const idx = xy2contig(x, y, width, nChannels)
  return array.slice(idx, idx + nChannels)
}

export const sliceRow = (
  array: TypedArray,
  x: number,
  y: number,
  sliceLen: number,
  imageWidth: number,
  nChannels: number,
) => {
  const idx = xy2contig(x, y, imageWidth, nChannels)
  return array.slice(idx, idx + nChannels * sliceLen)
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

export const scale = (
  input: Float32Array,
  width: number,
  height: number,
  scaleFactor: number,
) => {
  /**
   * This algorithm was written by Chat-GPT.
   * I spent quite a bit of time faffing with this, mainly trying to get it
   * to scale from the centre of the image. And I couldn't really figure
   * out the CLAMP_TO_EDGE style downscaling. It still took a fair bit of
   * back and forth with Chat-GPT, but it got much closer on first attempt
   * than I did...
   */
  const scaledPixels = new Float32Array(input.length)

  const xCenter = Math.floor(width / 2)
  const yCenter = Math.floor(height / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const xScaled = xCenter + (x - xCenter) * scaleFactor
      const yScaled = yCenter + (y - yCenter) * scaleFactor
      const xIndex = Math.min(Math.max(Math.floor(xScaled), 0), width - 1)
      const yIndex = Math.min(Math.max(Math.floor(yScaled), 0), height - 1)
      scaledPixels[index] = input[yIndex * width + xIndex]
    }
  }

  return scaledPixels
}

export const fill = (
  input: Float32Array,
  width: number,
  height: number,
  color: number,
): Float32Array => {
  console.log(color)
  return input.fill(color)
}

export const rect = (
  input: Float32Array,
  width: number,
  height: number,
  coords: RectCoords,
  fillFn: FillFn,
): Float32Array => {
  const [x1, y1, x2, y2] = coords

  const xLim = Math.min(x2, width)
  const yLim = Math.min(y2, width)

  const sliceLen = xLim - x1

  for (let y = y1; y < yLim; y += 1) {
    const data = sliceRow(input, x1, y, sliceLen, width, 1)
    const newData = new Float32Array(data.map(fillFn))
    const idx = xy2contig(x1, y, width, 1)
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
