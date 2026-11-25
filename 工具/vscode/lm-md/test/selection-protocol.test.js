const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePreviewSelection } = require("../src/preview-panel");

test("normalizes a preview selection message", () => {
  assert.deepEqual(
    normalizePreviewSelection({
      type: "previewSelection",
      text: "正文",
      startLine: 3,
      endLine: 4,
    }),
    {
      text: "正文",
      ranges: [{ startLine: 3, endLine: 4 }],
      startLine: 3,
      endLine: 4,
    },
  );
});

test("preserves each disjoint preview selection as its own source range", () => {
  assert.deepEqual(
    normalizePreviewSelection({
      type: "previewSelection",
      text: "第一段\n第二段",
      ranges: [
        { startLine: 12, endLine: 13 },
        { startLine: 3, endLine: 4 },
      ],
      startLine: 3,
      endLine: 13,
    }),
    {
      text: "第一段\n第二段",
      ranges: [
        { startLine: 3, endLine: 4 },
        { startLine: 12, endLine: 13 },
      ],
      startLine: 3,
      endLine: 13,
    },
  );
});

test("rejects empty or reversed preview selections", () => {
  assert.equal(
    normalizePreviewSelection({
      type: "previewSelection",
      text: "",
      startLine: 5,
      endLine: 4,
    }),
    null,
  );
});
