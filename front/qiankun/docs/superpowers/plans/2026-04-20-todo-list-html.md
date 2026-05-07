# Todo List HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有的 `html-demo/preview/todo-list.html` 重构成一个手机 App 风格的 Todo List 页面，保留新增、删除、完成三项核心交互。

**Architecture:** 继续使用单文件静态页面，不拆分成多个模块。HTML 负责结构，CSS 负责移动 App 风的视觉层次，少量原生 JavaScript 负责状态、渲染和交互。页面只依赖浏览器原生能力，不引入框架或构建工具。

**Tech Stack:** HTML, CSS, Vanilla JavaScript, `localStorage`（若保留本地数据）

---

### Task 1: Reframe the page shell into a mobile-app layout

**Files:**
- Modify: `html-demo/preview/todo-list.html:1-230`

- [ ] **Step 1: Write the failing test**

Because this is a static HTML page, the first check is visual + DOM structure review rather than a unit test. Open the current page and confirm it still looks like a desktop card with a wide layout, not a phone-shaped app shell.

Expected baseline: the current page renders a centered wide card with a light glassmorphism background.

- [ ] **Step 2: Run test to verify it fails**

Run: open `html-demo/preview/todo-list.html` in a browser

Expected: the page does **not** yet match a phone App layout. The content is still wide, the hero section dominates the page, and the input/list area does not feel like a mobile app screen.

- [ ] **Step 3: Write minimal implementation**

Replace the wide-centered card with a phone-like shell:

```html
<main class="app-shell">
  <header class="app-header">
    <div>
      <p class="eyebrow">Today</p>
      <h1>Todo List</h1>
    </div>
    <div class="stats-pill" id="stats"></div>
  </header>

  <section class="composer">
    <input id="todoInput" type="text" placeholder="添加一个新任务" />
    <button class="primary-btn" id="addBtn">添加</button>
  </section>

  <section class="board">
    <div class="toolbar">
      <div class="filters" id="filters">
        <button class="filter-btn active" data-filter="all">全部</button>
        <button class="filter-btn" data-filter="active">进行中</button>
        <button class="filter-btn" data-filter="done">已完成</button>
      </div>
    </div>
    <ul id="todoList"></ul>
    <div class="empty" id="emptyState" hidden>还没有待办事项，先添加一条吧。</div>
  </section>
</main>
```

Update the CSS so the page reads as a compact mobile app:

```css
body {
  margin: 0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e8eefc;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.35), transparent 34%),
    radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.2), transparent 28%),
    linear-gradient(180deg, #0f172a 0%, #111827 100%);
  display: grid;
  place-items: center;
  padding: 16px;
}

.app-shell {
  width: min(430px, 100%);
  min-height: min(860px, calc(100vh - 32px));
  border-radius: 32px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 30px 80px rgba(2, 6, 23, 0.4);
  padding: 20px;
  backdrop-filter: blur(18px);
}

.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #93c5fd;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.app-header h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1;
}

.stats-pill {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 13px;
}
```

Adjust the responsive block so the shell fills the viewport nicely on phones while staying centered on desktop.

- [ ] **Step 4: Run test to verify it passes**

Run: open the page in a browser and inspect the layout at a mobile viewport width.

Expected: the page now reads like a compact phone app, with a narrow shell, stronger contrast, rounded container, and clearer hierarchy.

- [ ] **Step 5: Commit**

```bash
git add html-demo/preview/todo-list.html
git commit -m "feat: restyle todo list as mobile app"
```

### Task 2: Restyle the task composer and task list for touch-first interaction

**Files:**
- Modify: `html-demo/preview/todo-list.html:67-350`

- [ ] **Step 1: Write the failing test**

Open the page and check whether the task input, add button, and list items feel like touch targets or like generic form controls.

Expected baseline: the current controls are still light, flat, and desktop-oriented.

- [ ] **Step 2: Run test to verify it fails**

Run: open `html-demo/preview/todo-list.html` and inspect the composer/list styling.

Expected: controls are not yet deeply tactile, and the list rows do not read like app cards.

- [ ] **Step 3: Write minimal implementation**

Give the composer a stacked mobile layout and make each todo row feel like a small app card:

```css
.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 18px;
}

.composer input {
  height: 54px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.06);
  color: #f8fafc;
  font-size: 16px;
  outline: none;
}

.composer input::placeholder {
  color: #94a3b8;
}

.primary-btn {
  height: 54px;
  padding: 0 18px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.28);
}

.board {
  display: grid;
  gap: 14px;
}

.item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.check {
  width: 22px;
  height: 22px;
  accent-color: #22c55e;
}

.content {
  color: #e2e8f0;
  line-height: 1.5;
}

.item.done .content {
  color: #94a3b8;
  text-decoration: line-through;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.12);
  color: #fda4af;
}
```

Make the filter buttons more compact and pill-like, and keep the empty state visually consistent with the dark shell.

- [ ] **Step 4: Run test to verify it passes**

Run: open the page and add a few items, then mark one done and delete one.

Expected: the composer looks touch-friendly, rows look like app cards, and the completed state plus delete action remain obvious.

- [ ] **Step 5: Commit**

```bash
git add html-demo/preview/todo-list.html
git commit -m "style: make todo list feel like a mobile app"
```

### Task 3: Keep the existing interactions working after the restyle

**Files:**
- Modify: `html-demo/preview/todo-list.html:233-347`

- [ ] **Step 1: Write the failing test**

Open the page and verify the three current behaviors still need to work after the layout change:

```text
1. Add a task with Enter and the Add button.
2. Toggle a task complete/incomplete.
3. Delete a task.
```

Expected baseline: the current script already provides these behaviors, but the new styling must not break them.

- [ ] **Step 2: Run test to verify it fails**

Run: interact with the page after applying the new layout.

Expected: if any selectors changed, event handlers may fail. The check is to confirm the updated DOM still matches the existing IDs and data attributes.

- [ ] **Step 3: Write minimal implementation**

Keep the existing IDs and data attributes unchanged:

```html
<input id="todoInput" type="text" />
<button id="addBtn">添加</button>
<div class="filters" id="filters">...</div>
<ul id="todoList"></ul>
<div class="empty" id="emptyState" hidden></div>
```

Keep the existing JavaScript data flow intact:

```javascript
addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addTodo();
});

filters.addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) return;
  currentFilter = button.dataset.filter;
  render();
});

todoList.addEventListener('click', (event) => {
  const deleteBtn = event.target.closest('[data-delete]');
  if (deleteBtn) deleteTodo(Number(deleteBtn.dataset.delete));
});

todoList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-id]');
  if (checkbox) toggleTodo(Number(checkbox.dataset.id));
});
```

If the page is meant to stay visually polished, keep the `escapeHtml` guard exactly as-is so typed task text cannot inject HTML.

- [ ] **Step 4: Run test to verify it passes**

Run: add a task, complete it, delete it, and filter the list.

Expected: all interactions still work after the redesign, and typed text is rendered safely.

- [ ] **Step 5: Commit**

```bash
git add html-demo/preview/todo-list.html
git commit -m "fix: preserve todo list interactions during redesign"
```

### Task 4: Verify the final page in browser and save the outcome

**Files:**
- Modify: none

- [ ] **Step 1: Run a final browser check**

Open `html-demo/preview/todo-list.html` in a browser.

Expected: the page looks like a compact mobile app, with a strong top section, a touch-friendly composer, card-like todo rows, and usable empty-state/filters.

- [ ] **Step 2: Check responsive behavior**

Resize the browser to a narrow phone width and then to a desktop width.

Expected: the shell stays readable on both sizes, and the main interactions remain accessible without horizontal scrolling.

- [ ] **Step 3: Confirm no additional files need updating**

Expected: this feature stays self-contained in `html-demo/preview/todo-list.html`; no docs or build scripts are needed.

- [ ] **Step 4: Report completion**

Summarize the final file changed, the behaviors preserved, and any remaining visual trade-offs.
