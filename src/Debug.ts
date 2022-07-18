export default class Debug {
  fields: Array<{
    name: string
    valSpan: HTMLElement
    updateFn: () => string
  }> = []
  debugWrapper: HTMLElement

  constructor() {
    this.debugWrapper = document.createElement('div')
    this.debugWrapper.className = 'debug-wrapper'

    document.body.appendChild(this.debugWrapper)
  }

  addField(name: string, updateFn: () => string) {
    const field = document.createElement('div')
    const nameSpan = document.createElement('span')
    nameSpan.innerText = `${name}: `

    field.appendChild(nameSpan)

    const valSpan = document.createElement('span')
    field.appendChild(valSpan)

    this.debugWrapper.appendChild(field)

    this.fields.push({ name, valSpan, updateFn })
  }

  update() {
    this.fields.forEach(({ valSpan, updateFn }) => {
      valSpan.innerText = updateFn()
    })
  }
}
