import { Accordion, Button, Checkbox, Dropdown, Slider } from './types'

export default class GUI {
  private container: HTMLElement
  private display: HTMLElement
  private sidebar: HTMLElement
  private outputSurfaces: { [key: string]: HTMLCanvasElement }
  private checkboxes: { [key: string]: HTMLInputElement }
  private _sliders: { [key: string]: HTMLInputElement }

  constructor(sidebarEl: HTMLElement) {
    this.container = document.querySelector('.container')
    this.display = document.createElement('div')
    this.display.classList.add('display')
    this.sidebar = sidebarEl

    if (!this.sidebar) {
      this.sidebar = document.createElement('div')
      this.container.appendChild(this.sidebar)
    }

    this.sidebar.classList.add('sidebar')

    this.container.appendChild(this.display)

    this.outputSurfaces = {}
    this.checkboxes = {}
    this._sliders = {}
  }

  public initButtons(buttons: Button[]) {
    buttons.forEach(({ selector, eventListener, callback }) => {
      const buttonEl = document.querySelector(selector)
      buttonEl.addEventListener(eventListener, callback)
    })
  }

  public initCheckboxes(checkboxes: Checkbox[]) {
    checkboxes.forEach(({ name, selector }) => {
      const checkboxEl = document.querySelector(selector)
      this.checkboxes[name] = checkboxEl as HTMLInputElement
    })
  }

  public initSliders(sliders: Slider[]) {
    sliders.forEach(({ name, eventListener, callback }) => {
      const sliderEl = document.querySelector(`input[name="${name}"]`)
      sliderEl.addEventListener(eventListener, callback)
      this._sliders[name] = sliderEl as HTMLInputElement
    })
  }

  public initAccordions(accordions: Accordion[]) {
    accordions.forEach(({ selector, eventListener, callback }) => {
      const accordionBtn = document.querySelector(selector)
      accordionBtn.addEventListener(eventListener, callback)
    })
  }

  public initDropdown(dropdownOpts: Dropdown[]) {
    dropdownOpts.forEach(({ selector, callback }) => {
      const dropdown = document.getElementById(selector)
      dropdown.onchange = callback
    })
  }

  public populateDropdown(
    id: string,
    things: string[],
    defaultSelection: string,
  ) {
    const dropdown = document.getElementById(id)
    dropdown.innerHTML = ''
    things.forEach((t) => {
      const option = document.createElement('option')
      option.innerText = t
      option.selected = t === defaultSelection ? true : false
      dropdown.appendChild(option)
    })
  }

  public initImageOutput(
    ref: string,
    canvasEl?: HTMLCanvasElement,
    callback?: () => void,
  ) {
    const outputContainer = document.createElement('div')
    outputContainer.classList.add('model-output')

    let canvas = canvasEl
    if (!canvas) {
      canvas = document.createElement('canvas')
      outputContainer.appendChild(canvas)
      this.sidebar.appendChild(outputContainer)
    }

    if (callback) canvas.addEventListener('click', callback)

    this.outputSurfaces[ref] = canvas
  }

  public get output() {
    return this.outputSurfaces
  }

  public get sliders() {
    return this._sliders
  }
}
