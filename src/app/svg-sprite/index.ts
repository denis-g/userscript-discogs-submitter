import iconBug from '@/assets/icons/bug.svg?raw';
import iconChevronDown from '@/assets/icons/chevron-down.svg?raw';
import iconClose from '@/assets/icons/close.svg?raw';
import iconGripLines from '@/assets/icons/grip-lines.svg?raw';
import imageLogo from '@/assets/icons/logo.svg?raw';
import iconRotateLeft from '@/assets/icons/rotate-left.svg?raw';
import iconSquareCheck from '@/assets/icons/square-check.svg?raw';
import { USERSCRIPT } from '@/config';

const SVG_SPRITE_ID = `${USERSCRIPT.ID}-svg-sprite`;
const DEFAULT_VIEWBOX = '0 0 1024 1024';
/**
 * Icon id → raw SVG source. Keys become `<symbol id="...">` ids consumed by
 * widget templates via `<use href="#ds-...">`.
 */
const ICON_REGISTRY: Record<string, string> = {
  'ds-logo': imageLogo,
  'ds-icon-grip-lines': iconGripLines,
  'ds-icon-close': iconClose,
  'ds-icon-bug': iconBug,
  'ds-icon-chevron-down': iconChevronDown,
  'ds-square-check': iconSquareCheck,
  'ds-rotate-left': iconRotateLeft,
};

/**
 * Builds and mounts the shared SVG sprite (`<svg id="${USERSCRIPT.ID}-svg-sprite">`) in `<body>`.
 * Every entry from `ICON_REGISTRY` is parsed and re-emitted as a `<symbol>` so widget templates
 * can reference icons via `<use href="#ds-icon-...">`. Idempotent — repeat calls are no-ops.
 */
export class SvgSprite {
  /**
   * Mounts the sprite if not already present in the document.
   */
  public mount(): void {
    if (document.getElementById(SVG_SPRITE_ID)) {
      return;
    }

    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    sprite.id = SVG_SPRITE_ID;
    sprite.style.display = 'none';
    sprite.innerHTML = this.buildSymbols();

    document.body.appendChild(sprite);
  }

  /**
   * Parses every registered icon and concatenates the matching `<symbol>` markup.
   *
   * @returns The serialized `<symbol>` collection ready to be assigned to `innerHTML`.
   */
  private buildSymbols(): string {
    const parser = new DOMParser();

    return Object.entries(ICON_REGISTRY)
      .map(([iconId, svgString]) => {
        if (!svgString) {
          return '';
        }

        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');

        if (!svgElement) {
          return '';
        }

        const viewBox = svgElement.getAttribute('viewBox') || DEFAULT_VIEWBOX;
        const innerContent = svgElement.innerHTML.trim();

        return `<symbol id="${iconId}" viewBox="${viewBox}">${innerContent}</symbol>`;
      })
      .filter(Boolean)
      .join('');
  }
}
