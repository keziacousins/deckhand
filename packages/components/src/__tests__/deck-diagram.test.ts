import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock mermaid before importing the component
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg class="mermaid-svg"><text>Mock diagram</text></svg>' }),
  },
}));

import mermaid from 'mermaid';
import { DeckDiagram } from '../components/deck-diagram';

describe('DeckDiagram', () => {
  beforeAll(() => {
    if (!customElements.get('deck-diagram')) {
      customElements.define('deck-diagram', DeckDiagram);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // Reset the mock to default success behavior
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg class="mermaid-svg"><text>Mock diagram</text></svg>' } as any);
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-diagram')).toBe(DeckDiagram);
  });

  it('has correct meta information', () => {
    expect(DeckDiagram.meta.type).toBe('deck-diagram');
    expect(DeckDiagram.meta.name).toBe('Diagram');
    expect(DeckDiagram.meta.category).toBe('data');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('shows placeholder when source is empty', () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', '');
    document.body.appendChild(el);

    // Render is debounced, but connectedCallback calls render directly
    const placeholder = el.shadowRoot?.querySelector('.placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toBe('No diagram source');
  });

  it('calls mermaid.render with source', async () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', 'graph TD\n  A-->B');
    document.body.appendChild(el);

    // Wait for the async mermaid.render to resolve
    await vi.waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
    });

    const call = vi.mocked(mermaid.render).mock.calls[0];
    expect(call[1]).toBe('graph TD\n  A-->B');
  });

  it('renders SVG from mermaid output', async () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', 'graph TD\n  A-->B');
    document.body.appendChild(el);

    await vi.waitFor(() => {
      const svg = el.shadowRoot?.querySelector('.mermaid-svg');
      expect(svg).not.toBeNull();
    });

    const diagram = el.shadowRoot?.querySelector('.diagram');
    expect(diagram).not.toBeNull();
  });

  it('shows error message on mermaid parse failure', async () => {
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Parse error: invalid syntax'));

    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', 'not valid mermaid');
    document.body.appendChild(el);

    await vi.waitFor(() => {
      const error = el.shadowRoot?.querySelector('.error');
      expect(error).not.toBeNull();
    });

    const error = el.shadowRoot?.querySelector('.error');
    expect(error?.textContent).toContain('Parse error: invalid syntax');
  });

  it('initializes mermaid with the correct theme', async () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', 'graph TD\n  A-->B');
    el.setAttribute('theme', 'dark');
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(mermaid.initialize).toHaveBeenCalled();
    });

    const initCall = vi.mocked(mermaid.initialize).mock.calls.find(
      (call) => (call[0] as any).theme === 'dark'
    );
    expect(initCall).toBeDefined();
  });

  it('observes expected attributes', () => {
    expect(DeckDiagram.observedAttributes).toContain('source');
    expect(DeckDiagram.observedAttributes).toContain('theme');
    expect(DeckDiagram.observedAttributes).toContain('grid-width');
  });

  it('updates when source attribute changes', async () => {
    const el = document.createElement('deck-diagram') as InstanceType<typeof DeckDiagram>;
    el.setAttribute('source', 'graph TD\n  A-->B');
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(mermaid.render).toHaveBeenCalledTimes(1);
    });

    // Change source — debounced, so need to wait
    el.setAttribute('source', 'graph LR\n  X-->Y');

    await vi.waitFor(() => {
      expect(mermaid.render).toHaveBeenCalledTimes(2);
    }, { timeout: 300 });

    const lastCall = vi.mocked(mermaid.render).mock.calls[1];
    expect(lastCall[1]).toBe('graph LR\n  X-->Y');
  });
});
