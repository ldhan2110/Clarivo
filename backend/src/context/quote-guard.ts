import type { ProposalDto } from './ai-schemas';

/**
 * The hallucination defence, and it is mechanical rather than a prompt
 * instruction: every extracted proposal must carry a quote that appears
 * verbatim in the document's extracted text once whitespace is normalised.
 *
 * A fabricated citation is the one failure mode that makes the page worse than
 * empty, so a failing proposal is dropped silently and counted — never fails
 * the document, because the honest answer to "the model invented one bullet" is
 * the other nine bullets.
 *
 * The brief and diagram blocks are exempt by rule: they are derived from
 * digests and accepted blocks rather than extracted from a span, so there is no
 * verbatim span to check. That exemption lives where those blocks are created,
 * never here — widening it is a code change someone has to make on purpose.
 */
export interface QuoteGuardResult {
  kept: ProposalDto[];
  dropped: number;
}

export function applyQuoteGuard(
  proposals: ProposalDto[],
  extractedText: string,
): QuoteGuardResult {
  const haystack = normalise(extractedText);
  const kept = proposals.filter((proposal) => haystack.includes(normalise(proposal.quote)));

  return { kept, dropped: proposals.length - kept.length };
}

/** Collapses every run of whitespace, so a line break in the PDF is not a miss. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
