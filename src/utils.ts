export function HSVtoRGB(h: number, s: number, v: number): Array<number> {
  /* Expects 0 <= h, s, v <= 1 */
  let r: number
  let g: number
  let b: number
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0:
      r = v
      g = t
      b = p
      break
    case 1:
      r = q
      g = v
      b = p
      break
    case 2:
      r = p
      g = v
      b = t
      break
    case 3:
      r = p
      g = q
      b = v
      break
    case 4:
      r = t
      g = p
      b = v
      break
    case 5:
      r = v
      g = p
      b = q
      break
  }
  return [r, g, b]
}

/* 0 <= t <=1 */
export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

export const clamp = (a: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, a))

export const invlerp = (a: number, b: number, t: number) =>
  clamp((t - a) / (b - a))

export const range = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
) => lerp(x2, y2, invlerp(x1, y1, t))

export const mapRange = (
  a: number,
  in_min: number,
  in_max: number,
  out_min: number,
  out_max: number,
) => {
  const m = (a - in_min) / (in_max - in_min)
  const o = out_max - out_min
  return m * o + out_min
}

export const float32toUint8 = (floatArray: Float32Array): Uint8ClampedArray => {
  const len = floatArray.length
  const uint8Array = new Uint8ClampedArray(len)
  for (let i = 0; i < len; i += 1) {
    const c = mapRange(floatArray[i], 0, 1, 0, 255)
    uint8Array[i] = Math.floor(c)
  }

  return uint8Array
}
