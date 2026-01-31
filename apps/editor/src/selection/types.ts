export type SelectionType = 'none' | 'slide' | 'component';

export interface Selection {
  type: SelectionType;
  slideId: string | null;
  componentId: string | null;
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
