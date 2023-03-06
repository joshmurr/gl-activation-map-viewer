import { EaseFn, default as easing } from './easingFuncs'
import { Tuple } from './types'

/* FIXME: The mad typing going on in here */

export interface IAnim {
  name: string
  counter: number
  frames: Array<Tuple>
  step: () => Tuple
  reverse: () => Tuple
}

export default class Animator {
  _animations: IAnim[] = []

  animation(
    name: string,
    from: any,
    to: any,
    frameCount: number,
    ease: EaseFn,
  ) {
    let frames = [] as Tuple[]

    if (Array.isArray(from)) {
      frames = this.arrayLerp(from, to, frameCount, ease)
    } else {
      for (let i = 0; i < frameCount; i++) {
        frames.push(this.interpolator(from, to, i / frameCount, ease))
      }
    }

    let counter = 0
    const anim: IAnim = {
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

  public interpolator(from: number, to: number, t: number, easeFn: EaseFn) {
    return from * (1 - easing[easeFn](t)) + to * easing[easeFn](t)
  }

  private arrayLerp(
    from: number[],
    to: number[],
    frameCount: number,
    ease: EaseFn,
  ): Array<number[]> {
    if (from.length !== to.length) return

    const frames: Array<Tuple> = []

    for (let i = 0; i < frameCount; i++) {
      const frame = []
      for (let j = 0; j < from.length; j++) {
        const val = this.interpolator(from[j], to[j], i / frameCount, ease)
        frame.push(val)
      }
      frames.push(frame as Tuple)
    }

    return frames
  }

  get animations() {
    return this._animations
  }
}
