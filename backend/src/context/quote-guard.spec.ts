import { describe, expect, it } from 'vitest';
import type { ProposalDto } from './ai-schemas';
import { applyQuoteGuard } from './quote-guard';

const TEXT = `The depot scanners run offline for up to four hours.

Invoices are imported nightly from the ERP,
and reconciled by the finance team.`;

function proposal(quote: string, statement = 'a statement'): ProposalDto {
  return {
    kind: 'add',
    section: 'scope',
    statement,
    confidence: 'stated',
    quote,
    locator: 'p.1',
  };
}

describe('applyQuoteGuard', () => {
  it('keeps a quote that appears verbatim', () => {
    const { kept, dropped } = applyQuoteGuard(
      [proposal('The depot scanners run offline for up to four hours.')],
      TEXT,
    );

    expect(kept).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it('drops a fabricated quote while its siblings survive', () => {
    const { kept, dropped } = applyQuoteGuard(
      [
        proposal('The depot scanners run offline for up to four hours.', 'real'),
        proposal('Invoices are paid within 30 days of receipt.', 'invented'),
        proposal('reconciled by the finance team', 'also real'),
      ],
      TEXT,
    );

    expect(kept.map((p) => p.statement)).toEqual(['real', 'also real']);
    expect(dropped).toBe(1);
  });

  it('keeps a quote that differs only in whitespace', () => {
    // The source wraps this across a line break; the model returned one line.
    const { kept } = applyQuoteGuard(
      [proposal('Invoices are imported nightly from the ERP, and reconciled by the finance team.')],
      TEXT,
    );

    expect(kept).toHaveLength(1);
  });

  it('normalises runs of whitespace and leading or trailing space', () => {
    const { kept } = applyQuoteGuard([proposal('   invoices   are\n\n  imported   nightly  ')], TEXT.toLowerCase());

    expect(kept).toHaveLength(1);
  });

  it('is case sensitive — a reworded quote is not a quote', () => {
    const { kept, dropped } = applyQuoteGuard(
      [proposal('THE DEPOT SCANNERS RUN OFFLINE')],
      TEXT,
    );

    expect(kept).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it('drops everything rather than failing when nothing matches', () => {
    const { kept, dropped } = applyQuoteGuard([proposal('entirely invented')], TEXT);

    expect(kept).toEqual([]);
    expect(dropped).toBe(1);
  });
});
