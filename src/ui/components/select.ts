import { renderTemplate } from '@/core';
import selectItemTemplateRaw from '@/ui/templates/select-item.html?raw';
import selectTemplateRaw from '@/ui/templates/select.html?raw';

/**
 * Enhances a standard HTMLSelectElement (single or multiple) with a custom, interactive UI
 * inspired by modern design patterns (tags for multiple, clean dropdown for single).
 *
 * @example
 * ```typescript
 * const select = document.querySelector('select');
 * UiSelect.init(select);
 * ```
 */
export class UiSelect {
  private static readonly DATA_KEY = 'dsSelectInstance';
  private readonly ui: Record<string, HTMLElement | null> = {};
  private readonly state = {
    isOpen: false,
    isBusy: false,
    isMultiple: false,
  };

  constructor(private readonly select: HTMLSelectElement) {
    this.state.isMultiple = select.multiple;

    void this.buildUI().then(() => {
      this.bindEvents();
      void this.refresh();
    });

    // Mark as initialized
    (this.select as any)[UiSelect.DATA_KEY] = this;
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

    renderTemplate(selectTemplateRaw, data, wrapper);

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
  }

  private closeDropdown(): void {
    this.state.isOpen = false;

    this.ui.container?.classList.remove('is-open');
  }

  private selectOption(item: HTMLElement): void {
    const value = item.dataset.value ?? '';
    const option = Array.from(this.select.options).find(opt => opt.value === value);

    if (!option) {
      return;
    }

    if (this.state.isMultiple) {
      option.selected = !option.selected;

      void this.refresh();
      this.triggerChange();
    }
    else {
      // Unselect others for single mode
      Array.from(this.select.options).forEach((otherOption) => {
        otherOption.selected = false;
      });

      option.selected = true;

      this.closeDropdown();
      void this.refresh();
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

    renderTemplate(selectItemTemplateRaw, data, this.ui.list);
  }

  private triggerChange(): void {
    const event = new Event('change', { bubbles: true });

    this.select.dispatchEvent(event);
  }

  /**
   * Helper to initialize the component on a select element.
   */
  public static init(select: HTMLSelectElement | null, force: boolean = false): void {
    if (!select) {
      return;
    }

    const instance = (select as any)[UiSelect.DATA_KEY] as UiSelect;

    if (instance) {
      if (force) {
        void instance.refresh();
      }

      return;
    }

    void new UiSelect(select);
  }
}
