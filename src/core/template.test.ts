import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTemplate } from './template';

describe('renderTemplate', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders simple variables', async () => {
    const template = '<div>Hello <var>name</var>!</div>';
    const data = { name: 'World' };

    renderTemplate(template, data, container);
    expect(container.innerHTML).toBe('<div>Hello World!</div>');
  });

  it('renders nested variables', async () => {
    const template = '<div><var>user.name</var></div>';
    const data = { user: { name: 'John' } };

    renderTemplate(template, data, container);
    expect(container.innerHTML).toBe('<div>John</div>');
  });

  it('handles data-if directive', async () => {
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

  it('handles data-loop directive with arrays', async () => {
    const template = `
      <ul>
        <li data-loop="items"><var></var></li>
      </ul>
    `;
    const data = { items: ['A', 'B', 'C'] };

    renderTemplate(template, data, container);

    const lis = container.querySelectorAll('li');

    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
    expect(lis[2].textContent).toBe('C');
  });

  it('handles data-loop directive with objects', async () => {
    const template = `
      <dl>
        <var data-loop="map">
          <dt><var>_key</var></dt>
          <dd><var></var></dd>
        </var>
      </dl>
    `;
    const data = { map: { a: 1, b: 2 } };

    renderTemplate(template, data, container);
    expect(container.querySelector('dt')?.textContent).toBe('a');
    expect(container.querySelector('dd')?.textContent).toBe('1');
  });

  it('handles data-attr directive', async () => {
    const template = '<a data-attr="href:url|title:name"><var>name</var></a>';
    const data = { url: 'https://example.com', name: 'Example' };

    renderTemplate(template, data, container);

    const a = container.querySelector('a');

    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('title')).toBe('Example');
  });

  it('handles data-style directive', async () => {
    const template = '<div data-style="color:textColor|background-color:bgColor"></div>';
    const data = { textColor: 'red', bgColor: 'blue' };

    renderTemplate(template, data, container);

    const div = container.querySelector('div');

    expect(div?.style.color).toBe('red');
    expect(div?.style.backgroundColor).toBe('blue');
  });

  it('handles data-event directive', async () => {
    const template = '<button data-event="click:onClick">Click me</button>';
    let clicked = false;
    const events = {
      onClick: () => { clicked = true; },
    };

    renderTemplate(template, {}, container, { events });

    const button = container.querySelector('button');

    button?.click();
    expect(clicked).toBe(true);
    expect(button?.hasAttribute('data-event')).toBe(false);
  });

  it('handles nested VAR elements inside conditionals', async () => {
    const template = `
      <div>
        <var data-if="show">
          <span><var>name</var></span>
        </var>
      </div>
    `;
    const data = { show: true, name: 'John' };

    renderTemplate(template, data, container);
    expect(container.querySelector('span')?.textContent).toBe('John');
  });
});
