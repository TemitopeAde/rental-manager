import { type FC, useCallback, useEffect, useState } from 'react';
import { widget } from '@wix/editor';
import '@wix/design-system/styles.global.css';
import {
  bodyFont,
  buttonFont,
  ChoiceSetting,
  ColorField,
  FontField,
  headingFont,
  NumberSetting,
  PanelShell,
  parseFont,
  SettingsAccordion,
  SwitchSetting,
  TextSetting,
  type FontValue,
} from '../panel-fields';

const Panel: FC = () => {
  const [title, setTitle] = useState('Rentals');
  const [columns, setColumns] = useState(3);
  const [pageSize, setPageSize] = useState(12);
  const [priceBasis, setPriceBasis] = useState('daily');
  const [showCategoryFilter, setShowCategoryFilter] = useState(true);
  const [background, setBackground] = useState('#ffffff');
  const [card, setCard] = useState('#ffffff');
  const [text, setText] = useState('#1a1a1a');
  const [heading, setHeading] = useState('#1a1a1a');
  const [accent, setAccent] = useState('#116dff');
  const [onAccent, setOnAccent] = useState('#ffffff');
  const [border, setBorder] = useState('#e0e0e0');
  const [headingType, setHeadingType] = useState<FontValue>(headingFont);
  const [bodyType, setBodyType] = useState<FontValue>(bodyFont);
  const [buttonType, setButtonType] = useState<FontValue>(buttonFont);

  useEffect(() => {
    Promise.all([
      widget.getProp('title'),
      widget.getProp('columns'),
      widget.getProp('page-size'),
      widget.getProp('price-basis'),
      widget.getProp('show-category-filter'),
      widget.getProp('background-color'),
      widget.getProp('card-color'),
      widget.getProp('text-color'),
      widget.getProp('heading-color'),
      widget.getProp('accent-color'),
      widget.getProp('button-text-color'),
      widget.getProp('border-color'),
      widget.getProp('heading-font'),
      widget.getProp('body-font'),
      widget.getProp('button-font'),
    ]).then(([
      nextTitle,
      nextColumns,
      nextPageSize,
      basis,
      categoryFilter,
      nextBackground,
      nextCard,
      nextText,
      nextHeading,
      nextAccent,
      nextOnAccent,
      nextBorder,
      nextHeadingFont,
      nextBodyFont,
      nextButtonFont,
    ]) => {
      if (nextTitle) setTitle(nextTitle);
      if (nextColumns) setColumns(Number(nextColumns) || 3);
      if (nextPageSize) setPageSize(Number(nextPageSize) || 12);
      if (basis) setPriceBasis(basis);
      if (categoryFilter === 'false') setShowCategoryFilter(false);
      if (nextBackground) setBackground(nextBackground);
      if (nextCard) setCard(nextCard);
      if (nextText) setText(nextText);
      if (nextHeading) setHeading(nextHeading);
      if (nextAccent) setAccent(nextAccent);
      if (nextOnAccent) setOnAccent(nextOnAccent);
      if (nextBorder) setBorder(nextBorder);
      if (nextHeadingFont) setHeadingType(parseFont(nextHeadingFont, headingFont));
      if (nextBodyFont) setBodyType(parseFont(nextBodyFont, bodyFont));
      if (nextButtonFont) setButtonType(parseFont(nextButtonFont, buttonFont));
    }).catch((error) => console.error('Failed to load catalog settings', error));
  }, []);

  const save = useCallback((name: string, value: string) => {
    widget.setProp(name, value);
  }, []);

  return (
    <PanelShell title="Rental catalog">
      <SettingsAccordion
        sections={[
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <TextSetting label="Catalog heading" value={title} onChange={(value) => { setTitle(value); save('title', value); }} />
                <ChoiceSetting
                  label="Price"
                  value={priceBasis}
                  options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]}
                  onChange={(value) => { setPriceBasis(value); save('price-basis', value); }}
                />
              </>
            ),
          },
          {
            title: 'Layout',
            children: (
              <>
                <NumberSetting label="Columns" value={columns} min={1} max={4} onChange={(value) => { setColumns(value); save('columns', String(value)); }} />
                <NumberSetting label="Items per page" value={pageSize} min={1} max={48} onChange={(value) => { setPageSize(value); save('page-size', String(value)); }} />
                <SwitchSetting label="Category filter" checked={showCategoryFilter} onChange={(checked) => { setShowCategoryFilter(checked); save('show-category-filter', String(checked)); }} />
              </>
            ),
          },
          {
            title: 'Colors',
            children: (
              <>
                <ColorField label="Background" value={background} onChange={(value) => { setBackground(value); save('background-color', value); }} />
                <ColorField label="Card" value={card} onChange={(value) => { setCard(value); save('card-color', value); }} />
                <ColorField label="Text" value={text} onChange={(value) => { setText(value); save('text-color', value); }} />
                <ColorField label="Heading color" value={heading} onChange={(value) => { setHeading(value); save('heading-color', value); }} />
                <ColorField label="Button" value={accent} onChange={(value) => { setAccent(value); save('accent-color', value); }} />
                <ColorField label="Button text" value={onAccent} onChange={(value) => { setOnAccent(value); save('button-text-color', value); }} />
                <ColorField label="Border" value={border} onChange={(value) => { setBorder(value); save('border-color', value); }} />
              </>
            ),
          },
          {
            title: 'Typography',
            children: (
              <>
                <FontField label="Heading font" value={headingType} onChange={(value) => { setHeadingType(value); save('heading-font', JSON.stringify(value)); }} />
                <FontField label="Body font" value={bodyType} onChange={(value) => { setBodyType(value); save('body-font', JSON.stringify(value)); }} />
                <FontField label="Button font" value={buttonType} onChange={(value) => { setButtonType(value); save('button-font', JSON.stringify(value)); }} />
              </>
            ),
          },
        ]}
      />
    </PanelShell>
  );
};

export default Panel;
