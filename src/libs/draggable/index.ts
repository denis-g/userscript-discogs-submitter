/**
 * Utility for making elements draggable within the viewport.
 * Supports mouse and touch events with boundary constraints.
 */
export class Draggable {
  private isDragging = false;
  private offset = { x: 0, y: 0 };
  private readonly element: HTMLElement;
  private readonly handle: HTMLElement;
  private readonly onStateChange?: (_isDragging: boolean) => void;

  /**
   * @param element - The root element to move.
   * @param handle - The element that triggers the drag operation.
   * @param onStateChange - Optional callback to track dragging state.
   */
  constructor(element: HTMLElement, handle: HTMLElement, onStateChange?: (_isDragging: boolean) => void) {
    this.element = element;
    this.handle = handle;

    this.onStateChange = onStateChange;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Initializes event listeners for the handle.
   */
  public init(): void {
    this.handle.addEventListener('mousedown', this.handleMouseDown);
    this.handle.addEventListener('touchstart', this.handleMouseDown, { passive: false });
  }

  /**
   * Extracts coordinates from mouse or touch event.
   */
  private getCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return {
        x: (event as TouchEvent).touches[0].pageX,
        y: (event as TouchEvent).touches[0].pageY,
      };
    }

    return {
      x: (event as MouseEvent).pageX,
      y: (event as MouseEvent).pageY,
    };
  }

  /**
   * Handles the start of a drag operation.
   */
  private handleMouseDown(event: MouseEvent | TouchEvent): void {
    // Ignore right-click
    if ('button' in event && event.button !== 0) {
      return;
    }

    event.preventDefault();

    this.isDragging = true;

    this.onStateChange?.(true);

    const coordinates = this.getCoordinates(event);
    const rectangle = this.element.getBoundingClientRect();

    this.offset.x = coordinates.x - rectangle.left;
    this.offset.y = coordinates.y - rectangle.top;

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('touchmove', this.handleMouseMove, { passive: false });
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('touchend', this.handleMouseUp);
  }

  /**
   * Handles element movement during drag.
   */
  private handleMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) {
      return;
    }

    const coordinates = this.getCoordinates(event);
    const rootRectangle = this.element.getBoundingClientRect();
    const left = Math.min(Math.max(0, coordinates.x - this.offset.x), window.innerWidth - rootRectangle.width);
    const top = Math.min(Math.max(0, coordinates.y - this.offset.y), window.innerHeight - rootRectangle.height);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  /**
   * Handles the end of a drag operation.
   */
  private handleMouseUp(): void {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;

    this.onStateChange?.(false);

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('touchmove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchend', this.handleMouseUp);
  }
}
