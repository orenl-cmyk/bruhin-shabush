
/* Origami Web Form - Valid Arrival Date Range */
(() => {
  'use strict';

  // ==========================================
  // CONFIGURATION
  // ==========================================
  const FIELD_FROM = 'fld_1959';
  const FIELD_TO = 'fld_1960';

  // Sunday, Tuesday, Thursday, Friday
  const ALLOWED_START_DAYS = [0, 2, 4, 5];

  const $ = window.jQuery;

  if (!$) {
    console.error('[Origami dates] jQuery unavailable');
    return;
  }

  // Prevent duplicate initialization
  if (window.__origamiDateRangeCleanup) {
    window.__origamiDateRangeCleanup();
  }

  // ==========================================
  // DATE HELPERS
  // ==========================================
  const find = name =>
    document.querySelector(`input[name="${name}"]`);

  function parse(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      .exec(String(value || '').trim());

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(2000, month - 1, day, 12);
    date.setFullYear(year);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;

    return date;
  }

  function shift(date, days) {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
  }

  function format(date) {
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear()
    ].join('/');
  }

  function nextAllowed(date) {
    let result = new Date(date.getTime());

    for (let i = 0; i < 7; i++) {
      if (ALLOWED_START_DAYS.includes(result.getDay())) {
        return result;
      }
      result = shift(result, 1);
    }

    return result;
  }

  function endFromStart(from) {
    // Friday arrival -> Saturday departure
    return shift(from, from.getDay() === 5 ? 1 : 2);
  }

  // ==========================================
  // BUSINESS RULES
  // ==========================================
  function normalize(date, side) {
    if (side === 'from') {
      const from = nextAllowed(date);
      return [from, endFromStart(from)];
    }

    // When end date changes:
    // Find the earliest valid departure on or after
    // the selected date, preferring a 3-day stay.
    for (let offset = 0; offset <= 7; offset++) {
      const candidateEnd = shift(date, offset);

      // Prefer 3-day ranges (Thursday-Saturday)
      const candidateStart = shift(candidateEnd, -2);

      if (
        ALLOWED_START_DAYS.includes(
          candidateStart.getDay()
        ) &&
        endFromStart(candidateStart).getTime() ===
          candidateEnd.getTime()
      ) {
        return [candidateStart, candidateEnd];
      }

      // Friday-Saturday fallback
      const fridayStart = shift(candidateEnd, -1);

      if (
        fridayStart.getDay() === 5 &&
        endFromStart(fridayStart).getTime() ===
          candidateEnd.getTime()
      ) {
        return [fridayStart, candidateEnd];
      }
    }

    const from = nextAllowed(date);
    return [from, endFromStart(from)];
  }

  // ==========================================
  // ORIGAMI DATEPICKER UPDATE
  // ==========================================
  let busy = false;
  const last = new WeakMap();

  function update(input, value) {
    if (!input) return;

    const scope = window.angular
      ?.element(input)
      ?.scope();

    // Also check the Angular model, not only input
    if (
      input.value === value &&
      scope?.scopeData?.value === value
    ) return;

    const picker = $(input);

    if (typeof picker.datetimepicker === 'function') {
      picker.datetimepicker({
        value,
        format: 'd/m/Y'
      });
    } else {
      picker.val(value);
    }

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
  // EVENT HANDLERS
  // ==========================================
  const namespace = '.origamiDateRange';

  function attach(input, side) {
    if (!input) return;

    if (input.dataset.origamiDateRangeBound === '1') {
      return;
    }

    input.dataset.origamiDateRangeBound = '1';
    last.set(input, input.value);

    $(input).on(
      'change' + namespace + ' blur' + namespace,
      () => {
        if (busy) return;
        if (last.get(input) === input.value) return;

        last.set(input, input.value);
        handle(side);
      }
    );
  }

  function bind() {
    attach(find(FIELD_FROM), 'from');
    attach(find(FIELD_TO), 'to');
  }

  bind();

  const observer = new MutationObserver(bind);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  const interval = setInterval(bind, 1050);

  window.__origamiDateRangeCleanup = () => {
    observer.disconnect();
    clearInterval(interval);

    [FIELD_FROM, FIELD_TO].forEach(name => {
      document.querySelectorAll(
        `input[name="${name}"]`
      ).forEach(input => {
        $(input).off(namespace);
        delete input.dataset.origamiDateRangeBound;
      });
    });
  };

  console.info(
    '[Origami dates] Ready - allowed arrivals:',
    'Sunday, Tuesday, Thursday, Friday'
  );
})();
