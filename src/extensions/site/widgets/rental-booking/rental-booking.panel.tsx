import { type FC, useCallback, useEffect, useState } from 'react';
import { widget } from '@wix/editor';
import '@wix/design-system/styles.global.css';
import {
  bodyFont,
  buttonFont,
  ColorField,
  FontField,
  headingFont,
  parseFont,
  PanelShell,
  SettingsAccordion,
  SwitchSetting,
  TextSetting,
  type FontValue,
} from '../panel-fields';

const Panel: FC = () => {
  const [title, setTitle] = useState('Rentals');
  const [description, setDescription] = useState('');
  const [buttonLabel, setButtonLabel] = useState('Rent now');
  const [itemId, setItemId] = useState('');
  const [showDeposit, setShowDeposit] = useState(true);
  const [showWeeklyPrice, setShowWeeklyPrice] = useState(true);
  const [showQuantity, setShowQuantity] = useState(true);
  const [background, setBackground] = useState('#ffffff');
  const [card, setCard] = useState('#ffffff');
  const [text, setText] = useState('#1a1a1a');
  const [heading, setHeading] = useState('#1a1a1a');
  const [accent, setAccent] = useState('#116dff');
  const [onAccent, setOnAccent] = useState('#ffffff');
  const [border, setBorder] = useState('#c7c7c7');
  const [headingType, setHeadingType] = useState<FontValue>(headingFont);
  const [bodyType, setBodyType] = useState<FontValue>(bodyFont);
  const [buttonType, setButtonType] = useState<FontValue>(buttonFont);

  useEffect(() => {
    Promise.all([
      widget.getProp('title'),
      widget.getProp('description'),
      widget.getProp('button-label'),
      widget.getProp('item-id'),
      widget.getProp('show-deposit'),
      widget.getProp('show-weekly-price'),
      widget.getProp('show-quantity'),
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
      nextDescription,
      label,
      item,
      deposit,
      weekly,
      quantity,
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
      if (nextDescription) setDescription(nextDescription);
      if (label) setButtonLabel(label);
      if (item) setItemId(item);
      if (deposit === 'false') setShowDeposit(false);
      if (weekly === 'false') setShowWeeklyPrice(false);
      if (quantity === 'false') setShowQuantity(false);
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
    }).catch((error) => console.error('Failed to load booking settings', error));
  }, []);

  const save = useCallback((name: string, value: string) => {
    widget.setProp(name, value);
  }, []);

  return (
    <PanelShell title="Rental booking">
      <SettingsAccordion
        sections={[
          {
            title: 'Content',
            initiallyOpen: true,
            children: (
              <>
                <TextSetting label="Heading" value={title} onChange={(value) => { setTitle(value); save('title', value); }} />
                <TextSetting label="Description" value={description} onChange={(value) => { setDescription(value); save('description', value); }} />
                <TextSetting label="Button label" value={buttonLabel} onChange={(value) => { setButtonLabel(value); save('button-label', value); }} />
                <TextSetting label="Item id" value={itemId} placeholder="Leave empty for a picker" onChange={(value) => { setItemId(value); save('item-id', value); }} />
              </>
            ),
          },
          {
            title: 'Options',
            children: (
              <>
                <SwitchSetting label="Show deposit" checked={showDeposit} onChange={(checked) => { setShowDeposit(checked); save('show-deposit', String(checked)); }} />
                <SwitchSetting label="Weekly price" checked={showWeeklyPrice} onChange={(checked) => { setShowWeeklyPrice(checked); save('show-weekly-price', String(checked)); }} />
                <SwitchSetting label="Quantity" checked={showQuantity} onChange={(checked) => { setShowQuantity(checked); save('show-quantity', String(checked)); }} />
              </>
            ),
          },
          {
            title: 'Colors',
            children: (
              <>
                <ColorField label="Background" value={background} onChange={(value) => { setBackground(value); save('background-color', value); }} />
                <ColorField label="Field" value={card} onChange={(value) => { setCard(value); save('card-color', value); }} />
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
