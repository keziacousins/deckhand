# Deckhand Architecture

Deckhand is a presentation authoring tool with an LLM as the primary interface. Users describe what they want in natural language, and the LLM edits a structured document that renders as slides.

## Core Principles

1. **LLM-first authoring** - Natural language is the primary way to create and edit content
2. **Structured content** - Slides are defined by validated JSON schemas, not pixels
3. **Web components** - Declarative, framework-agnostic components for rendering
4. **Real-time collaboration** - YJS/YDoc for multiplayer editing
5. **Non-linear flows** - Slides connect via navigation paths, not just linear sequences
6. **Same renderer everywhere** - Preview and export use identical rendering

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Editor UI                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Canvas    │  │   Preview   │  │    LLM Interface    │ │
│  │ (React Flow)│  │(Shadow DOM) │  │  (chat + tools)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     JSON Schema                             │
│            (Zod validated, TypeScript types)                │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │   Diff   │  │  YDoc    │  │ Renderer │
        │ + Patch  │  │  Sync    │  │ (export) │
        └──────────┘  └──────────┘  └──────────┘
```

## Data Flow

### LLM Editing

```
User prompt
    │
    ▼
LLM generates tool call (e.g., update_slide)
    │
    ▼
Server validates against Zod schema
    │
    ▼
ID-based diff computes patches
    │
    ▼
Patches applied to YDoc
    │
    ▼
YDoc syncs to all connected clients
```

### Direct Editing

```
User edits text in preview (contenteditable)
    │
    ▼
Web component emits deck-change event
    │
    ▼
Editor captures event, updates local state
    │
    ▼
Diff computes patches
    │
    ▼
Patches applied to YDoc
    │
    ▼
YDoc syncs to all connected clients
```

## Document Schema

JSON is the source of truth. No YAML layer.

```json
{
  "meta": {
    "id": "deck-123",
    "title": "Q4 Review",
    "created": "2025-01-15T10:00:00Z",
    "updated": "2025-01-15T14:30:00Z"
  },
  
  "theme": {
    "id": "corporate-blue",
    "tokens": {
      "color-primary": "#1a365d",
      "color-accent": "#e53e3e",
      "font-heading": "Inter",
      "font-body": "Source Sans Pro",
      "spacing-unit": "8px"
    }
  },
  
  "slides": {
    "slide-1": {
      "title": "Welcome",
      "components": [
        {
          "id": "comp-1",
          "type": "deck-title",
          "props": { "text": "Q4 Review", "level": 1 }
        },
        {
          "id": "comp-2",
          "type": "deck-subtitle",
          "props": { "text": "Engineering Team" }
        }
      ],
      "position": { "x": 0, "y": 0 }
    },
    "slide-2": {
      "title": "Agenda",
      "components": [
        {
          "id": "comp-3",
          "type": "deck-list",
          "props": {
            "items": ["Metrics", "Wins", "Challenges", "Q1 Goals"]
          }
        }
      ],
      "position": { "x": 400, "y": 0 }
    }
  },
  
  "flow": {
    "edges": {
      "edge-1": {
        "from": "start-1",
        "to": "slide-1",
        "trigger": "default"
      },
      "edge-2": {
        "from": "slide-1",
        "to": "slide-2",
        "trigger": "default",
        "transition": "slide-left"
      }
    },
    "startPoints": {
      "start-1": {
        "id": "start-1",
        "name": "Main",
        "position": { "x": -200, "y": 0 }
      }
    }
  },
  
  "defaultStartPointId": "start-1"
}
```

### Design Decisions

- **Objects with IDs, not arrays** - Enables ID-based diffing for efficient sync
- **Slides keyed by ID** - `slides["slide-1"]` not `slides[0]`
- **Components have IDs** - For granular updates and direct editing
- **Edges as objects** - Same pattern for consistency
- **Position on slides** - For canvas layout, not presentation order

## YDoc Structure

The YDoc mirrors the JSON structure using nested Y.Map and Y.Array:

```
ydoc.getMap('meta')           # Y.Map for metadata
ydoc.getMap('theme')          # Y.Map for theme tokens
ydoc.getMap('slides')         # Y.Map<slideId, Y.Map<slide>>
ydoc.getMap('flow')           # Y.Map for edges and entry point
```

### Sync Strategy

1. **JSON diffing** - Compare previous and next state, generate patches
2. **ID-based patches** - Patches reference items by ID, not array index
3. **Apply to YDoc** - Translate patches to YDoc operations
4. **CRDT merge** - YJS handles concurrent edits automatically

### Persistence

```sql
CREATE TABLE decks (
  id VARCHAR(36) PRIMARY KEY,
  content JSON,           -- Source of truth
  content_hash CHAR(64),  -- For bootstrap consistency
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE ydoc_states (
  deck_id VARCHAR(36) PRIMARY KEY,
  data LONGBLOB,          -- Ephemeral collaboration state
  updated_at TIMESTAMP
);
```

**Bootstrap flow:**
1. Client connects, server loads deck JSON and YDoc state
2. Compute hash of current JSON
3. If hash matches stored hash, load YDoc binary (fast path)
4. If hash differs, rebuild YDoc from JSON (consistency recovery)

## Web Components

Vanilla custom elements with Shadow DOM for style isolation.

### Component Structure

```javascript
class DeckTitle extends HTMLElement {
  static observedAttributes = ['text', 'level', 'align'];
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
  }
  
  attributeChangedCallback() {
    this.render();
  }
  
  render() {
    const level = this.getAttribute('level') || '1';
    const text = this.getAttribute('text') || '';
    const align = this.getAttribute('align') || 'center';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          text-align: ${align};
        }
        h1, h2, h3 {
          font-family: var(--deck-font-heading);
          color: var(--deck-color-primary);
          margin: 0;
        }
      </style>
      <h${level} contenteditable="true">${text}</h${level}>
    `;
    
    this.shadowRoot.querySelector(`h${level}`).addEventListener('blur', (e) => {
      this.dispatchEvent(new CustomEvent('deck-change', {
        bubbles: true,
        composed: true,
        detail: { property: 'text', value: e.target.textContent }
      }));
    });
  }
}

customElements.define('deck-title', DeckTitle);
```

### Theme Injection

Themes are injected as CSS custom properties at the shadow root:

```javascript
function applyTheme(shadowRoot, theme) {
  const style = document.createElement('style');
  style.textContent = `
    :host {
      --deck-color-primary: ${theme.tokens['color-primary']};
      --deck-color-accent: ${theme.tokens['color-accent']};
      --deck-font-heading: ${theme.tokens['font-heading']};
      --deck-font-body: ${theme.tokens['font-body']};
      --deck-spacing-unit: ${theme.tokens['spacing-unit']};
    }
  `;
  shadowRoot.prepend(style);
}
```

### Component Library

| Component | Purpose |
|-----------|---------|
| `<deck-slide>` | Slide container, applies theme, grid layout |
| `<deck-title>` | Headings (h1-h6) |
| `<deck-headline-subhead>` | Hero layouts with headline + subheading |
| `<deck-text>` | Rich text paragraphs (bold, italic, links) |
| `<deck-list>` | Bullet/numbered lists |
| `<deck-image>` | Images with caption, fit modes, effects |
| `<deck-floating-image>` | Absolutely positioned images |
| `<deck-container>` | Sub-grid container for grouping components |

## CSS Architecture

Complete isolation between editor UI and slide content.

```
packages/
├── components/
│   ├── base.css           # Reset for shadow DOM
│   ├── tokens.css         # Default theme tokens
│   └── [component].css    # Per-component styles
│
├── editor/
│   └── styles/
│       ├── reset.css      # Editor reset
│       ├── layout.css     # Canvas, panels
│       ├── nodes.css      # React Flow nodes
│       └── inspector.css  # Property panels
```

- Editor styles never reference `--deck-*` tokens
- Component styles never reference editor classes
- Shadow DOM provides hard boundary

## LLM Integration

### Tool Definitions

```typescript
const tools = {
  update_slide: {
    description: "Update a slide's components or properties",
    parameters: {
      slide_id: { type: "string", required: true },
      title: { type: "string" },
      components: { type: "array", items: ComponentSchema }
    }
  },
  
  add_slide: {
    description: "Add a new slide to the deck",
    parameters: {
      after_slide_id: { type: "string" },
      title: { type: "string", required: true },
      template: { type: "string", enum: ["blank", "title", "content", "two-column"] }
    }
  },
  
  delete_slide: {
    description: "Remove a slide from the deck",
    parameters: {
      slide_id: { type: "string", required: true }
    }
  },
  
  connect_slides: {
    description: "Create navigation between slides",
    parameters: {
      from_slide: { type: "string", required: true },
      to_slide: { type: "string", required: true },
      trigger: { type: "string", default: "default" }
    }
  },
  
  update_theme: {
    description: "Modify the deck's theme tokens",
    parameters: {
      tokens: { type: "object" }
    }
  },
  
  reorder_components: {
    description: "Change the order of components within a slide",
    parameters: {
      slide_id: { type: "string", required: true },
      component_ids: { type: "array", items: { type: "string" } }
    }
  }
};
```

### Tool Execution Flow

1. LLM returns tool call with parameters
2. Server validates parameters against Zod schema
3. Server reads current deck state
4. Server applies the tool operation
5. Server diffs old vs new state
6. Server applies patches to YDoc
7. Changes sync to all clients

## Canvas (React Flow)

The canvas provides a bird's-eye view of the deck structure.

### Node Types

- **Slide node** - Thumbnail preview of slide content
- Renders actual web components in a scaled-down shadow DOM
- Shows slide title as label

### Edge Types

- **Default edge** - Linear flow (next slide)
- **Trigger edge** - Non-linear navigation (button click, etc.)

### Interactions

- Drag slides to reposition on canvas
- Draw edges to create navigation paths
- Click slide to select and see preview
- Double-click to focus preview for direct editing

### What We're NOT Doing

Unlike the reference project (ProcessFactory), we're not:
- Editing content directly in React Flow nodes
- Complex parent/child node hierarchies
- Multiple notation adapters
- Two-way sync between canvas and domain

The canvas is purely for visualization and flow editing. Content editing happens in the preview panel (via LLM or direct editing).

## Package Structure

```
deckhand/
├── packages/
│   ├── schema/              # Zod schemas, TypeScript types
│   │   ├── deck.ts          # Main deck schema, flow, start points
│   │   ├── slide.ts         # Slide schema, styles, layout
│   │   ├── component.ts     # Component schemas
│   │   ├── theme.ts         # Theme schema
│   │   ├── mutations.ts     # Pure functions for deck mutations
│   │   └── richtext.ts      # Rich text content schema
│   │
│   ├── components/          # Web components
│   │   ├── base.ts          # Base component class
│   │   ├── registry.ts      # Component registration
│   │   ├── types.ts         # Component metadata types
│   │   ├── components/      # Individual components
│   │   │   ├── deck-slide/
│   │   │   ├── deck-title/
│   │   │   ├── deck-text/
│   │   │   ├── deck-list/
│   │   │   ├── deck-image/
│   │   │   ├── deck-floating-image/
│   │   │   ├── deck-container/
│   │   │   └── deck-headline-subhead/
│   │   └── utils/
│   │       └── image-renderer.ts
│   │
│   └── sync/                # Collaboration layer
│       ├── diff.ts          # JSON diffing
│       ├── patch.ts         # Patch application
│       └── ydoc.ts          # YDoc conversion utilities
│
├── apps/
│   ├── editor/              # Frontend application
│   │   ├── src/
│   │   │   ├── canvas/      # React Flow canvas components
│   │   │   ├── inspector/   # Property inspector panels
│   │   │   ├── pages/       # Route pages (DeckList, DeckEditor, Presentation)
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── selection/   # Selection context
│   │   │   ├── sync/        # YDoc client bindings
│   │   │   └── api/         # API client functions
│   │   └── styles/          # Editor CSS
│   │
│   └── server/              # Backend
│       ├── src/
│       │   ├── routes/      # REST endpoints (decks, assets, chat, models)
│       │   ├── db/          # Database schema and queries
│       │   ├── llm/         # LLM tools and prompts
│       │   ├── sessions.ts  # WebSocket session management
│       │   └── persistence.ts # YDoc persistence
│       └── data/            # SQLite database and uploads
│
└── ARCHITECTURE.md
```

## Export

### PDF Generation

1. Renderer produces HTML for each slide
2. Puppeteer loads HTML with theme CSS
3. Screenshot each slide at target resolution
4. Combine into PDF

### Web Deployment

1. Renderer produces static HTML
2. Include web component bundle
3. Include theme CSS
4. Include navigation JS (for non-linear flows)
5. Deploy as static site

## What We're Reusing from Reference Code

From `reference-code/processfactory-studio`:

| Module | What We Take |
|--------|--------------|
| `collaboration/diff.ts` | ID-based diffing algorithm |
| `collaboration/patch.ts` | Patch application logic |
| `collaboration/conversion.ts` | `toYValue`/`fromYValue` utilities |
| `persistence.ts` | Hash-based bootstrap pattern |
| `yWebsocketServer.ts` | YJS WebSocket setup |
| Zod patterns | Schema validation approach |

| Module | What We Simplify/Remove |
|--------|------------------------|
| NotationAdapter system | Single adapter, no multi-notation |
| YAML serialization | JSON only |
| NodeTypeRegistry | Simpler component registry |
| Inspector sections | LLM is the primary editor |
| Two-path sync | One-way: schema -> render |

## Decisions

### Rich Text

Text components (`<deck-text>`, `<deck-title>`, etc.) support inline formatting:
- Bold, italic, underline
- Links
- Inline code

Serialization uses a minimal format (not full HTML):

```json
{
  "type": "deck-text",
  "props": {
    "content": [
      { "text": "This is " },
      { "text": "bold", "bold": true },
      { "text": " and " },
      { "text": "linked", "href": "https://example.com" },
      { "text": " text." }
    ]
  }
}
```

This keeps the schema JSON-friendly, avoids HTML parsing, and maps cleanly to contenteditable operations.

### Asset Management

Images are uploaded to the server and stored in a per-deck asset library.

```json
{
  "assets": {
    "asset-1": {
      "filename": "hero-image.png",
      "mimeType": "image/png",
      "size": 245000,
      "url": "/api/decks/deck-123/assets/asset-1",
      "uploaded": "2025-01-15T10:00:00Z"
    }
  }
}
```

Components reference assets by ID:

```json
{
  "type": "deck-image",
  "props": {
    "assetId": "asset-1",
    "alt": "Hero image",
    "caption": "Our product in action"
  }
}
```

**Roadmap:** Shared asset libraries across decks/teams.

### Version History

MVP: YDoc provides automatic undo/redo within a session.

**Roadmap:** Named versions (snapshots) for explicit save points:

```json
{
  "versions": {
    "v-1": {
      "name": "Draft 1",
      "created": "2025-01-15T10:00:00Z",
      "contentHash": "abc123..."
    }
  }
}
```

### Multiplayer Permissions

MVP: All collaborators have full edit access.

**Roadmap:** Role-based permissions (owner, editor, viewer).

### Offline Support

Supported for sessions that start online and go offline. YDoc handles this naturally:

1. Client connects, syncs initial state
2. Connection drops
3. User continues editing locally (YDoc queues changes)
4. Connection restored
5. YDoc syncs queued changes, merges with server state

Edge case NOT supported in MVP: Starting a session while offline (would require local deck creation + sync on reconnect).
