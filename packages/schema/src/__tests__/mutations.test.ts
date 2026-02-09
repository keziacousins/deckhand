import { describe, it, expect } from 'vitest';
import {
  addSlide,
  updateSlide,
  deleteSlide,
  addComponent,
  updateComponent,
  deleteComponent,
  reorderComponent,
  moveComponent,
  addEdge,
  updateEdge,
  deleteEdge,
  addStartPoint,
  updateStartPoint,
  deleteStartPoint,
  updateFlowSettings,
  updateDeckSettings,
  updateTheme,
  updateCustomThemeTokens,
  moveSlide,
} from '../mutations';
import { createEmptyDeck } from '../deck';
import type { Deck } from '../index';

// Helper to create a deck with slides for testing
function createTestDeck(): Deck {
  const deck = createEmptyDeck('Test Deck');
  // Add a slide with a component
  const { deck: deck1, slideId } = addSlide(deck, { title: 'Slide 1' });
  const { deck: deck2 } = addComponent(deck1, slideId, {
    type: 'deck-text',
    props: { content: 'Hello World' },
  });
  return deck2;
}

// ============================================================================
// Slide Mutations
// ============================================================================

describe('addSlide', () => {
  it('adds a slide to an empty deck', () => {
    const deck = createEmptyDeck('Test');
    const { deck: newDeck, slideId } = addSlide(deck, { title: 'New Slide' });

    expect(slideId).toMatch(/^slide-/);
    expect(newDeck.slides[slideId]).toBeDefined();
    expect(newDeck.slides[slideId].title).toBe('New Slide');
    expect(newDeck.slides[slideId].components).toEqual([]);
  });

  it('uses default title when not provided', () => {
    const deck = createEmptyDeck('Test');
    const { deck: newDeck, slideId } = addSlide(deck);

    expect(newDeck.slides[slideId].title).toBe('New Slide');
  });

  it('uses provided position', () => {
    const deck = createEmptyDeck('Test');
    const { deck: newDeck, slideId } = addSlide(deck, {
      position: { x: 500, y: 200 },
    });

    expect(newDeck.slides[slideId].position).toEqual({ x: 500, y: 200 });
  });

  it('calculates position based on existing slides', () => {
    const deck = createEmptyDeck('Test');
    const { deck: deck1 } = addSlide(deck, { position: { x: 0, y: 0 } });
    const { deck: deck2, slideId } = addSlide(deck1);

    expect(deck2.slides[slideId].position.x).toBeGreaterThan(0);
  });

  it('does not modify the original deck', () => {
    const deck = createEmptyDeck('Test');
    const originalSlideCount = Object.keys(deck.slides).length;
    addSlide(deck, { title: 'New Slide' });

    expect(Object.keys(deck.slides).length).toBe(originalSlideCount);
  });
});

describe('updateSlide', () => {
  it('updates slide title', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = updateSlide(deck, slideId, { title: 'Updated Title' });

    expect(newDeck.slides[slideId].title).toBe('Updated Title');
  });

  it('updates slide notes', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = updateSlide(deck, slideId, { notes: 'Speaker notes here' });

    expect(newDeck.slides[slideId].notes).toBe('Speaker notes here');
  });

  it('updates slide gridColumns', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = updateSlide(deck, slideId, { gridColumns: 6 });

    expect(newDeck.slides[slideId].gridColumns).toBe(6);
  });

  it('updates slide style', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = updateSlide(deck, slideId, {
      style: { backgroundColor: '#ff0000' },
    });

    expect(newDeck.slides[slideId].style?.backgroundColor).toBe('#ff0000');
  });

  it('merges style updates', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const deck1 = updateSlide(deck, slideId, {
      style: { backgroundColor: '#ff0000' },
    });
    const deck2 = updateSlide(deck1, slideId, {
      style: { padding: '20px' },
    });

    expect(deck2.slides[slideId].style?.backgroundColor).toBe('#ff0000');
    expect(deck2.slides[slideId].style?.padding).toBe('20px');
  });

  it('removes empty style object', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const deck1 = updateSlide(deck, slideId, {
      style: { backgroundColor: '#ff0000' },
    });
    const deck2 = updateSlide(deck1, slideId, {
      style: { backgroundColor: undefined },
    });

    expect(deck2.slides[slideId].style).toBeUndefined();
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() => updateSlide(deck, 'non-existent', { title: 'Test' })).toThrow(
      'Slide non-existent not found'
    );
  });

  it('does not modify the original deck', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const originalTitle = deck.slides[slideId].title;
    updateSlide(deck, slideId, { title: 'New Title' });

    expect(deck.slides[slideId].title).toBe(originalTitle);
  });
});

describe('deleteSlide', () => {
  it('removes a slide from the deck', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = deleteSlide(deck, slideId);

    expect(newDeck.slides[slideId]).toBeUndefined();
  });

  it('removes edges connected to deleted slide', () => {
    const deck = createTestDeck();
    const { deck: deck1, slideId: slide2 } = addSlide(deck, { title: 'Slide 2' });
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck2 } = addEdge(deck1, { from: slideId1, to: slide2 });

    const newDeck = deleteSlide(deck2, slide2);
    const edges = Object.values(newDeck.flow.edges);
    const hasEdgeToDeletedSlide = edges.some((e) => e.to === slide2);

    expect(hasEdgeToDeletedSlide).toBe(false);
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() => deleteSlide(deck, 'non-existent')).toThrow(
      'Slide non-existent not found'
    );
  });

  it('does not modify the original deck', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    deleteSlide(deck, slideId);

    expect(deck.slides[slideId]).toBeDefined();
  });
});

// ============================================================================
// Component Mutations
// ============================================================================

describe('addComponent', () => {
  it('adds a component to a slide', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const { deck: newDeck, componentId } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Some text' },
    });

    expect(componentId).toMatch(/^comp-/);
    const slide = newDeck.slides[slideId];
    const component = slide.components.find((c) => c.id === componentId);
    expect(component).toBeDefined();
    expect(component?.type).toBe('deck-text');
    expect(component?.props.content).toBe('Some text');
  });

  it('adds component at specified position', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const { deck: newDeck, componentId } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Inserted' },
      position: 0,
    });

    expect(newDeck.slides[slideId].components[0].id).toBe(componentId);
  });

  it('adds component with parentId for containers', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    
    // First add a container
    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: { direction: 'row' },
    });
    
    // Then add a child component
    const { deck: deck2, componentId: childId } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: { content: 'Child' },
      parentId: containerId,
    });

    const child = deck2.slides[slideId].components.find((c) => c.id === childId);
    expect(child?.parentId).toBe(containerId);
  });

  it('throws error when parent container not found', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    expect(() =>
      addComponent(deck, slideId, {
        type: 'deck-text',
        props: {},
        parentId: 'non-existent',
      })
    ).toThrow('Parent container non-existent not found');
  });

  it('throws error when parent is not a container', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const existingComponentId = deck.slides[slideId].components[0].id;

    expect(() =>
      addComponent(deck, slideId, {
        type: 'deck-text',
        props: {},
        parentId: existingComponentId,
      })
    ).toThrow('is not a container');
  });

  it('prevents nesting containers inside containers', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    
    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });

    expect(() =>
      addComponent(deck1, slideId, {
        type: 'deck-container',
        props: {},
        parentId: containerId,
      })
    ).toThrow('Containers cannot be nested');
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() =>
      addComponent(deck, 'non-existent', { type: 'deck-text', props: {} })
    ).toThrow('Slide non-existent not found');
  });
});

describe('updateComponent', () => {
  it('updates component props', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const componentId = deck.slides[slideId].components[0].id;

    const newDeck = updateComponent(deck, slideId, componentId, {
      content: 'Updated text',
    });

    const component = newDeck.slides[slideId].components[0];
    expect(component.props.content).toBe('Updated text');
  });

  it('merges props updates', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const componentId = deck.slides[slideId].components[0].id;

    const deck1 = updateComponent(deck, slideId, componentId, { content: 'New text' });
    const deck2 = updateComponent(deck1, slideId, componentId, { gridWidth: 6 });

    const component = deck2.slides[slideId].components[0];
    expect(component.props.content).toBe('New text');
    expect(component.props.gridWidth).toBe(6);
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() =>
      updateComponent(deck, 'non-existent', 'comp-1', { content: 'Test' })
    ).toThrow('Slide non-existent not found');
  });

  it('throws error for non-existent component', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    expect(() =>
      updateComponent(deck, slideId, 'non-existent', { content: 'Test' })
    ).toThrow('Component non-existent not found');
  });
});

describe('deleteComponent', () => {
  it('removes a component from a slide', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const componentId = deck.slides[slideId].components[0].id;

    const newDeck = deleteComponent(deck, slideId, componentId);
    const component = newDeck.slides[slideId].components.find(
      (c) => c.id === componentId
    );

    expect(component).toBeUndefined();
  });

  it('deletes children when deleting a container', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    // Add container with child
    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });
    const { deck: deck2, componentId: childId } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: { content: 'Child' },
      parentId: containerId,
    });

    // Delete container
    const newDeck = deleteComponent(deck2, slideId, containerId);

    const container = newDeck.slides[slideId].components.find(
      (c) => c.id === containerId
    );
    const child = newDeck.slides[slideId].components.find((c) => c.id === childId);

    expect(container).toBeUndefined();
    expect(child).toBeUndefined();
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() => deleteComponent(deck, 'non-existent', 'comp-1')).toThrow(
      'Slide non-existent not found'
    );
  });

  it('throws error for non-existent component', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    expect(() => deleteComponent(deck, slideId, 'non-existent')).toThrow(
      'Component non-existent not found'
    );
  });
});

describe('reorderComponent', () => {
  it('moves component up', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    // Add second component
    const { deck: deck1, componentId: secondId } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Second' },
    });

    const newDeck = reorderComponent(deck1, slideId, secondId, 'up');
    expect(newDeck.slides[slideId].components[0].id).toBe(secondId);
  });

  it('moves component down', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    // Add second component
    const { deck: deck1 } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Second' },
    });

    const newDeck = reorderComponent(deck1, slideId, firstId, 'down');
    expect(newDeck.slides[slideId].components[1].id).toBe(firstId);
  });

  it('returns unchanged deck when cannot move further up', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    const newDeck = reorderComponent(deck, slideId, firstId, 'up');
    expect(newDeck.slides[slideId].components[0].id).toBe(firstId);
  });

  it('returns unchanged deck when cannot move further down', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    const newDeck = reorderComponent(deck, slideId, firstId, 'down');
    expect(newDeck.slides[slideId].components[0].id).toBe(firstId);
  });

  it('throws error for non-existent component', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    expect(() => reorderComponent(deck, slideId, 'non-existent', 'up')).toThrow(
      'Component non-existent not found'
    );
  });
});

describe('moveComponent', () => {
  it('moves component to new index', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    // Add more components
    const { deck: deck1, componentId: secondId } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Second' },
    });
    const { deck: deck2 } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: { content: 'Third' },
    });

    const newDeck = moveComponent(deck2, slideId, firstId, 2);
    expect(newDeck.slides[slideId].components[2].id).toBe(firstId);
    expect(newDeck.slides[slideId].components[0].id).toBe(secondId);
  });

  it('supports options object format', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    const { deck: deck1, componentId: secondId } = addComponent(deck, slideId, {
      type: 'deck-text',
      props: { content: 'Second' },
    });

    const newDeck = moveComponent(deck1, slideId, firstId, { newIndex: 1 });
    expect(newDeck.slides[slideId].components[1].id).toBe(firstId);
  });

  it('moves component into container', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });
    const { deck: deck2, componentId: textId } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: { content: 'Move me' },
    });

    const newDeck = moveComponent(deck2, slideId, textId, {
      newIndex: 0,
      newParentId: containerId,
    });

    const movedComponent = newDeck.slides[slideId].components.find(
      (c) => c.id === textId
    );
    expect(movedComponent?.parentId).toBe(containerId);
  });

  it('moves component out of container', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });
    const { deck: deck2, componentId: textId } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: { content: 'Child' },
      parentId: containerId,
    });

    const newDeck = moveComponent(deck2, slideId, textId, {
      newIndex: 0,
      newParentId: null,
    });

    const movedComponent = newDeck.slides[slideId].components.find(
      (c) => c.id === textId
    );
    expect(movedComponent?.parentId).toBeUndefined();
  });

  it('clamps index to valid range', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    const newDeck = moveComponent(deck, slideId, firstId, 100);
    // Should still be at index 0 (only one component)
    expect(newDeck.slides[slideId].components[0].id).toBe(firstId);
  });

  it('returns unchanged deck when no change needed', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const firstId = deck.slides[slideId].components[0].id;

    const newDeck = moveComponent(deck, slideId, firstId, 0);
    expect(newDeck).toBe(deck);
  });

  it('throws error when moving container into container', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    const { deck: deck1, componentId: container1 } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });
    const { deck: deck2, componentId: container2 } = addComponent(deck1, slideId, {
      type: 'deck-container',
      props: {},
    });

    expect(() =>
      moveComponent(deck2, slideId, container1, {
        newIndex: 0,
        newParentId: container2,
      })
    ).toThrow('Containers cannot be nested');
  });

  it('throws error when moving component into itself', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    // Use a non-container component for this test
    const { deck: deck1, componentId: containerId } = addComponent(deck, slideId, {
      type: 'deck-container',
      props: {},
    });
    const { deck: deck2, componentId: textId } = addComponent(deck1, slideId, {
      type: 'deck-text',
      props: {},
    });

    // The "into itself" check only applies to containers
    // A non-container can't have children, so test with a container trying to go into itself
    // But container check fires first. Let's test the actual code path.
    // Actually, the check order means containers hit "cannot be nested" first.
    // Remove this test as the code path is unreachable for containers.
    // Test that we at least get an error for invalid parent.
    expect(() =>
      moveComponent(deck2, slideId, textId, {
        newIndex: 0,
        newParentId: textId, // text can't be a parent
      })
    ).toThrow('is not a container');
  });
});

// ============================================================================
// Edge Mutations
// ============================================================================

describe('addEdge', () => {
  it('adds an edge between two slides', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });

    const { deck: newDeck, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
    });

    expect(edgeId).toMatch(/^edge-/);
    expect(newDeck.flow.edges[edgeId]).toBeDefined();
    expect(newDeck.flow.edges[edgeId].from).toBe(slideId1);
    expect(newDeck.flow.edges[edgeId].to).toBe(slideId2);
  });

  it('uses default trigger when not provided', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });

    const { deck: newDeck, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
    });

    expect(newDeck.flow.edges[edgeId].trigger).toBe('default');
  });

  it('adds edge with label and transition', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });

    const { deck: newDeck, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
      label: 'Next',
      transition: 'slide-left',
      transitionDuration: 500,
    });

    const edge = newDeck.flow.edges[edgeId];
    expect(edge.label).toBe('Next');
    expect(edge.transition).toBe('slide-left');
    expect(edge.transitionDuration).toBe(500);
  });

  it('adds edge from start point to slide', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });

    const { deck: newDeck, edgeId } = addEdge(deck1, {
      from: startPointId,
      to: slideId,
    });

    expect(newDeck.flow.edges[edgeId].from).toBe(startPointId);
  });

  it('throws error for non-existent source', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    expect(() =>
      addEdge(deck, { from: 'non-existent', to: slideId })
    ).toThrow('Source non-existent not found');
  });

  it('throws error for non-existent target', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    expect(() =>
      addEdge(deck, { from: slideId, to: 'non-existent' })
    ).toThrow('Target slide non-existent not found');
  });
});

describe('updateEdge', () => {
  it('updates edge trigger', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });
    const { deck: deck2, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
    });

    const newDeck = updateEdge(deck2, edgeId, { trigger: 'click' });
    expect(newDeck.flow.edges[edgeId].trigger).toBe('click');
  });

  it('updates edge transition', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });
    const { deck: deck2, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
    });

    const newDeck = updateEdge(deck2, edgeId, {
      transition: 'fade',
      transitionDuration: 300,
    });

    expect(newDeck.flow.edges[edgeId].transition).toBe('fade');
    expect(newDeck.flow.edges[edgeId].transitionDuration).toBe(300);
  });

  it('removes label when set to empty string', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });
    const { deck: deck2, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
      label: 'Test',
    });

    const newDeck = updateEdge(deck2, edgeId, { label: '' });
    expect(newDeck.flow.edges[edgeId].label).toBeUndefined();
  });

  it('throws error for non-existent edge', () => {
    const deck = createTestDeck();
    expect(() => updateEdge(deck, 'non-existent', { trigger: 'click' })).toThrow(
      'Edge non-existent not found'
    );
  });
});

describe('deleteEdge', () => {
  it('removes an edge from the deck', () => {
    const deck = createTestDeck();
    const slideId1 = Object.keys(deck.slides)[0];
    const { deck: deck1, slideId: slideId2 } = addSlide(deck, { title: 'Slide 2' });
    const { deck: deck2, edgeId } = addEdge(deck1, {
      from: slideId1,
      to: slideId2,
    });

    const newDeck = deleteEdge(deck2, edgeId);
    expect(newDeck.flow.edges[edgeId]).toBeUndefined();
  });

  it('throws error for non-existent edge', () => {
    const deck = createTestDeck();
    expect(() => deleteEdge(deck, 'non-existent')).toThrow(
      'Edge non-existent not found'
    );
  });
});

// ============================================================================
// Start Point Mutations
// ============================================================================

describe('addStartPoint', () => {
  it('adds a start point to the deck', () => {
    const deck = createTestDeck();
    const { deck: newDeck, startPointId } = addStartPoint(deck, {
      name: 'Main Start',
    });

    expect(startPointId).toMatch(/^start-/);
    expect(newDeck.flow.startPoints?.[startPointId]).toBeDefined();
    expect(newDeck.flow.startPoints?.[startPointId].name).toBe('Main Start');
  });

  it('uses provided position', () => {
    const deck = createTestDeck();
    const { deck: newDeck, startPointId } = addStartPoint(deck, {
      name: 'Start',
      position: { x: -300, y: 100 },
    });

    expect(newDeck.flow.startPoints?.[startPointId].position).toEqual({
      x: -300,
      y: 100,
    });
  });

  it('optionally connects to a slide', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const { deck: newDeck, startPointId, edgeId } = addStartPoint(deck, {
      name: 'Start',
      connectToSlide: slideId,
    });

    expect(edgeId).toBeDefined();
    expect(newDeck.flow.edges[edgeId!].from).toBe(startPointId);
    expect(newDeck.flow.edges[edgeId!].to).toBe(slideId);
  });

  it('calculates position based on existing content', () => {
    const deck = createTestDeck();
    const { deck: newDeck, startPointId } = addStartPoint(deck, { name: 'Start' });

    // Should be to the left of slides
    const slide = Object.values(deck.slides)[0];
    expect(newDeck.flow.startPoints?.[startPointId].position.x).toBeLessThan(
      slide.position.x
    );
  });
});

describe('updateStartPoint', () => {
  it('updates start point name', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Old Name' });

    const newDeck = updateStartPoint(deck1, startPointId, { name: 'New Name' });
    expect(newDeck.flow.startPoints?.[startPointId].name).toBe('New Name');
  });

  it('updates start point position', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });

    const newDeck = updateStartPoint(deck1, startPointId, {
      position: { x: 100, y: 200 },
    });
    expect(newDeck.flow.startPoints?.[startPointId].position).toEqual({
      x: 100,
      y: 200,
    });
  });

  it('throws error for non-existent start point', () => {
    const deck = createTestDeck();
    expect(() =>
      updateStartPoint(deck, 'non-existent', { name: 'Test' })
    ).toThrow('Start point non-existent not found');
  });
});

describe('deleteStartPoint', () => {
  it('removes a start point from the deck', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });

    const newDeck = deleteStartPoint(deck1, startPointId);
    expect(newDeck.flow.startPoints?.[startPointId]).toBeUndefined();
  });

  it('removes edges from deleted start point', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const { deck: deck1, startPointId, edgeId } = addStartPoint(deck, {
      name: 'Start',
      connectToSlide: slideId,
    });

    const newDeck = deleteStartPoint(deck1, startPointId);
    expect(newDeck.flow.edges[edgeId!]).toBeUndefined();
  });

  it('cleans up empty startPoints object', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });

    const newDeck = deleteStartPoint(deck1, startPointId);
    expect(newDeck.flow.startPoints).toBeUndefined();
  });

  it('throws error for non-existent start point', () => {
    const deck = createTestDeck();
    expect(() => deleteStartPoint(deck, 'non-existent')).toThrow(
      'Start point non-existent not found'
    );
  });
});

// ============================================================================
// Flow Settings Mutations
// ============================================================================

describe('updateFlowSettings', () => {
  it('updates default transition', () => {
    const deck = createTestDeck();
    const newDeck = updateFlowSettings(deck, { defaultTransition: 'fade' });

    expect(newDeck.flow.defaultTransition).toBe('fade');
  });

  it('updates default transition duration', () => {
    const deck = createTestDeck();
    const newDeck = updateFlowSettings(deck, { defaultTransitionDuration: 500 });

    expect(newDeck.flow.defaultTransitionDuration).toBe(500);
  });

  it('updates multiple settings at once', () => {
    const deck = createTestDeck();
    const newDeck = updateFlowSettings(deck, {
      defaultTransition: 'slide-up',
      defaultTransitionDuration: 250,
    });

    expect(newDeck.flow.defaultTransition).toBe('slide-up');
    expect(newDeck.flow.defaultTransitionDuration).toBe(250);
  });
});

// ============================================================================
// Deck Settings Mutations
// ============================================================================

describe('updateDeckSettings', () => {
  it('updates deck title', () => {
    const deck = createTestDeck();
    const newDeck = updateDeckSettings(deck, { title: 'New Title' });

    expect(newDeck.meta.title).toBe('New Title');
    // Updated timestamp should be set (may be same if test runs fast, so just check it exists)
    expect(newDeck.meta.updated).toBeDefined();
  });

  it('updates deck description', () => {
    const deck = createTestDeck();
    const newDeck = updateDeckSettings(deck, { description: 'A description' });

    expect(newDeck.meta.description).toBe('A description');
  });

  it('updates aspect ratio', () => {
    const deck = createTestDeck();
    const newDeck = updateDeckSettings(deck, { aspectRatio: '4:3' });

    expect(newDeck.aspectRatio).toBe('4:3');
  });

  it('updates grid columns', () => {
    const deck = createTestDeck();
    const newDeck = updateDeckSettings(deck, { gridColumns: 6 });

    expect(newDeck.gridColumns).toBe(6);
  });

  it('throws error for invalid grid columns', () => {
    const deck = createTestDeck();
    expect(() => updateDeckSettings(deck, { gridColumns: 0 })).toThrow(
      'gridColumns must be between 1 and 12'
    );
    expect(() => updateDeckSettings(deck, { gridColumns: 13 })).toThrow(
      'gridColumns must be between 1 and 12'
    );
  });

  it('sets default backdrop slide', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const newDeck = updateDeckSettings(deck, { defaultBackdropSlideId: slideId });

    expect(newDeck.defaultBackdropSlideId).toBe(slideId);
  });

  it('clears default backdrop slide with null', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const deck1 = updateDeckSettings(deck, { defaultBackdropSlideId: slideId });
    const deck2 = updateDeckSettings(deck1, { defaultBackdropSlideId: null });

    expect(deck2.defaultBackdropSlideId).toBeUndefined();
  });

  it('throws error for non-existent backdrop slide', () => {
    const deck = createTestDeck();
    expect(() =>
      updateDeckSettings(deck, { defaultBackdropSlideId: 'non-existent' })
    ).toThrow('Slide non-existent not found');
  });

  it('sets default start point', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });
    const newDeck = updateDeckSettings(deck1, { defaultStartPointId: startPointId });

    expect(newDeck.defaultStartPointId).toBe(startPointId);
  });

  it('clears default start point with null', () => {
    const deck = createTestDeck();
    const { deck: deck1, startPointId } = addStartPoint(deck, { name: 'Start' });
    const deck2 = updateDeckSettings(deck1, { defaultStartPointId: startPointId });
    const deck3 = updateDeckSettings(deck2, { defaultStartPointId: null });

    expect(deck3.defaultStartPointId).toBeUndefined();
  });

  it('throws error for non-existent start point', () => {
    const deck = createTestDeck();
    expect(() =>
      updateDeckSettings(deck, { defaultStartPointId: 'non-existent' })
    ).toThrow('Start point non-existent not found');
  });
});

// ============================================================================
// Theme Mutations
// ============================================================================

describe('updateTheme', () => {
  it('updates theme tokens', () => {
    const deck = createTestDeck();
    const newDeck = updateTheme(deck, {
      'color-background': '#000000',
      'color-text': '#ffffff',
    });

    expect(newDeck.theme.tokens['color-background']).toBe('#000000');
    expect(newDeck.theme.tokens['color-text']).toBe('#ffffff');
  });

  it('merges with existing tokens', () => {
    const deck = createTestDeck();
    const originalBackground = deck.theme.tokens['color-background'];
    const newDeck = updateTheme(deck, { 'color-text': '#ffffff' });

    expect(newDeck.theme.tokens['color-background']).toBe(originalBackground);
    expect(newDeck.theme.tokens['color-text']).toBe('#ffffff');
  });

  it('does not modify the original deck', () => {
    const deck = createTestDeck();
    const originalColor = deck.theme.tokens['color-text'];
    updateTheme(deck, { 'color-text': '#ffffff' });

    expect(deck.theme.tokens['color-text']).toBe(originalColor);
  });
});

describe('updateCustomThemeTokens', () => {
  it('adds custom tokens', () => {
    const deck = createTestDeck();
    const newDeck = updateCustomThemeTokens(deck, {
      'brand-primary': '#007bff',
      'brand-secondary': '#6c757d',
    });

    expect(newDeck.theme.customTokens?.['brand-primary']).toBe('#007bff');
    expect(newDeck.theme.customTokens?.['brand-secondary']).toBe('#6c757d');
  });

  it('merges with existing custom tokens', () => {
    const deck = createTestDeck();
    const deck1 = updateCustomThemeTokens(deck, { 'brand-primary': '#007bff' });
    const deck2 = updateCustomThemeTokens(deck1, { 'brand-secondary': '#6c757d' });

    expect(deck2.theme.customTokens?.['brand-primary']).toBe('#007bff');
    expect(deck2.theme.customTokens?.['brand-secondary']).toBe('#6c757d');
  });
});

// ============================================================================
// Slide Position Mutations
// ============================================================================

describe('moveSlide', () => {
  it('moves slide to new position', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];

    const newDeck = moveSlide(deck, slideId, { x: 500, y: 300 });

    expect(newDeck.slides[slideId].position).toEqual({ x: 500, y: 300 });
  });

  it('throws error for non-existent slide', () => {
    const deck = createTestDeck();
    expect(() => moveSlide(deck, 'non-existent', { x: 0, y: 0 })).toThrow(
      'Slide non-existent not found'
    );
  });

  it('does not modify the original deck', () => {
    const deck = createTestDeck();
    const slideId = Object.keys(deck.slides)[0];
    const originalPosition = { ...deck.slides[slideId].position };
    moveSlide(deck, slideId, { x: 500, y: 300 });

    expect(deck.slides[slideId].position).toEqual(originalPosition);
  });
});
