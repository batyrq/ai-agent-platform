/**
 * Splitting text into chunks for RAG.
 *
 * The idea: cut on paragraph/sentence boundaries and glue the pieces into
 * chunks of roughly `chunkSize` characters with an `overlap`. The overlap keeps
 * a thought that falls on the border of two chunks from getting lost in search.
 *
 * This is a deliberately simple, predictable algorithm (no tokenizers) —
 * easy to debug and to tune for a specific customer.
 */
export function chunkText(
  text: string,
  chunkSize = 900,
  overlap = 150,
): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  // Boundary candidates: paragraphs, then sentences inside long paragraphs.
  const paragraphs = clean.split(/\n\s*\n/);
  const pieces: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= chunkSize) {
      pieces.push(p.trim());
    } else {
      // A long paragraph is split further, by sentences.
      const sentences = p.split(/(?<=[.!?。])\s+/);
      let buf = '';
      for (const s of sentences) {
        if ((buf + ' ' + s).length > chunkSize && buf) {
          pieces.push(buf.trim());
          buf = s;
        } else {
          buf = buf ? `${buf} ${s}` : s;
        }
      }
      if (buf.trim()) pieces.push(buf.trim());
    }
  }

  // Merge the small pieces into ~chunkSize chunks with overlap.
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if ((current + '\n\n' + piece).length > chunkSize && current) {
      chunks.push(current.trim());
      // Overlap: the tail of the previous chunk starts the next one.
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${piece}`;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}
