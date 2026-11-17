const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeSourceRanges, normalizeSourceRanges } = require("../src/selection-range");

test("merges preview block ranges into a source selection", () => {
  assert.deepEqual(
    mergeSourceRanges([
      { startLine: 3, endLine: 4 },
      { startLine: 8, endLine: 10 },
    ]),
    { startLine: 3, endLine: 10 },
  );
});

test("ignores invalid preview ranges", () => {
  assert.deepEqual(
    mergeSourceRanges([
      { startLine: 0, endLine: 0 },
      { startLine: 5, endLine: 3 },
      { startLine: 7, endLine: 9 },
    ]),
    { startLine: 7, endLine: 9 },
  );
});

test("normalizes disjoint preview ranges without filling gaps", () => {
  assert.deepEqual(
    normalizeSourceRanges([
      { startLine: 8, endLine: 10 },
      { startLine: 3, endLine: 4 },
      { startLine: 4, endLine: 5 },
    ]),
    [
      { startLine: 3, endLine: 5 },
      { startLine: 8, endLine: 10 },
    ],
  );
});
