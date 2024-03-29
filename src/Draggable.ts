function toNumber(val: string) {
  return Number(val.replace('%', ''))
}

type StylePos = {
  left?: string
  top?: string
  right?: string
  bottom?: string
}

export default class Draggable {
  private _container: HTMLElement
  private _drag = false
  private _pos = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  }

  /* FIXME: This top/left or right/bottom malarky is stupid */
  constructor(cssPos: StylePos, target?: HTMLElement) {
    const parent = document.querySelector('.container') as HTMLElement
    this._container = target || document.createElement('div')
    this._container.classList.add('draggable')

    const leftTop = cssPos.left !== undefined

    if (leftTop) {
      this._container.style.top = cssPos.top
      this._container.style.left = cssPos.left
    } else {
      this._container.style.bottom = cssPos.bottom
      this._container.style.right = cssPos.right
    }

    const closeDragElement = () => {
      this._container.removeEventListener('mouseup', closeDragElement)
      this._container.removeEventListener('mousemove', handleDrag)
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

    const handleMouseOver = (e: MouseEvent) => {
      if (e.target === this._container) {
        this._drag = true
        document.body.style.cursor = 'move'
      } else {
        this._drag = false
        document.body.style.cursor = 'default'
      }
    }

    const handleMouseOut = () => {
      this._drag = false
      document.body.style.cursor = 'default'
    }

    const handleMouseDown = (e: MouseEvent) => {
      this._pos.x2 = e.clientX
      this._pos.y2 = e.clientY

      this._container.addEventListener('mouseup', closeDragElement)
      this._container.addEventListener('mousemove', handleDrag)
    }

    const handleDrag = (e: MouseEvent) => {
      if (!this._drag) return
      this._pos.x1 = this._pos.x2 - e.clientX
      this._pos.y1 = this._pos.y2 - e.clientY
      this._pos.x2 = e.clientX
      this._pos.y2 = e.clientY

      const pixelPosition = leftTop
        ? percentageToPixel(
            toNumber(this._container.style.left),
            toNumber(this._container.style.top),
          )
        : percentageToPixel(
            toNumber(this._container.style.right),
            toNumber(this._container.style.bottom),
          )

      if (leftTop) {
        const top = pixelPosition.y - this._pos.y1
        const left = pixelPosition.x - this._pos.x1
        const percentagePosition = pixelToPercentage(left, top)
        this._container.style.top = percentagePosition.y + '%'
        this._container.style.left = percentagePosition.x + '%'
      } else {
        const bottom = pixelPosition.y + this._pos.y1
        const right = pixelPosition.x + this._pos.x1
        const percentagePosition = pixelToPercentage(right, bottom)
        this._container.style.bottom = percentagePosition.y + '%'
        this._container.style.right = percentagePosition.x + '%'
      }
    }

    this._container.addEventListener('mousedown', handleMouseDown)
    this._container.addEventListener('mouseover', handleMouseOver)
    this._container.addEventListener('mouseout', handleMouseOut)
  }

  public appendChild(el: HTMLElement) {
    this._container.appendChild(el)
  }

  public get container() {
    return this._container
  }
}
