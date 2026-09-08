export function selectionTextOffset(
  container: Node,
  range: Range,
): number | undefined {
  if (!container.contains(range.startContainer)) return undefined;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(range.startContainer, range.startOffset);
  return prefix.toString().length;
}

export function containingSentence(
  text: string,
  selected: string,
  selectedStart = text.indexOf(selected),
): string {
  const index = selectedStart;
  if (index < 0) return selected;
  const before = text.slice(0, index);
  const boundary = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf('…'),
  );
  const afterStart = index + selected.length;
  const after = text.slice(afterStart);
  const endings = ['.', '!', '?', '…']
    .map((mark) => after.indexOf(mark))
    .filter((position) => position >= 0);
  const end =
    endings.length > 0 ? afterStart + Math.min(...endings) + 1 : text.length;
  return text.slice(boundary + 1, end).trim() || selected;
}
