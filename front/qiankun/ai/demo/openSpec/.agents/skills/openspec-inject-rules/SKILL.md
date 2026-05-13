---
name: openspec-inject-rules
description: Inject project constitution and coding rules into OpenSpec workflow. Use before openspec-propose or openspec-apply to ensure compliance. Use when the user wants to apply project standards to OpenSpec artifacts, enforce conventions, or validate alignment with project constitution.
license: MIT
compatibility: Requires openspec CLI and .qoder/rules/1.md
metadata:
  author: openspec
  version: 1.0
---

penspec-inject-rules
description: Inject project constitution and coding rules into OpenSpec workflow. Use before openspec-propose or openspec-apply to ensure compliance. Use when the user wants to apply project standards to OpenSpec artifacts, enforce conventions, or validate alignment with project constitution.
license: MIT
compatibility: Requires openspec CLI and .qoder/rules/1.md
metadata:
  author: openspec
  version: "1.0"
---

Inject project constitution rules into the current OpenSpec workflow. This skill ensures that any OpenSpec artifact (proposal, design, specs, tasks) complies with the project's coding standards and design principles.

---

**Input**: The OpenSpec change name or artifact to validate. If omitted, applies to current conversation context.

**Steps**

1. **Read the project constitution**

   Read `.qoder/rules/1.md` — this contains the project constitution with:
   - Tech stack constraints
   - Design principles
   - CSS/JS conventions
   - Functional scope boundaries

2. **Identify the current OpenSpec context**

   Determine what's happening:
   - Is the user about to run `/opsx:propose`? → highlight scope constraints
   - Is the user about to run `/opsx:apply`? → highlight implementation rules
   - Is the user creating a design artifact? → highlight CSS/JS conventions
   - General inquiry? → list all applicable rules

3. **Inject relevant constraints**

   Based on context, surface the rules that matter:
   
   **For proposal/design**:
   - Feature scope: Hero + Footer only, no multi-page routing
   - No third-party libraries, no build tools
   - CSS: BEM naming, system font stack, ≤300ms transitions
   - JS: IIFE + strict mode, 500ms throttle, no global pollution

   **For implementation**:
   - Files: only modify `index.html`, `style.css`, `script.js`
   - CSS: use existing color system (#111, #666, #e0e0e0, #ccc)
   - JS: `var` not let/const, `'use strict'`, IIFE wrapper
   - Animations: `transition` only, no `@keyframes`
   - Responsive: mobile breakpoint 767px, stack layout

4. **Show compliance summary**

   Output a brief checklist:
   ```
   ## 项目宪法合规检查

   - [ ] 纯 HTML/CSS/JS，无外部依赖
   - [ ] CSS BEM 命名，系统字体栈
   - [ ] JS IIFE + strict mode
   - [ ] 动画 ≤ 300ms，CSS transition only
   - [ ] 功能范围：Hero + Footer，不越界
   - [ ] 响应式：767px 断点，移动端堆叠
   ```

5. **Proceed with OpenSpec operation**

   After injecting, the user can continue with:
   - `/opsx:propose <change-name>` — proposal will respect all constraints
   - `/opsx:apply` — implementation will follow coding conventions

**Guardrails**
- Always read `.qoder/rules/1.md` first — it's the single source of truth
- Don't repeat the full constitution — extract only what's relevant to the current step
- If a proposed change violates the constitution (e.g., adding a router library), flag it immediately
- The constitution evolves — if the user wants to change a rule, that's a separate conversation