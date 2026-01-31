import type { InspectorSectionConfig, InspectorContext } from './types';
import { SlidePropertiesSection } from './sections/SlidePropertiesSection';
import { ComponentInspector } from './sections/ComponentInspector';
import { AddComponentSection } from './sections/AddComponentSection';

export const inspectorSections: InspectorSectionConfig[] = [
  {
    id: 'slide-properties',
    label: 'Slide',
    isVisible: (ctx) => ctx.selection.type === 'slide' && ctx.selectedSlide !== null,
    component: SlidePropertiesSection,
  },
  {
    id: 'component-properties',
    label: 'Component',
    isVisible: (ctx) =>
      ctx.selection.type === 'component' && ctx.selectedComponent !== null,
    component: ComponentInspector,
  },
  {
    id: 'add-component',
    label: 'Add Component',
    isVisible: (ctx) => ctx.selectedSlide !== null,
    component: AddComponentSection,
  },
];

export function getVisibleSections(context: InspectorContext): InspectorSectionConfig[] {
  return inspectorSections.filter((section) => section.isVisible(context));
}
