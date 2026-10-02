import type { Segment } from './segment';

/** Markdown segments on `#` headings; a preamble above the first one keeps a
 *  null locator because there is no heading to name. */
export function parseMarkdown(text: string): Segment[] {
  const segments: Segment[] = [];
  let locator: string | null = null;
  let buffer = '';

  const push = () => {
    if (buffer.trim()) segments.push({ text: buffer.trim(), locator });
    buffer = '';
  };

  for (const line of text.split('\n')) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      push();
      locator = `§${heading[1].trim()}`.slice(0, 64);
    }
    buffer += `${line}\n`;
  }
  push();

  return segments;
}

/** Plain text segments on blank lines, located by the line the paragraph starts on. */
export function parsePlainText(text: string): Segment[] {
  const segments: Segment[] = [];
  let startLine = 1;
  let buffer = '';
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    if (line.trim() === '') {
      if (buffer.trim()) segments.push({ text: buffer.trim(), locator: `line ${startLine}` });
      buffer = '';
      startLine = index + 2;
      return;
    }
    if (!buffer) startLine = index + 1;
    buffer += `${line}\n`;
  });
  if (buffer.trim()) segments.push({ text: buffer.trim(), locator: `line ${startLine}` });

  return segments;
}
