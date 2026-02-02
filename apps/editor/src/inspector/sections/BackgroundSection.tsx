import type { InspectorSectionProps } from '../types';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { AssetPickerField } from '../fields/AssetPickerField';
import { SelectField, NumberField, CheckboxField } from '../fields';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'background';

export function BackgroundSection({ context }: InspectorSectionProps) {
  const { deck, selectedSlide, onUpdate, selection } = context;
  const { isExpanded, toggle } = useInspectorExpansion();
  
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const style = selectedSlide.style ?? {};
  const assets = deck.assets ?? {};
  
  // Find asset for subtitle display
  const selectedAsset = style.backgroundAssetId ? assets[style.backgroundAssetId] : null;
  const subtitle = selectedAsset?.filename;

  const handleStyleChange = (field: string, value: string | number | boolean | undefined) => {
    onUpdate({
      type: 'slide',
      slideId,
      field: 'style',
      value: { [field]: value === '' ? undefined : value },
    });
  };

  const isTransparent = style.backgroundTransparent === true;

  return (
    <CollapsibleSection
      id={SECTION_ID}
      title="Background"
      subtitle={isTransparent ? 'Transparent' : subtitle}
      isExpanded={isExpanded(SECTION_ID)}
      onToggle={() => toggle(SECTION_ID)}
    >
      <CheckboxField
        label="Transparent"
        value={isTransparent}
        onChange={(value) => handleStyleChange('backgroundTransparent', value ? true : undefined)}
        description="No background (useful for backdrop slides)"
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
    </CollapsibleSection>
  );
}
