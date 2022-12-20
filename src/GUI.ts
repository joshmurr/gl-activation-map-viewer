import { Button, Checkbox, DropdownOpts, Slider } from './types'

export default class GUI {
  private container: HTMLElement
  private display: HTMLElement
  private sidebar: HTMLElement
  private outputSurfaces: { [key: string]: HTMLCanvasElement }
  private checkboxes: { [key: string]: HTMLInputElement }
  private _sliders: { [key: string]: HTMLInputElement }

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
    this._sliders = {}
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

  public initSliders(sliders: Array<Slider>) {
    sliders.forEach(({ name, eventListener, callback }) => {
      const sliderEl = document.querySelector(`input[name="${name}"]`)
      sliderEl.addEventListener(eventListener, callback)
      this._sliders[name] = sliderEl as HTMLInputElement
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

  public get sliders() {
    return this._sliders
  }
}
