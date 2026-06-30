/**
 * Разбиение текста на чанки для RAG.
 *
 * Идея: режем по абзацам/предложениям и склеиваем в куски примерно по
 * `chunkSize` символов с перекрытием `overlap`. Перекрытие нужно, чтобы
 * мысль, попавшая на границу двух чанков, не потерялась при поиске.
 *
 * Это намеренно простой, предсказуемый алгоритм (никаких токенайзеров) —
 * его легко чинить и настраивать под конкретного клиента.
 */
export function chunkText(
  text: string,
  chunkSize = 900,
  overlap = 150,
): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  // Кандидаты на границы — абзацы, затем предложения внутри длинных абзацев.
  const paragraphs = clean.split(/\n\s*\n/);
  const pieces: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= chunkSize) {
      pieces.push(p.trim());
    } else {
      // Длинный абзац дополнительно режем по предложениям.
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

  // Склейка мелких кусков в чанки ~chunkSize с перекрытием.
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if ((current + '\n\n' + piece).length > chunkSize && current) {
      chunks.push(current.trim());
      // Перекрытие: хвост предыдущего чанка переносим в начало следующего.
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${piece}`;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}
