import { TRANSLATE_MAX_TEXT_LENGTH } from "./messages";

const sentenceSegmenter = new Intl.Segmenter("nb", { granularity: "sentence" });

export function capTranslationSelection(source: string) {
  const trimmed = source.trim();
  const codePoints = Array.from(trimmed);
  if (codePoints.length <= TRANSLATE_MAX_TEXT_LENGTH) {
    return { text: trimmed, notice: null };
  }
  const sentences = Array.from(
    sentenceSegmenter.segment(trimmed),
    ({ segment }) => segment,
  );
  const total = sentences.length;
  let text = "";
  let translated = 0;
  for (const sentence of sentences) {
    if (
      Array.from(text + sentence.trimEnd()).length > TRANSLATE_MAX_TEXT_LENGTH
    )
      break;
    text += sentence;
    translated += 1;
  }
  if (translated > 0) {
    return {
      text: text.trimEnd(),
      notice:
        translated === total
          ? null
          : `Translated the first ${translated} of ${total} sentences.`,
    };
  }
  const prefix = codePoints.slice(0, TRANSLATE_MAX_TEXT_LENGTH).join("");
  const boundary = prefix.search(/\s+\S*$/u);
  const wordPrefix = boundary > 0 ? prefix.slice(0, boundary) : "";
  const textAtBoundary =
    Array.from(wordPrefix).length > TRANSLATE_MAX_TEXT_LENGTH / 2
      ? wordPrefix
      : prefix;
  return {
    text: textAtBoundary.trimEnd(),
    notice: "Translated the first part of the selection.",
  };
}
