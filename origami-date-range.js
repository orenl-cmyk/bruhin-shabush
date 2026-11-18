
/* Origami Web Form - synchronized visit date range */
(() => {
  'use strict';

  // ==========================================
  // CONFIGURATION - Origami field data names
  // ==========================================
  const FIELD_FROM = 'fld_1959';
  const FIELD_TO = 'fld_1960';

  const $ = window.jQuery;

  if (!$) {
    console.error('[Origami dates] jQuery unavailable');
    return;
  }

  // ==========================================
  // DATE HELPERS
  // ==========================================

  const find = name =>
    document.querySelector(`input[name="${name}"]`);

  function parse(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      .exec((value || '').trim());

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day, 12);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function shift(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function format(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${date.getFullYear()}`;
  }

  // ==========================================
  // BUSINESS RULES
  // ==========================================

  function normalize(date, side) {
    const weekday = date.getDay();
    // 0 Sunday, 5 Friday, 6 Saturday

    if (side === 'from') {
      // Saturday start -> Friday-Saturday
      const from = weekday === 6
        ? shift(date, -1)
        : date;

      const to = shift(
        from,
        from.getDay() === 5 ? 1 : 2
      );

      return [from, to];
    }

    // Changing the end date:
    // Sunday/Monday cannot be valid end days.
    // Move forward to the next valid 3-day range.
    if (weekday === 0 || weekday === 1) {
      return [date, shift(date, 2)];
    }

    // Tuesday-Saturday -> 3 days including start
    return [shift(date, -2), date];
  }

  // ==========================================
  // ORIGAMI FIELD UPDATE
  // ==========================================

  let busy = false;
  const last = new WeakMap();

  function update(input, value) {
    if (!input || input.value === value) return;

    const picker = $(input);

    // Use the Origami Datepicker mechanism
    if (typeof picker.datetimepicker === 'function') {
      picker.datetimepicker({
        value: value,
        format: 'd/m/Y'
      });
    } else {
      picker.val(value);
    }

    // Notify Origami / AngularJS
    picker.trigger('change');
    picker.trigger('change.xdsoft');
    picker.trigger('blur');
  }

  // ==========================================
  // BIDIRECTIONAL SYNCHRONIZATION
  // ==========================================

  function handle(side) {
    if (busy) return;

    const fromInput = find(FIELD_FROM);
    const toInput = find(FIELD_TO);

    if (!fromInput || !toInput) return;

    const source = side === 'from'
      ? fromInput
      : toInput;

    const date = parse(source.value);
    if (!date) return;

    const [from, to] = normalize(date, side);

    busy = true;

    try {
      update(fromInput, format(from));
      update(toInput, format(to));
    } finally {
      last.set(fromInput, fromInput.value);
      last.set(toInput, toInput.value);
      busy = false;
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  function attach(input, side) {
    if (!input) return;

    if (input.dataset.origamiDateRangeBound === '1') {
      return;
    }

    input.dataset.origamiDateRangeBound = '1';
    last.set(input, input.value);

    $(input).on(
      'change.origamiDateRange blur.origamiDateRange',
      () => {
        if (busy) return;

        if (last.get(input) === input.value) {
          return;
        }

        last.set(input, input.value);
        handle(side);
      }
    );
  }

  function bind() {
    attach(find(FIELD_FROM), 'from');
    attach(find(FIELD_TO), 'to');
  }

  // Initial binding
  bind();

  // Support fields rendered later by AngularJS
  const observer = new MutationObserver(bind);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Fallback for dynamically replaced inputs
  setInterval(bind, 1050);

  console.info(
    '[Origami dates] Ready:',
    FIELD_FROM,
    FIELD_TO
  );
})();
