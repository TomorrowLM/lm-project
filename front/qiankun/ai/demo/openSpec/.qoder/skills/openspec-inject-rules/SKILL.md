---
name: openspec-inject-rules
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
   - **Change naming**: Must follow page-based convention `<page>-<action>-<feature>` (e.g., `home-add-banner`, `global-refactor`)

   **For implementation**:
   - Files: only modify files under `src/pages/<page>/` for the relevant page
   - CSS: use existing color system (#111, #666, #e0e0e0, #ccc)
   - JS: `var` not let/const, `'use strict'`, IIFE wrapper
   - Animations: `transition` only, no `@keyframes`
   - Responsive: mobile breakpoint 767px, stack layout

   **For archive** (after `/opsx:archive`):
   - **Must update page index** after archiving
   - Extract page identifier from change name (e.g., `home-add-banner` → `home`)
   - Update `openspec/pages/<page>/INDEX.md`:
     - Add entry to "历史变更" table (date, change name, description, archive path)
     - If new features added, update "当前功能列表" section
   - If page index doesn't exist, ask user: "Create page index for '<page>'?"
   - For `global-*` changes, skip page index update (affects multiple pages)

4. **Show compliance summary**

   Output a brief checklist:
   ```
   ## 项目宪法合规检查

   **提案/设计阶段**：
   - [ ] 纯 HTML/CSS/JS，无外部依赖
   - [ ] CSS BEM 命名，系统字体栈
   - [ ] JS IIFE + strict mode
   - [ ] 动画 ≤ 300ms，CSS transition only
   - [ ] 功能范围：Hero + Footer，不越界
   - [ ] 响应式：767px 断点，移动端堆叠
   - [ ] 变更命名：`<page>-<action>-<feature>` 格式

   **实施阶段**：
   - [ ] 仅修改 `src/pages/<page>/` 下的文件
   - [ ] 遵循颜色系统规范
   - [ ] 使用 `var` 而非 let/const

   **归档阶段**（重要）：
   - [ ] 归档完成后更新页面索引
   - [ ] 更新 `openspec/pages/<page>/INDEX.md`
   - [ ] 添加历史变更记录
   - [ ] 更新功能列表（如有新增）
   ```

5. **Proceed with OpenSpec operation**

   After injecting, the user can continue with:
   - `/opsx:propose <change-name>` — proposal will respect all constraints
   - `/opsx:apply` — implementation will follow coding conventions
   - `/opsx:archive` — archive will trigger page index maintenance

6. **Post-archive page index maintenance** (if applicable)

   When user runs `/opsx:archive` and archive completes:
   
   a. **Extract page identifier** from change name:
      - `home-add-banner-image` → `home`
      - `about-add-team` → `about`
      - `global-refactor` → skip (global change)
   
   b. **Check if page index exists**:
      ```bash
      # Check for page index file
      ls openspec/pages/<page>/INDEX.md
      ```
   
   c. **If exists, update it**:
      - Read the current `INDEX.md`
      - Add new row to "历史变更" table:
        ```
        | YYYY-MM-DD | <change-name> | <description> | `archive/YYYY-MM-DD-<change-name>/` |
        ```
      - If new features were added, add to "当前功能列表"
      - Save the file
   
   d. **If doesn't exist, ask user**:
      "Page index for '<page>' doesn't exist. Would you like me to create it based on the archived change?"
   
   e. **Show confirmation**:
      ```
      ## 页面索引已更新

      **页面**: <page>
      **索引文件**: openspec/pages/<page>/INDEX.md
      **更新内容**:
      - ✅ 添加历史变更: <change-name>
      - ✅ 更新功能列表: <feature-name> (if applicable)
      ```

**Guardrails**
- Always read `.qoder/rules/1.md` first — it's the single source of truth
- Don't repeat the full constitution — extract only what's relevant to the current step
- If a proposed change violates the constitution (e.g., adding a router library), flag it immediately
- The constitution evolves — if the user wants to change a rule, that's a separate conversation
- **Archive maintenance is mandatory** — always remind user to update page index after archiving
- **Never skip page index update** unless it's a `global-*` change
- **Always confirm before creating** new page index files
