// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTemplate } from '..';

describe('renderTemplate', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders simple variables', () => {
    const template = '<div>Hello <var>name</var>!</div>';
    const data = { name: 'World' };

    renderTemplate(template, data, container);
    expect(container.innerHTML).toBe('<div>Hello World!</div>');
  });

  it('renders nested variables', () => {
    const template = '<div><var>user.name</var></div>';
    const data = { user: { name: 'John' } };

    renderTemplate(template, data, container);
    expect(container.innerHTML).toBe('<div>John</div>');
  });

  it('handles data-if directive', () => {
    const template = `
      <div>
        <span data-if="show">Visible</span>
        <span data-if="!show">Hidden</span>
      </div>
    `;

    renderTemplate(template, { show: true }, container);
    expect(container.textContent?.trim()).toBe('Visible');

    container.innerHTML = '';
    renderTemplate(template, { show: false }, container);
    expect(container.textContent?.trim()).toBe('Hidden');
  });

  it('handles data-loop directive with arrays', () => {
    const template = `
      <ul>
        <li data-loop="items"><var></var></li>
      </ul>
    `;
    const data = { items: ['A', 'B', 'C'] };

    renderTemplate(template, data, container);

    const items = container.querySelectorAll('li');

    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('A');
    expect(items[2].textContent).toBe('C');
  });

  it('provides loop metadata (_index, _first, _last)', () => {
    const template = `
      <div data-loop="items">
        <var>_index</var>:<var>_value</var><var data-if="_first">(first)</var><var data-if="_last">(last)</var>
      </div>
    `;
    const data = { items: ['A', 'B'] };

    renderTemplate(template, data, container);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('0:A(first) 1:B(last)');
  });

  it('handles data-loop directive with objects', () => {
    const template = `
      <dl>
        <var data-loop="meta" data-unwrap>
          <dt><var>_key</var></dt>
          <dd><var>_value</var></dd>
        </var>
      </dl>
    `;
    const data = {
      meta: {
        Label: 'Mute',
        Catalog: 'STUMM1',
      },
    };

    renderTemplate(template, data, container);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('Label Mute Catalog STUMM1');
  });

  it('handles nested loops', () => {
    const template = `
      <div data-loop="tracks">
        <h3><var>title</var></h3>
        <ul>
          <li data-loop="artists"><var>name</var></li>
        </ul>
      </div>
    `;
    const data = {
      tracks: [
        { title: 'Track 1', artists: [{ name: 'Artist A' }] },
        { title: 'Track 2', artists: [{ name: 'Artist B' }, { name: 'Artist C' }] },
      ],
    };

    renderTemplate(template, data, container);
    expect(container.querySelectorAll('h3')).toHaveLength(2);
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('Track 1 Artist A Track 2 Artist BArtist C');
  });

  it('prioritizes explicit _value property in object items during loops', () => {
    const template = '<ul><li data-loop="items" data-text="_value"></li></ul>';
    const data = {
      items: [
        { _value: 'Explicit A', isSelected: true },
        { _value: 'Explicit B', isSelected: false },
      ],
    };

    renderTemplate(template, data, container);

    const items = container.querySelectorAll('li');

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Explicit A');
    expect(items[1].textContent).toBe('Explicit B');
  });

  it('handles data-attr directive', () => {
    const template = '<a data-attr="href:url|title:label|class:className" class="base">Link</a>';
    const data = { url: '#', label: 'Click me', className: 'extra' };

    renderTemplate(template, data, container);

    const link = container.querySelector('a')!;

    expect(link.getAttribute('href')).toBe('#');
    expect(link.getAttribute('title')).toBe('Click me');
    expect(link.classList.contains('base')).toBe(true);
    expect(link.classList.contains('extra')).toBe(true);
  });

  it('handles data-style directive', () => {
    const template = '<div data-style="color:textColor|display:noneIfFalse">Text</div>';
    const data = { textColor: 'red', noneIfFalse: 'block' };

    renderTemplate(template, data, container);

    const div = container.querySelector('div')!;

    expect(div.style.color).toBe('red');
    expect(div.style.display).toBe('block');
  });

  it('handles data-text directive', () => {
    const template = '<span data-text="content">Fallback</span>';
    const data = { content: 'Dynamic Text' };

    renderTemplate(template, data, container);
    expect(container.querySelector('span')?.textContent).toBe('Dynamic Text');
  });

  it('handles data-value directive on inputs', () => {
    const template = '<input data-value="name" /><textarea data-value="notes"></textarea>';
    const data = { name: 'Artist Name', notes: 'Some notes' };

    renderTemplate(template, data, container);
    expect(container.querySelector('input')?.value).toBe('Artist Name');
    expect(container.querySelector('textarea')?.value).toBe('Some notes');
  });

  it('leaves a data-value attribute set via data-attr on non-form elements untouched', () => {
    const template = '<div data-attr="data-value:value">Item</div>';
    const data = { value: 'WAV' };

    renderTemplate(template, data, container);
    expect(container.querySelector('div')?.dataset.value).toBe('WAV');
  });

  it('handles data-unwrap directive', () => {
    const template = '<div class="wrapper"><span data-unwrap>Inner Content</span></div>';

    renderTemplate(template, {}, container);
    expect(container.innerHTML).toBe('<div class="wrapper">Inner Content</div>');
  });

  it('handles data-event directive', () => {
    const template = '<button data-event="click:onClick">Click</button>';
    let clicked = false;
    const events = {
      onClick: () => { clicked = true; },
    };

    renderTemplate(template, {}, container, { events });
    container.querySelector('button')?.click();
    expect(clicked).toBe(true);
    expect(container.querySelector('button')?.hasAttribute('data-event')).toBe(false);
  });

  it('throws error for missing event handlers', () => {
    const template = '<button data-event="click:onMissing">Click</button>';

    expect(() => renderTemplate(template, {}, container, { events: {} })).toThrow('Missing event handler: onMissing');
  });

  it('handles complex VA detection logic from widget', () => {
    const template = `
      <var data-loop="releaseArtists" data-unwrap>
        <span data-text="name"></span><var data-if="!_last" data-unwrap><var data-if="join"><var>join</var></var></var></var>
    `;
    const data = {
      releaseArtists: [
        { name: 'Artist 1', join: ' & ' },
        { name: 'Artist 2', join: null },
      ],
    };

    renderTemplate(template, data, container);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('Artist 1 & Artist 2');
  });
});
