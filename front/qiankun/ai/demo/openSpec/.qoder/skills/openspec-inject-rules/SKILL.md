---
name: openspec-inject-rules
description: OpenSpec workflow patch — inject flow-specific constraints (archive page index maintenance, violation guard). Use before apply/archive to ensure compliance with project constitution and OpenSpec conventions. NOT a replacement for .qoder/rules/ — this skill only handles OpenSpec-specific hooks.
license: MIT
compatibility: Requires openspec CLI and .qoder/rules/
metadata:
  author: openspec
  version: "1.2"
---

OpenSpec 流程补丁。在 OpenSpec 各关键节点注入**仅属于该流程的增强规则**。

---

**Input**: The OpenSpec change name or current operation type (`propose` / `apply` / `archive`). If omitted, auto-detect from context.

**Steps**

1. **Read project constitution** (single source of truth)

   Read `.qoder/rules/constitution.md` — this is where tech stack, CSS/JS conventions, design principles, and scope boundaries live. **Do not copy or repeat them here.**

2. **Identify the current OpenSpec context**

   Determine what's happening:
   - About to run `propose`? → scope check only
   - About to run `apply`? → reference constitution for implementation rules
   - Just ran `archive`? → trigger page index maintenance
   - General inquiry? → list applicable hooks

3. **Apply flow-specific patches**

   Based on context, execute the relevant hook:

   **Hook A: 违规拦截** (任意阶段)
   - Check if the artifact violates any rule in constitution.md
   - If violation detected (e.g., proposing a router library), flag immediately with:
     ```
     ⚠️ 宪法违规：[具体规则]
     受影响条款：constitution.md §[章节]
     建议：[修正方案] 或单独发起宪法变更讨论
     ```

   **Hook B: 归档后页面索引维护** (`archive` 后) — *核心钩子*

   This is the patch's primary value — it's an OpenSpec workflow requirement that doesn't exist in the project constitution:

   a. **Extract page identifier** from change name:
      - `home-add-banner-image` → `home`
      - `about-add-team` → `about`
      - `global-refactor` → skip (affects multiple pages)

   b. **Locate index file**: `openspec/pages/<page>/INDEX.md`

   c. **If exists, update it**:
      - Add row to "历史变更" table:
        ```
        | YYYY-MM-DD | <change-name> | <description> | `archive/YYYY-MM-DD-<change-name>/` |
        ```
      - If new features were added, update "当前功能列表" section

   d. **If doesn't exist**, ask user:
      > Page index for '<page>' doesn't exist. Would you like me to create it based on the archived change?

   e. **Show confirmation**:
      ```
      ## 页面索引已更新

      **页面**: <page>
      **索引文件**: openspec/pages/<page>/INDEX.md
      **更新内容**:
      - ✅ 添加历史变更: <change-name>
      - ✅ 更新功能列表: <feature-name> (if applicable)
      ```

4. **Show compliance summary**

   Output a brief checklist (only OpenSpec-specific items):
   ```
   ## OpenSpec 流程合规检查

   **提案阶段**：
   - [ ] 功能范围未越界（参照 constitution.md）

   **实施阶段**：
   - [ ] 编码规范符合 constitution.md 要求

   **归档阶段**（必须执行）：
   - [ ] 已更新页面索引 `openspec/pages/<page>/INDEX.md`
   - [ ] 已添加历史变更记录
   - [ ] 功能列表已同步（如有新增）
   ```

5. **Proceed with next operation**

   After patching, user can continue with:
   - `/opsx:propose <change-name>` — scope checked
   - `/opsx:apply` — constitution rules referenced
   - `/opsx:archive` — will auto-trigger Hook B on completion

**Guardrails**
- **Index maintenance is mandatory** — after every `archive`, page index MUST be updated (except `global-*` changes)
- **Create needs confirmation** — always ask user before creating new `pages/<page>/INDEX.md` files
