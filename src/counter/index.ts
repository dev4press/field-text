import type {
  FieldTextCounterField,
  FieldTextCounterOptions,
  FieldTextCounterVisibility,
} from '../types.js';

interface FieldSelection {
  start: number;
  end: number;
  direction: 'forward' | 'backward' | 'none' | null;
}

interface FieldEdit {
  value: string;
  selection: FieldSelection | null;
}

const textInputTypes = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
]);

function isTextField(field: FieldTextCounterField): boolean {
  return field.localName === 'textarea' || textInputTypes.has(field.type);
}

const dataAttributes = {
  maxChars: 'data-field-text-counter-max-chars',
  maxPercentageWarning: 'data-field-text-counter-max-percentage-warning',
  msgAppendMethod: 'data-field-text-counter-msg-append-method',
  format: 'data-field-text-counter-format',
  visibility: 'data-field-text-counter-visibility',
  countMode: 'data-field-text-counter-count-mode',
} as const;

export const fieldTextCounterDefaults: Required<FieldTextCounterOptions> = {
  maxChars: 100,
  maxPercentageWarning: 80,
  msgAppendMethod: 'insertAfter',
  format: '{current} / {max} characters',
  visibility: 'focus',
  countMode: 'codeUnits',
};

export class FieldTextCounter {
  private static readonly counters = new WeakMap<
    FieldTextCounterField,
    FieldTextCounter
  >();

  public element: HTMLDivElement | null = null;

  private readonly field: FieldTextCounterField;
  private readonly options: Required<FieldTextCounterOptions>;
  private lastValue: string;
  private beforeEdit: FieldEdit | null = null;
  private composing = false;

  private readonly handleBeforeInput = (event: Event): void => {
    if (!this.composing && !(event as InputEvent).isComposing) {
      this.beforeEdit = this.readEdit();
    }
  };
  private readonly handleInput = (event: Event): void => {
    if (!this.composing && !(event as InputEvent).isComposing) {
      this.finishEdit();
    }
  };
  private readonly handleCompositionStart = (): void => {
    this.beforeEdit = this.readEdit();
    this.composing = true;
  };
  private readonly handleCompositionEnd = (): void => {
    this.composing = false;
    this.finishEdit();
  };
  private readonly handleFocus = (): void => this.update();
  private readonly handlePaste = (): void => {
    const beforePaste = this.readEdit();
    setTimeout(() => {
      const { value } = this.field;
      if (value !== beforePaste.value && value !== this.lastValue) {
        this.refresh(beforePaste);
      }
    }, 0);
  };
  private readonly handleBlur = (): void => {
    if (!this.isAlwaysVisible()) {
      this.hide();
    }
  };

  public static autoLoad(
    options: FieldTextCounterOptions = {},
  ): FieldTextCounter[] {
    const fields = document.querySelectorAll<FieldTextCounterField>(
      'textarea[data-field-text-counter], input[data-field-text-counter]',
    );

    return Array.from(fields)
      .filter(isTextField)
      .map((field) => {
        const counter =
          this.counters.get(field) ?? new FieldTextCounter(field, options);
        counter.update();
        return counter;
      });
  }

  public constructor(
    field: FieldTextCounterField,
    options: FieldTextCounterOptions = {},
  ) {
    this.field = field;
    this.lastValue = field.value;
    const configuredOptions = {
      ...options,
      ...this.getDataOptions(),
    };
    const maxChars =
      configuredOptions.maxChars ??
      (field.maxLength >= 0
        ? field.maxLength
        : fieldTextCounterDefaults.maxChars);
    this.options = {
      ...fieldTextCounterDefaults,
      ...configuredOptions,
      maxChars,
    };

    if (!isTextField(field) || this.options.maxChars <= 0) {
      return;
    }

    FieldTextCounter.counters.get(field)?.destroy();
    FieldTextCounter.counters.set(field, this);
    this.element = field.ownerDocument.createElement('div');
    this.element.className = 'field-text-counter';
    this.element.setAttribute('aria-live', 'polite');

    this.insertElement();
    this.field.addEventListener('beforeinput', this.handleBeforeInput);
    this.field.addEventListener('input', this.handleInput);
    this.field.addEventListener(
      'compositionstart',
      this.handleCompositionStart,
    );
    this.field.addEventListener('compositionend', this.handleCompositionEnd);
    this.field.addEventListener('focus', this.handleFocus);
    this.field.addEventListener('paste', this.handlePaste);
    this.field.addEventListener('blur', this.handleBlur);
  }

  public getCount(): number {
    return this.getCountForValue(this.field.value);
  }

  public update(): void {
    this.refresh();
  }

  public destroy(): void {
    this.field.removeEventListener('beforeinput', this.handleBeforeInput);
    this.field.removeEventListener('input', this.handleInput);
    this.field.removeEventListener(
      'compositionstart',
      this.handleCompositionStart,
    );
    this.field.removeEventListener('compositionend', this.handleCompositionEnd);
    this.field.removeEventListener('focus', this.handleFocus);
    this.field.removeEventListener('paste', this.handlePaste);
    this.field.removeEventListener('blur', this.handleBlur);
    this.element?.remove();
    this.element = null;
    if (FieldTextCounter.counters.get(this.field) === this) {
      FieldTextCounter.counters.delete(this.field);
    }
  }

  private finishEdit(): void {
    const beforeEdit = this.beforeEdit ?? {
      value: this.lastValue,
      selection: null,
    };
    this.beforeEdit = null;
    this.refresh(beforeEdit);
  }

  private refresh(beforeEdit?: FieldEdit): void {
    if (!this.element || this.composing) {
      return;
    }

    this.insertElement();
    let count = this.getCount();
    if (count > this.options.maxChars) {
      this.limitValue(beforeEdit);
      count = this.getCount();
    }

    this.lastValue = this.field.value;
    const percentage = (count / this.options.maxChars) * 100;
    this.element.classList.toggle(
      'field-text-counter--warning',
      percentage >= this.options.maxPercentageWarning,
    );
    const message = this.formatMessage(count);
    if (this.element.textContent !== message) {
      this.element.textContent = message;
    }
    const root = this.field.getRootNode();
    const focused =
      'activeElement' in root && root.activeElement === this.field;
    this.element.classList.toggle(
      'field-text-counter--visible',
      this.isAlwaysVisible() || focused,
    );
  }

  private limitValue(beforeEdit?: FieldEdit): void {
    const edit = this.readEdit();
    const previousSelection = beforeEdit?.selection;
    const editsTail =
      !beforeEdit ||
      ((!previousSelection ||
        previousSelection.end === beforeEdit.value.length) &&
        edit.value.startsWith(
          beforeEdit.value.slice(0, previousSelection?.start),
        ));

    // Trimming the end of a middle edit would remove existing text.
    const restorePrevious =
      beforeEdit &&
      !editsTail &&
      this.getCountForValue(beforeEdit.value) <= this.options.maxChars;
    const value = restorePrevious
      ? beforeEdit.value
      : this.truncateValue(edit.value);
    const selection = (restorePrevious && previousSelection) || edit.selection;
    const removed =
      restorePrevious && !previousSelection
        ? Math.max(0, edit.value.length - value.length)
        : 0;
    const scrollTop = this.field.scrollTop;
    this.field.value = value;
    if (selection) {
      this.field.setSelectionRange(
        Math.max(0, selection.start - removed),
        Math.max(0, selection.end - removed),
        selection.direction ?? undefined,
      );
    }
    this.field.scrollTop = scrollTop;
  }

  private readEdit(): FieldEdit {
    const { value, selectionStart, selectionEnd, selectionDirection } =
      this.field;
    return {
      value,
      selection:
        selectionStart === null || selectionEnd === null
          ? null
          : {
              start: selectionStart,
              end: selectionEnd,
              direction: selectionDirection,
            },
    };
  }

  private formatMessage(count: number): string {
    const numbers = {
      current: String(count),
      max: String(this.options.maxChars),
      remaining: String(this.options.maxChars - count),
      percentage: String(Math.round((count / this.options.maxChars) * 100)),
    };
    return this.options.format.replace(
      /\{(current|max|remaining|percentage)}/g,
      (_, token: keyof typeof numbers) => numbers[token],
    );
  }

  private getCountForValue(value: string): number {
    return this.options.countMode === 'graphemes'
      ? this.getGraphemes(value).length
      : value.length;
  }

  private truncateValue(value: string): string {
    if (this.options.countMode === 'graphemes') {
      return this.getGraphemes(value).slice(0, this.options.maxChars).join('');
    }

    let result = '';
    let length = 0;

    for (const character of value) {
      if (length + character.length > this.options.maxChars) {
        break;
      }

      result += character;
      length += character.length;
    }

    return result;
  }

  private getGraphemes(value: string): string[] {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      });

      return Array.from(segmenter.segment(value), ({ segment }) => segment);
    }

    return Array.from(value);
  }

  private getDataOptions(): FieldTextCounterOptions {
    const options: FieldTextCounterOptions = {};
    const maxChars = this.getNumberDataOption(dataAttributes.maxChars);
    const maxPercentageWarning = this.getNumberDataOption(
      dataAttributes.maxPercentageWarning,
    );
    const msgAppendMethod = this.field.getAttribute(
      dataAttributes.msgAppendMethod,
    );
    const format = this.field.getAttribute(dataAttributes.format);
    const visibility = this.field.getAttribute(dataAttributes.visibility);
    const countMode = this.field.getAttribute(dataAttributes.countMode);

    if (maxChars !== undefined) {
      options.maxChars = maxChars;
    }
    if (maxPercentageWarning !== undefined) {
      options.maxPercentageWarning = maxPercentageWarning;
    }
    if (
      msgAppendMethod === 'insertAfter' ||
      msgAppendMethod === 'insertBefore'
    ) {
      options.msgAppendMethod = msgAppendMethod;
    }
    if (format !== null) {
      options.format = format;
    }
    if (visibility === 'always' || visibility === 'focus') {
      options.visibility = visibility;
    } else if (visibility === 'true' || visibility === 'false') {
      options.visibility = visibility === 'true';
    }
    if (countMode === 'codeUnits' || countMode === 'graphemes') {
      options.countMode = countMode;
    }

    return options;
  }

  private getNumberDataOption(attribute: string): number | undefined {
    const value = this.field.getAttribute(attribute);
    if (value === null || value.trim() === '') {
      return undefined;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private isAlwaysVisible(): boolean {
    const visibility: FieldTextCounterVisibility = this.options.visibility;
    return visibility === 'always' || visibility === true;
  }

  private insertElement(): void {
    if (!this.element || !this.field.parentNode) {
      return;
    }

    if (this.options.msgAppendMethod === 'insertBefore') {
      if (this.field.previousSibling !== this.element) {
        this.field.before(this.element);
      }
    } else if (this.field.nextSibling !== this.element) {
      this.field.after(this.element);
    }
  }

  private hide(): void {
    this.element?.classList.remove('field-text-counter--visible');
  }
}
