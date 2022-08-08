import { EaseFn, default as easing } from './easingFuncs'

type anim = {
  name: string
  counter: number
  frames: any[]
  step: () => void
  reverse: () => void
}

export default class Animator {
  _animations: anim[] = []

  animation(
    name: string,
    from: any,
    to: any,
    frameCount: number,
    ease: EaseFn
  ) {
    let frames: any = []

    if (Array.isArray(from)) {
      frames = this.arrayLerp(from, to, frameCount, ease)
    } else {
      for (let i = 0; i < frameCount; i++) {
        frames.push(this.interpolator(from, to, i / frameCount, ease))
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

  public interpolator(from: number, to: number, t: number, easeFn: EaseFn) {
    return from * (1 - easing[easeFn](t)) + to * easing[easeFn](t)
  }

  private arrayLerp(
    from: number[],
    to: number[],
    frameCount: number,
    ease: EaseFn
  ): Array<number[]> {
    if (from.length !== to.length) return

    const frames: Array<number[]> = []

    for (let i = 0; i < frameCount; i++) {
      const frame: number[] = []
      for (let j = 0; j < from.length; j++) {
        const val = this.interpolator(from[j], to[j], i / frameCount, ease)
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
