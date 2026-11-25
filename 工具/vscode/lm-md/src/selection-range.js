function normalizeSourceRanges(ranges) {
  const valid = (Array.isArray(ranges) ? ranges : [])
    .filter((range) => range && Number.isInteger(range.startLine))
    .filter((range) => Number.isInteger(range.endLine))
    .filter((range) => range.startLine >= 1 && range.endLine >= range.startLine)
    .map((range) => ({
      startLine: range.startLine,
      endLine: range.endLine,
    }))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);

  const normalized = [];
  for (const range of valid) {
    const previous = normalized.at(-1);
    if (previous && range.startLine <= previous.endLine) {
      previous.endLine = Math.max(previous.endLine, range.endLine);
    } else {
      normalized.push(range);
    }
  }
  return normalized;
}

function mergeSourceRanges(ranges) {
  const normalized = normalizeSourceRanges(ranges);
  if (normalized.length === 0) return null;

  return {
    startLine: normalized[0].startLine,
    endLine: normalized.at(-1).endLine,
  };
}

module.exports = { mergeSourceRanges, normalizeSourceRanges };
