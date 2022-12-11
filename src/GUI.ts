/* import * as tf from '@tensorflow/tfjs' */

/* import DataLoader from './DataLoader' */
import { Button, Checkbox, DropdownOpts } from './types'

export default class GUI {
  private container: HTMLElement
  private display: HTMLElement
  private sidebar: HTMLElement
  private outputSurfaces: { [key: string]: HTMLCanvasElement }
  private checkboxes: { [key: string]: HTMLInputElement }

  constructor() {
    this.container = document.getElementById('container')
    this.display = document.createElement('div')
    this.display.classList.add('display')
    this.sidebar = document.createElement('div')
    this.sidebar.classList.add('sidebar')

    this.container.appendChild(this.display)
    this.container.appendChild(this.sidebar)

    this.outputSurfaces = {}
    this.checkboxes = {}
  }

  public initButtons(buttons: Array<Button>) {
    buttons.forEach(({ selector, eventListener, callback }) => {
      const buttonEl = document.querySelector(selector)
      buttonEl.addEventListener(eventListener, callback)
    })
  }

  public initCheckboxes(checkboxes: Array<Checkbox>) {
    checkboxes.forEach(({ name, selector }) => {
      const checkboxEl = document.querySelector(selector)
      this.checkboxes[name] = checkboxEl as HTMLInputElement
    })
  }

  public initDropdown(dropdownOpts: DropdownOpts[]) {
    dropdownOpts.forEach(({ name: n, callback }) => {
      const dropdown = document.getElementById(n)
      dropdown.onchange = callback
    })
  }

  public populateDropdown(id: string, things: string[]) {
    const dropdown = document.getElementById(id)
    things.forEach((t) => {
      const option = document.createElement('option')
      option.innerText = t
      dropdown.appendChild(option)
    })
  }

  public initImageOutput(ref: string) {
    const outputContainer = document.createElement('div')
    outputContainer.classList.add('model-output')

    const canvas = document.createElement('canvas')

    this.outputSurfaces[ref] = canvas

    outputContainer.appendChild(canvas)
    this.sidebar.appendChild(outputContainer)
  }

  public get output() {
    return this.outputSurfaces
  }

  /* public async showExamples(data: DataLoader) {
    const examples = data.nextTestBatch(16)
    const numExamples = examples.xs.shape[0]

    const container =
      document.getElementById('samples') || document.createElement('div')
    container.innerHTML = ''
    container.id = 'samples'
    for (let i = 0; i < numExamples; i++) {
      const imageTensor = tf.tidy(() => {
        return examples.xs
          .slice([i, 0], [1, examples.xs.shape[1]])
          .reshape([28, 28, 1])
      })

      const canvas = document.createElement('canvas')
      canvas.width = 28
      canvas.height = 28
      canvas.style.margin = '4px'
      await tf.browser.toPixels(imageTensor as tf.Tensor2D, canvas)
      container.appendChild(canvas)

      imageTensor.dispose()
    }
    this.sidebar.appendChild(container)
  } */
}
