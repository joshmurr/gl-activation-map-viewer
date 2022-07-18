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

  animation(name: string, from: number, to: number, frameCount: number) {
    const frames: number[] = []
    for (let i = 0; i < frameCount; i++) {
      frames.push(lerp(from, to, i / frameCount))
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

  get animations() {
    return this._animations
  }
}
