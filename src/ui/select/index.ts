import { renderTemplate } from '@/libs/template';
import templateItem from './template-item.html?raw';
import template from './template.html?raw';

/**
 * Enhances a standard HTMLSelectElement (single or multiple) with a custom, interactive UI
 * inspired by modern design patterns (tags for multiple, clean dropdown for single).
 *
 * @example
 * ```typescript
 * const select = document.querySelector('select');
 * Select.init(select);
 * ```
 */
export class Select {
  private static readonly DATA_KEY = 'dsSelectInstance';
  private readonly ui: Record<string, HTMLElement | null> = {};
  private readonly state = {
    isOpen: false,
    isBusy: false,
    isMultiple: false,
  };

  constructor(private readonly select: HTMLSelectElement) {
    this.state.isMultiple = select.multiple;

    this.buildUI().then(() => {
      this.bindEvents();
      this.refresh();
    });

    // Mark as initialized
    (this.select as any)[Select.DATA_KEY] = this;
  }

  /**
   * Constructs the custom UI based on the template.
   */
  private async buildUI(): Promise<void> {
    const placeholder = this.select.dataset.placeholder || (this.state.isMultiple ? 'Select options...' : 'Select an option...');
    const containerClass = `${this.state.isMultiple ? 'is-multiple' : 'is-single'}`;
    const data = {
      containerClass,
      placeholder,
      count: '',
      isMultiple: this.state.isMultiple,
    };
    const wrapper = document.createElement('div');

    renderTemplate(template, data, wrapper);

    const container = wrapper.firstElementChild as HTMLElement;

    if (!container) {
      return;
    }

    this.ui.container = container;
    this.ui.active = container.querySelector('.discogs-submitter__select__label');
    this.ui.list = container.querySelector('.discogs-submitter__select__list');
    this.ui.placeholder = container.querySelector('.discogs-submitter__select__placeholder');
    this.ui.count = container.querySelector('.discogs-submitter__select__count');

    // Hide original select and insert container
    this.select.setAttribute('hidden', 'true');
    this.select.parentElement?.insertBefore(container, this.select);

    container.appendChild(this.select);
  }

  /**
   * Refreshes the custom UI to match the current state of the underlying select element.
   */
  public async refresh(): Promise<void> {
    if (!this.ui.active || !this.ui.list) {
      return;
    }

    this.ui.list.innerHTML = '';

    const options = Array.from(this.select.options);
    const selectedOptions = options.filter(option => option.selected);

    for (const option of options) {
      await this.addListItem(option.value, option.text, option.selected);
    }

    this.updateLabel(selectedOptions);
  }

  private updateLabel(selectedOptions: HTMLOptionElement[]): void {
    if (!this.ui.placeholder) {
      return;
    }

    const count = selectedOptions.length;

    if (count === 0) {
      if (this.ui.count) {
        this.ui.count.textContent = '';
      }

      this.ui.placeholder.textContent = this.select.dataset.placeholder || (this.state.isMultiple ? 'Select options...' : 'Select an option...');

      this.ui.placeholder.classList.remove('is-selected');
    }
    else if (count === 1) {
      if (this.ui.count) {
        this.ui.count.textContent = '';
      }

      this.ui.placeholder.textContent = selectedOptions[0].text;

      this.ui.placeholder.classList.add('is-selected');
    }
    else {
      if (this.ui.count) {
        this.ui.count.textContent = `+${count - 1}`;
      }

      this.ui.placeholder.textContent = selectedOptions[0].text;

      this.ui.placeholder.classList.add('is-selected');
    }
  }

  private bindEvents(): void {
    if (!this.ui.container || !this.ui.active || !this.ui.list) {
      return;
    }

    this.ui.list.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest('.discogs-submitter__select__list__item') as HTMLElement;

      if (!item || this.state.isBusy) {
        return;
      }

      this.selectOption(item);
    });

    this.ui.active.addEventListener('click', (event) => {
      const arrow = (event.target as HTMLElement).closest('.discogs-submitter__select__arrow');
      const placeholder = (event.target as HTMLElement).closest('.discogs-submitter__select__placeholder');

      if (arrow || placeholder || event.target === this.ui.active) {
        this.toggleDropdown();
      }
    });

    // Keyboard activation on the combobox trigger (Enter/Space) — pairs with click for parity
    this.ui.active.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggleDropdown();
      }
      else if (event.key === 'Escape' && this.state.isOpen) {
        event.preventDefault();
        this.closeDropdown();
      }
    });

    // Close on click outside
    document.addEventListener('click', (event) => {
      if (this.ui.container && !this.ui.container.contains(event.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  private toggleDropdown(): void {
    this.state.isOpen = !this.state.isOpen;

    this.ui.container?.classList.toggle('is-open', this.state.isOpen);
    this.ui.active?.setAttribute('aria-expanded', String(this.state.isOpen));
  }

  private closeDropdown(): void {
    this.state.isOpen = false;

    this.ui.container?.classList.remove('is-open');
    this.ui.active?.setAttribute('aria-expanded', 'false');
  }

  private selectOption(item: HTMLElement): void {
    const value = item.dataset.value ?? '';
    const option = Array.from(this.select.options).find(option => option.value === value);

    if (!option) {
      return;
    }

    if (this.state.isMultiple) {
      option.selected = !option.selected;

      this.refresh();
      this.triggerChange();
    }
    else {
      // Unselect others for single mode
      Array.from(this.select.options).forEach((otherOption) => {
        otherOption.selected = false;
      });

      option.selected = true;

      this.closeDropdown();
      this.refresh();
      this.triggerChange();
    }
  }

  private async addListItem(value: string, text: string, isSelected: boolean): Promise<void> {
    if (!this.ui.list) {
      return;
    }

    const itemClass = `${isSelected ? 'is-selected' : ''}`;
    const data = {
      value,
      text,
      isSelected,
      isMultiple: this.state.isMultiple,
      itemClass,
    };

    renderTemplate(templateItem, data, this.ui.list);
  }

  private triggerChange(): void {
    const event = new Event('change', { bubbles: true });

    this.select.dispatchEvent(event);
  }

  /**
   * Helper to initialize the component on a select element.
   *
   * @param select - The native select element to enhance, or `null` to no-op.
   * @param force - When `true`, refreshes an already-initialized instance instead of skipping it.
   */
  public static init(select: HTMLSelectElement | null, force: boolean = false): void {
    if (!select) {
      return;
    }

    const instance = (select as any)[Select.DATA_KEY] as Select;

    if (instance) {
      if (force) {
        void instance.refresh();
      }

      return;
    }

    void new Select(select);
  }
}
