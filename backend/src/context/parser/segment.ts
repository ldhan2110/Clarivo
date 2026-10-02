/**
 * One locatable span of a document. `locator` is whatever the format can
 * honestly report — `p.12`, `§3.2`, `line 44` — and null when it can report
 * nothing, in which case the quote carries the whole verification burden.
 */
export interface Segment {
  text: string;
  locator: string | null;
}
