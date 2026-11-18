/**
 * Splits Markdown or plain text into retrievable chunks. Headings are section
 * boundaries and travel with every chunk as a breadcrumb ("Normalisation › 3NF"),
 * because a paragraph that says "it removes transitive dependencies" is only
 * findable, and only citable, once it carries what "it" is.
 */

export interface Chunk {
  ordinal: number;
  heading: string | null;
  content: string;
}

const TARGET_CHARS = 1100;
// A short closing paragraph is repeated at the start of the next chunk so a
// definition and the sentence that applies it are never split apart.
const CARRY_MAX_CHARS = 320;

const splitLong = (paragraph: string): string[] => {
  const parts: string[] = [];
  let current = '';
  for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
    if (current && current.length + sentence.length + 1 > TARGET_CHARS) {
      parts.push(current);
      current = '';
    }
    if (sentence.length > TARGET_CHARS) {
      // A single unbroken run (a table row, a minified line): cut it by length.
      for (let i = 0; i < sentence.length; i += TARGET_CHARS) parts.push(sentence.slice(i, i + TARGET_CHARS));
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
};

export function chunkText(text: string): Chunk[] {
  const sections: { heading: string | null; lines: string[] }[] = [];
  const path: string[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };
  let inFence = false;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    // A "# comment" inside a code fence is code, not a heading.
    const match = inFence ? null : /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    sections.push(current);
    const depth = match[1].length;
    path.length = depth - 1;
    path[depth - 1] = match[2];
    current = { heading: Array.from(path).filter(Boolean).join(' › '), lines: [] };
  }
  sections.push(current);

  const chunks: Chunk[] = [];
  const emit = (heading: string | null, content: string) =>
    chunks.push({ ordinal: chunks.length, heading, content: content.trim() });

  for (const section of sections) {
    const paragraphs = section.lines
      .join('\n')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .flatMap((p) => (p.length > TARGET_CHARS ? splitLong(p) : [p]));

    let buffer: string[] = [];
    let size = 0;
    for (const paragraph of paragraphs) {
      if (buffer.length && size + paragraph.length > TARGET_CHARS) {
        emit(section.heading, buffer.join('\n\n'));
        const last = buffer[buffer.length - 1];
        buffer = last.length <= CARRY_MAX_CHARS ? [last] : [];
        size = buffer.reduce((n, p) => n + p.length, 0);
      }
      buffer.push(paragraph);
      size += paragraph.length;
    }
    if (buffer.length) emit(section.heading, buffer.join('\n\n'));
  }
  return chunks;
}
