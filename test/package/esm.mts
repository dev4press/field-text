import {
  FieldTextCounter,
  type FieldTextCounterOptions,
} from '@dev4press/field-text';
import '@dev4press/field-text/fieldtext.css';

const options: FieldTextCounterOptions = { maxChars: 20 };
const counter = new FieldTextCounter(
  document.createElement('textarea'),
  options,
);
counter.update();
