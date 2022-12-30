const cos = Math.cos
const sin = Math.sin
const PI = Math.PI

export const xy2contig = (x: number, y: number, width: number) =>
  (x + width * y) * 4

export const pixel = (
  array: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
) => {
  const idx = xy2contig(x, y, width)
  return array.slice(idx, idx + 4)
}

export const rotate = (
  input: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const angle = PI / 2
  const center_x = (width - 1) / 2
  const center_y = (height - 1) / 2

  const newData = new Uint8ClampedArray(width * height).fill(0)

  for (let i = 0; i < newData.length; i += 4) {
    const x = i % width
    const y = (i - x) / width

    const xp = Math.round(
      (x - center_x) * cos(angle) - (y - center_y) * sin(angle) + center_x,
    )
    const yp = Math.round(
      (x - center_x) * sin(angle) + (y - center_y) * cos(angle) + center_y,
    )

    const data = pixel(input, x, y, width)

    const newIdx = xy2contig(xp, yp, width)
    if (newIdx < newData.length && newIdx >= 0) newData.set(data, newIdx)
  }

  return newData
}
