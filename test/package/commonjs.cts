import FieldText = require('@dev4press/field-text');

const options: FieldText.FieldTextCounterOptions =
  FieldText.fieldTextCounterDefaults;
const counter: FieldText.FieldTextCounter = new FieldText.FieldTextCounter(
  document.createElement('textarea'),
  options,
);
counter.update();
