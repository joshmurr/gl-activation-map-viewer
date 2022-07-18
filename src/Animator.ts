import { lerp } from './utils'

type anim = {
  name: string
  counter: number
  frames: any[]
  step: () => void
  reverse: () => void
}

export default class Animator {
  _animations: anim[] = []

  animation(name: string, from: any, to: any, frameCount: number) {
    let frames: any = []

    if (Array.isArray(from)) {
      frames = this.arrayLerp(from, to, frameCount)
    } else {
      for (let i = 0; i < frameCount; i++) {
        frames.push(lerp(from, to, i / frameCount))
      }
    }

    let counter = 0
    const anim: anim = {
      name,
      counter,
      frames,
      step: () => {
        counter = Math.min(++counter, frames.length - 1)
        return frames[counter]
      },
      reverse: () => {
        counter = Math.max(--counter, 0)
        return frames[counter]
      },
    }

    return anim
  }

  private arrayLerp(
    from: number[],
    to: number[],
    frameCount: number
  ): Array<number[]> {
    if (from.length !== to.length) return

    const frames: Array<number[]> = []

    for (let i = 0; i < frameCount; i++) {
      const frame: number[] = []
      for (let j = 0; j < from.length; j++) {
        const val = lerp(from[j], to[j], i / frameCount)
        frame.push(val)
      }
      frames.push(frame)
    }

    return frames
  }

  get animations() {
    return this._animations
  }
}
