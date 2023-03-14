export default class Draggable {
  private _container: HTMLDivElement
  private _pos: {
    x1: number
    y1: number
    x2: number
    y2: number
  }

  constructor() {
    this._pos = {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    }

    this._container = document.createElement('div')
    this._container.classList.add('draggable')

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null
      document.onmousemove = null
    }

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault()
      this._pos.x1 = e.clientX
      this._pos.y1 = e.clientY

      document.onmouseup = closeDragElement
      document.onmousemove = handleDrag
    }

    const handleDrag = (e: MouseEvent) => {
      e.preventDefault()
      this._pos.x1 = this._pos.x2 - e.clientX
      this._pos.y1 = this._pos.y2 - e.clientY
      this._pos.x2 = e.clientX
      this._pos.y2 = e.clientY

      const draggableEl = document.querySelector('.draggable') as HTMLElement

      draggableEl.style.top = draggableEl.offsetTop - this._pos.y1 + 'px'
      draggableEl.style.left = draggableEl.offsetLeft - this._pos.x1 + 'px'
    }

    this._container.addEventListener('mousedown', handleMouseDown)

    document.querySelector('.container').appendChild(this._container)
  }
}
