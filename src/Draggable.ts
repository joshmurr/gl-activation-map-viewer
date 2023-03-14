function toNumber(val: string) {
  return Number(val.replace('%', ''))
}

export default class Draggable {
  private _container: HTMLElement
  private _pos = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  }

  constructor(target?: HTMLElement) {
    const parent = document.querySelector('.container') as HTMLElement
    this._container = target || document.createElement('div')
    this._container.classList.add('draggable')
    const draggableEl = document.querySelector('.draggable') as HTMLElement

    draggableEl.style.top = '0%'
    draggableEl.style.left = '78%'

    const closeDragElement = () => {
      document.onmouseup = null
      document.onmousemove = null
    }

    function percentageToPixel(x: number, y: number) {
      return {
        x: parent.offsetWidth * (x / 100),
        y: parent.offsetHeight * (y / 100),
      }
    }
    function pixelToPercentage(x: number, y: number) {
      return {
        y: (y / parent.offsetHeight) * 100,
        x: (x / parent.offsetWidth) * 100,
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      this._pos.x2 = e.clientX
      this._pos.y2 = e.clientY

      document.onmouseup = closeDragElement
      document.onmousemove = handleDrag
    }

    const handleDrag = (e: MouseEvent) => {
      e.preventDefault()
      this._pos.x1 = this._pos.x2 - e.clientX
      this._pos.y1 = this._pos.y2 - e.clientY
      this._pos.x2 = e.clientX
      this._pos.y2 = e.clientY

      const pixelPosition = percentageToPixel(
        toNumber(draggableEl.style.left),
        toNumber(draggableEl.style.top),
      )
      const top = pixelPosition.y - this._pos.y1
      const left = pixelPosition.x - this._pos.x1
      const percentagePosition = pixelToPercentage(left, top)
      draggableEl.style.top = percentagePosition.y + '%'
      draggableEl.style.left = percentagePosition.x + '%'
    }

    this._container.addEventListener('mousedown', handleMouseDown)
  }

  public appendChild(el: HTMLElement) {
    this._container.appendChild(el)
  }

  public get container() {
    return this._container
  }
}
