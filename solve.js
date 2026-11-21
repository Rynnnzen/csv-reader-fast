// A faster drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Returns exactly csv-reader 1.0.0's answer {columns, rows, errors} for every
// input {text, header}, by the same written broken-row policy, read once left
// to right. Dependency-free ES module.
//
// How it differs from the reference: instead of building every field one
// character at a time and returning a fresh object per field, one fused
// scanner walks the text with charCodeAt, takes whole fields with a single
// slice, and only builds a pieces array when a field actually transforms
// (a stray CR dropped, a doubled quote, a CR normalised to LF inside quotes).
// Field termination is a small integer in a scanner local (0 comma,
// 1 line break, 2 end of text), never a string tag or an object. Strings stay
// UTF-16 throughout: charCodeAt plus slice preserves surrogates exactly.

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next code unit to read
  let line = 1; // the line that code unit is on
  if (n !== 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended (0 comma, 1 line break,
  // 2 end of text), and, for an unquoted scan, how many code units that scan
  // kept (the quote_junk test reads this after a quoted suffix).
  let fv = '';
  let fe = 0;
  let fa = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads an unquoted field starting at pos, with `prefix` already kept
  // ('' for an ordinary field, '"' for an unterminated-quote replay, the
  // decoded value for a quoted field's suffix). A CR not followed by LF is
  // dropped (stray_cr); a comma, LF, CRLF or the end of the text ends it.
  // Sets fv, fe and fa.
  function scanUnquoted(prefix) {
    let pieces = null; // kept runs, only when a stray CR splits the field
    let runStart = pos;
    let kept = 0;
    let end;
    for (;;) {
      while (pos < n) {
        const c = text.charCodeAt(pos);
        if (c === 44 || c === 10 || c === 13) break;
        pos++;
      }
      if (pos >= n) {
        end = 2;
        break;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        end = 0;
        break;
      }
      if (c === 10) {
        end = 1;
        break;
      }
      // c === 13: a CRLF ends the field, a lone CR is dropped.
      if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        end = 1;
        break;
      }
      error('stray_cr');
      if (pieces === null) pieces = [];
      if (pos > runStart) pieces.push(text.slice(runStart, pos));
      kept += pos - runStart;
      pos++;
      runStart = pos;
    }
    // Compose the field from its kept runs; the common case is one slice.
    if (pieces === null) {
      fv = prefix === '' ? text.slice(runStart, pos) : prefix + text.slice(runStart, pos);
    } else {
      if (pos > runStart) pieces.push(text.slice(runStart, pos));
      fv = prefix + pieces.join('');
    }
    fa = kept + (pos - runStart);
    // Consume the delimiter (a line break advances the line once).
    if (end === 0) {
      pos++;
    } else if (end === 1) {
      pos += text.charCodeAt(pos) === 13 ? 2 : 1;
      line++;
    }
    fe = end;
  }

  // Reads a quoted field whose opening quote is at pos. Sets fv, fe and fa
  // (fa is only read after a quoted suffix, where scanUnquoted sets it).
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    pos++;
    let pieces = null; // kept runs, only when a transform happens
    let runStart = pos;
    for (;;) {
      while (pos < n) {
        const c = text.charCodeAt(pos);
        if (c === 34 || c === 13) break;
        if (c === 10) line++;
        pos++;
      }
      if (pos >= n) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted, with line accounting restored.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        scanUnquoted('"');
        return;
      }
      const c = text.charCodeAt(pos);
      if (c === 34) {
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 34) {
          // A doubled quote is one literal quote.
          if (pieces === null) pieces = [];
          if (pos > runStart) pieces.push(text.slice(runStart, pos));
          pieces.push('"');
          pos += 2;
          runStart = pos;
          continue;
        }
        // The closing quote. The interior is [runStart, pos).
        pos++;
        let value;
        if (pieces === null) {
          value = text.slice(runStart, pos - 1);
        } else {
          if (pos - 1 > runStart) pieces.push(text.slice(runStart, pos - 1));
          value = pieces.join('');
        }
        if (pos >= n) {
          fv = value;
          fe = 2;
          return;
        }
        const d = text.charCodeAt(pos);
        if (d === 44) {
          pos++;
          fv = value;
          fe = 0;
          return;
        }
        if (d === 10) {
          pos++;
          line++;
          fv = value;
          fe = 1;
          return;
        }
        if (d === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line++;
          fv = value;
          fe = 1;
          return;
        }
        // What follows the closing quote is appended as it stands, up to
        // the next comma or line break; quote_junk when anything was kept.
        scanUnquoted(value);
        if (fa > 0) error('quote_junk');
        return;
      }
      // c === 13: CRLF and a lone CR inside quotes are each one LF.
      if (pieces === null) pieces = [];
      if (pos > runStart) pieces.push(text.slice(runStart, pos));
      pieces.push('\n');
      line++;
      pos += pos + 1 < n && text.charCodeAt(pos + 1) === 10 ? 2 : 1;
      runStart = pos;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = pos < n && text.charCodeAt(pos) === 34;
      if (quoted) scanQuoted();
      else scanUnquoted('');
      fields.push(fv);
    } while (fe === 0);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
