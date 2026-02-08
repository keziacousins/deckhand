import { useRef } from 'react';
import type { InspectorSectionProps } from '../types';
import { scrollHeaderToSticky } from '../types';
import { AssetPickerField } from '../fields/AssetPickerField';
import { SelectField, NumberField, CheckboxField } from '../fields';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'background';
const HEADER_HEIGHT = 37;

export function BackgroundSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { deck, selectedSlide, onUpdate, selection } = context;
  const { isExpanded, expand, toggle } = useInspectorExpansion();
  const headerRef = useRef<HTMLDivElement>(null);
  
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const style = selectedSlide.style ?? {};
  const assets = deck.assets ?? {};
  const expanded = isExpanded(SECTION_ID);
  
  const selectedAsset = style.backgroundAssetId ? assets[style.backgroundAssetId] : null;
  const isTransparent = style.backgroundTransparent === true;

  // Subtitle shown in header when collapsed
  const subtitle = isTransparent ? 'Transparent' : selectedAsset?.filename;

  const handleStyleChange = (field: string, value: string | number | boolean | undefined) => {
    onUpdate({
      type: 'slide',
      slideId,
      field: 'style',
      value: { [field]: value === '' ? undefined : value },
    });
  };

  return (
    <>
      <div
        ref={headerRef}
        className="section-header"
        data-expanded={expanded}
        style={{ '--sticky-top': `${stickyIndex * HEADER_HEIGHT}px`, '--sticky-index': stickyIndex } as React.CSSProperties}
        onClick={() => { expand(SECTION_ID); if (headerRef.current) setTimeout(() => scrollHeaderToSticky(headerRef.current!), 250); }}
      >
        <button
          className="section-header-expand"
          onClick={(e) => { e.stopPropagation(); toggle(SECTION_ID); }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className={expanded ? 'section-header-chevron-expanded' : ''}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="section-header-title">
          <span className="section-header-name">Background</span>
          {!expanded && subtitle && (
            <span className="section-header-meta">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="section-body" data-expanded={expanded}>
        <div className="section-body-inner">
          <div className="section-body-overflow">
            <div className="section-body-content">
              <CheckboxField
                label="Transparent"
                value={isTransparent}
                onChange={(value) => handleStyleChange('backgroundTransparent', value ? true : undefined)}
              />
              
              {!isTransparent && (
                <>
                  <AssetPickerField
                    label="Image"
                    value={style.backgroundAssetId ?? ''}
                    assets={assets}
                    onChange={(value) => handleStyleChange('backgroundAssetId', value)}
                  />
                  
                  {style.backgroundAssetId && (
                    <>
                      <SelectField
                        label="Sizing"
                        value={style.backgroundSize ?? 'fill'}
                        onChange={(value) => handleStyleChange('backgroundSize', value)}
                        options={[
                          { value: 'fill', label: 'Fill (zoom to cover)' },
                          { value: 'fit-width', label: 'Fit Width' },
                          { value: 'fit-height', label: 'Fit Height' },
                        ]}
                      />
                      <NumberField
                        label="Darken"
                        value={style.backgroundDarken ?? 0}
                        onChange={(value) => handleStyleChange('backgroundDarken', value)}
                        min={0}
                        max={100}
                        step={5}
                        suffix="%"
                      />
                      <NumberField
                        label="Blur"
                        value={style.backgroundBlur ?? 0}
                        onChange={(value) => handleStyleChange('backgroundBlur', value)}
                        min={0}
                        max={20}
                        step={1}
                        suffix="px"
                      />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
