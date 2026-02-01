export type SelectionType = 'none' | 'slide' | 'component' | 'edge' | 'startPoint';

export interface Selection {
  type: SelectionType;
  slideId: string | null;
  componentId: string | null;
  edgeId: string | null;
  startPointId: string | null;
}

export function isSlideSelected(
  sel: Selection
): sel is Selection & { type: 'slide'; slideId: string } {
  return sel.type === 'slide' && sel.slideId !== null;
}

export function isComponentSelected(
  sel: Selection
): sel is Selection & { type: 'component'; slideId: string; componentId: string } {
  return sel.type === 'component' && sel.slideId !== null && sel.componentId !== null;
}

export function isEdgeSelected(
  sel: Selection
): sel is Selection & { type: 'edge'; edgeId: string } {
  return sel.type === 'edge' && sel.edgeId !== null;
}

export function isStartPointSelected(
  sel: Selection
): sel is Selection & { type: 'startPoint'; startPointId: string } {
  return sel.type === 'startPoint' && sel.startPointId !== null;
}
