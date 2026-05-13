# 项目概述

纯 HTML + CSS + JS 实现的极简手机官网项目，采用页面独立资源组织方案。

## 目录结构

```
src/
└── pages/
    └── home/              ← 首页
        ├── index.html
        ├── style.css
        ├── script.js
        └── images/
            ├── banner-1.svg
            ├── banner-2.svg
            ├── banner-3.svg
            └── banner.svg
```

## 开发预览

启动本地服务器：
```bash
cd src
python -m http.server 8080
```

访问首页：
```
http://localhost:8080/pages/home/
```

## 添加新页面

在 `src/pages/` 下创建新页面目录，复制 `home/` 作为模板：
```
src/pages/
├── home/      ← 首页
├── about/     ← 关于页（示例）
└── product/   ← 产品页（示例）
```

## 技术栈

- 纯 HTML + CSS + JS
- 零依赖、零框架、零构建工具
- BEM 命名规范
- Apple 风格极简设计

# OpenSpec

OpenSpec 是一个 **spec-driven 变更管理框架**，采用「先规格后实现」的工作流，确保每次变更都有完整的提案、设计、规格说明和任务追踪。

OpenSpec 支持**多模式**——内置默认模式，同时允许通过 Schema 扩展自定义模式。本项目即采用了基于默认模式的定制扩展。

## 核心概念

### OpenSpec架构

以下概念是 OpenSpec 的基础抽象，不因模式不同而改变：

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenSpec 架构（默认模式）                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    Schema 驱动    ┌──────────────────────┐   │
│   │  Config   │ ───────────────→ │      Workflow        │   │
│   │ config.   │                  │                      │   │
│   │ yaml      │   定义阶段、依赖   │  proposal → specs    │   │
│   └──────────┘    模板、指令       │  → design             │   │
│                       ↓           │  → tasks → apply     │   │
│   ┌──────────┐                ┌──────────────────────┐   │
│   │  Change   │ ←── 创建/执行 ──│    Artifact (产物)   │   │
│   │ 实例:     │                │                      │   │
│   │ add-login │    每个 artifact │  proposal.md         │   │
│   │          │    有独立的        │  specs/**/*.md       │   │
│   └──────────┘    schema + template│  design.md            │   │
│                       ↑           │  tasks.md            │   │
│   ┌──────────┐    归档后合并    └──────────────────────┘   │
│   │  Specs    │ ─────────────→                               │
│   │ (已批准)  │    delta 合并到基线                             │
│   └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
```

| 概念 | 说明 | 对应位置 |
|------|------|---------|
| **Schema (模式)** | 工作流的蓝图——定义有哪些阶段（artifacts）、依赖关系、输出模板、生成指令 | 默认: 内置 \| 自定义: `schemas/workflow/schema.yaml` |
| **Artifact (产物)** | 每个阶段产出的文档实体。由 `id` + `template` + `instruction` 决定形态 | `changes/<name>/` 目录下 |
| **Change (变更)** | 一次完整的变更实例——从 proposal 到归档的全生命周期容器 | `openspec/changes/<change-name>/` |
| **Specs (规格基线)** | 已批准的能力规格集合——归档时 delta specs **回写合并**到此，形成累积式项目规格基线 | `openspec/specs/<capability>/spec.md` |

#### Schema 结构

```yaml
# schema.yaml — 默认模式数据模型（5 个 artifact + apply）
name: spec-driven            # 默认模式名称
version: 1
description: "..."

artifacts:                  # 阶段定义列表（有序）
  - id: proposal            # 唯一标识符
    generates: proposal.md  # 输出文件名或通配符
    description: "..."       # 阶段描述
    template: proposal.md    # 使用的模板文件
    instruction: "..."       # AI 生成时的指令（prompt）
    requires: []             # 前置依赖（空 = 起点）

  - id: specs
    generates: specs/**/*.md
    requires: [proposal]

  - id: design
    generates: design.md
    requires: [proposal]

  - id: tasks
    generates: tasks.md
    requires: [specs, design]

apply:                       # 执行阶段（非 artifact）
  requires: [tasks]
  tracks: tasks.md
  instruction: "..."
```

#### Change 实例结构

```
changes/<change-name>/          ← 默认模式 Change 实例
├── .openspec.yaml              # 元数据：schema 引用、状态、时间戳
├── proposal.md                 # Artifact: 提案
├── design.md                   # Artifact: design（可选）
├── specs/
│   ├── <capability-a>/         # Artifact: spec（一个 capability 一个目录）
│   │   └── spec.md
│   └── <capability-b>/
│       └── spec.md
└── tasks.md                    # Artifact: tasks
```

### propose数据流

**默认模式数据流**：

```
                    ┌──────────────┐
                    │  1. Propose  │  openspec propose "名称"
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │2.Proposal│ │3. Specs  │ │4. Design │
       └────┬─────┘ └────┬─────┘ └────┬─────┘
            └────────────┼────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ 5. Tasks      │  解析式 checklist
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ 6. Apply      │  逐项实施 → 归档
                  └──────────────┘
```

**关键流转规则**（两种模式共享）：

1. **Proposal 是唯一入口** — 所有变更必须从 proposal 开始，定义 Why 和 Capabilities
2. **Capabilities 驱动 Specs** — proposal 中列出的每个 capability 生成对应的 spec 文件
3. **Delta 合并** — 归档时，新增/修改的 specs 以 **ADDED/MODIFIED/REMOVED** 格式回写到 `specs/` 基线
4. **基线累积** — `specs/` 目录是项目的"活规格文档"，随每次变更持续增长

### 扩展机制（三种层面）

OpenSpec 允许在三个层面进行扩展，**自定义模式本质上就是在 Schema 层面的扩展**：

#### 1. Schema 层面 — 自定义工作流

这是创建新模式的主要途径。修改或创建 `schemas/workflow/schema.yaml` 即可调整整个工作流：

```yaml
# 示例：为安全敏感项目添加 security-review 阶段
artifacts:
  - id: proposal
    requires: []
  - id: threat-model      # ← 新增 artifact
    generates: threat-model.md
    requires: [proposal]
  - id: security-review    # ← 新增 artifact
    generates: security-review.md
    requires: [threat-model, design]
  - id: tasks
    requires: [security-review, design, api, ui]  # ← 调整依赖
```

支持的操作：
- **添加 artifact**：在 `artifacts` 数组中插入新阶段（如本项目的 `api` + `ui`）
- **移除 artifact**：删除不需要的阶段（如纯前端项目去掉 `api`）
- **调整依赖**：修改 `requires` 数组改变阶段间的依赖图
- **替换模板**：修改 `template` 字段指向自定义模板

#### 2. Template 层面 — 自定义产物格式

每个 artifact 关联一个 Markdown 模板（位于 `schemas/workflow/templates/`）：

```
templates/
├── proposal.md    # 提案模板（两种模式共享）
├── spec.md        # 规格模板（两种模式共享）
├── design.md      # 设计模板（两种模式共享）
├── api.md         # API 模板（仅自定义模式使用）
├── ui.md          # UI 模板（仅自定义模式使用）
└── tasks.md       # 任务模板（两种模式共享）
```

#### 3. Config 层面 — 项目级配置

`openspec/config.yaml` 选择模式并注入上下文：

```yaml
# 选择使用哪种模式
schema: workflow           # ← 本项目使用自定义模式（指向 schema.yaml name）
# schema: spec-driven      # ← 使用 OpenSpec 内置默认模式

context: |
  技术栈: HTML + CSS + JS (零依赖)
  # AI 生成所有 artifacts 时会参考此上下文

rules:
  proposal:
    - 保持 500 字以内
  tasks:
    - 单个任务不超过 2 小时工作量
```

### 与项目的关系

OpenSpec 不是独立工具，而是**嵌入在项目中的变更管理协议**：

```
your-project/
├── src/                      # 项目源码
├── openspec/                 # ← OpenSpec 协议层（与源码同级）
│   ├── config.yaml           # ★ 模式选择（spec-driven 或 workflow）
│   ├── schemas/
│   │   └── workflow/
│   │       ├── schema.yaml   # ★ 自定义模式定义（7 个 artifact）
│   │       └── templates/    # 各阶段文档模板（含 api.md, ui.md）
│   ├── specs/                # 规格基线（已批准的能力规格）
│   ├── changes/              # 变更记录（活跃 + 已归档）
│   └── pages/                # 页面级规格（归档后维护）
└── .qoder/rules/             # 项目宪法（由 openspec-inject-rules 引用）
```

**关键设计原则**：

| 原则 | 说明 |
|------|------|
| **协议而非工具** | OpenSpec 是一组约定（schema + 模板 + 目录结构），不依赖特定 CLI 或平台 |
| **Markdown 原生** | 所有产物都是 `.md` 文件，可用任何编辑器/Git 工具查看 |
| **Git 友好** | 变更记录即 Git 历史，diff 即 review，branch 即 feature isolation |
| **AI 协作原生** | `instruction` 字段是给 AI 的 prompt，`context` 注入项目知识 |
| **渐进式采用** | 可以只使用 proposal + apply（跳过中间阶段），也可以全流程严格遵循 |

---

## 模式

### 总览

```
┌─────────────────────────────────────────────────────────────────┐
│                       OpenSpec 模式体系                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────┐                                       │
│   │  默认模式 (spec-driven)│ ← OpenSpec 内置，开箱即用            │
│   │  5 个 artifact       │                                      │
│   └──────────┬──────────┘                                       │
│              │ 继承 + 扩展                                        │
│              ▼                                                  │
│   ┌─────────────────────┐                                       │
│   │  自定义模式 (workflow)  │ ← 本项目 schemas/workflow/schema.yaml│
│   │  7 个 artifact       │ ← 在 default 基础上增加 api + ui     │
│   └─────────────────────┘                                       │
│                                                                 │
│   两者共享: Config / Change / Specs / 扩展机制                    │
└─────────────────────────────────────────────────────────────────┘
```

|                    | **默认模式 `spec-driven`**                      | **自定义模式 `workflow`**             |
| ------------------ | ----------------------------------------------- | ------------------------------------- |
| **Schema 来源**    | OpenSpec 内置                                   | 本项目 `schemas/workflow/schema.yaml` |
| **Config 写法**    | `schema: spec-driven`                           | `schema: workflow`                    |
| **Artifacts 数量** | 5                                               | 7                                     |
| **Artifact 列表**  | `proposal`, `specs`, `design`, `tasks`, `apply` | 在 default 基础上**追加** `api`, `ui` |
| **适用场景**       | 无前后端分离的小型变更、纯逻辑修改              | 涉及 API 接口或 UI 改动的全栈变更     |
| **可否进一步扩展** | 可（创建新 schema）                             | 可（直接编辑 schema.yaml）            |

### 默认模式 `spec-driven`

这是 OpenSpec **内置的开箱即用模式**，适用于大多数场景。

#### 工作流

**阶段概览**（6 步）：

#### Artifacts

| 阶段 | ID | 输出文件 | 说明 |
|------|-----|---------|------|
| **Proposal** | `proposal` | `proposal.md` | 变更提案 — Why / What / Impact / Capabilities |
| **Specs** | `specs` | `specs/**/*.md` | 规格 — 每个 Capability 一个文件，Requirement + Scenario |
| **Design** | `design` | `design.md` | 技术设计 — 架构决策、风险评估、迁移计划 |
| **Tasks** | `tasks` | `tasks.md` | 实施清单 — `- [ ] X.Y` checkbox 格式 |
| **Apply** | `apply` | (执行) | 按任务逐项实施，完成后归档 |

#### 依赖关系

```
proposal ──┬── specs  ──┐
           └── design ─┼── tasks ── apply (归档)
```

- **proposal** 无前置依赖，起点
- **specs / design** 可并行，均依赖 proposal
- **tasks** 依赖 specs + design 完成
- **适用场景**：纯后端逻辑变更、数据库迁移、配置调整等不需要单独定义 API/UI 的情况

---

### 自定义模式 `workflow`（本项目使用）

本项目通过 `schemas/workflow/schema.yaml` 在默认模式基础上**扩展了两个 artifact**：`api` 和 `ui`。这使得工作流能更好地支撑涉及接口契约和界面设计的变更。

#### 与默认模式的差异

```
默认模式 (spec-driven)          自定义模式 (workflow)
═══════════════════            ══════════════════════
proposal                        proposal  （不变）
  ├─ specs                       ├─ specs   （不变）
  └─ design                      ├─ design  （不变）
                                 ├─ ★ api     ← 新增
                                 └─ ★ ui      ← 新增
                                       │
tasks 依赖: [specs, design]      tasks 依赖: [specs, design, api, ui]
                                    ↑
                              并行屏障扩大
```

#### Schema 结构（扩展部分）

在默认模式 5 个 artifact 基础上**追加** `api` + `ui`：

```yaml
# schemas/workflow/schema.yaml — 自定义模式（7 个 artifact）
name: workflow

artifacts:
  - id: proposal
    requires: []

  - id: specs
    requires: [proposal]

  - id: design
    requires: [proposal]

  # ↓ 自定义模式追加的 artifact
  - id: api                  # ★ 新增
    generates: api.md
    requires: [proposal]

  - id: ui                   # ★ 新增
    generates: ui.md
    requires: [proposal]

  - id: tasks
    requires: [specs, design, api, ui]   # ★ 依赖扩大

apply:
  requires: [tasks]
```

#### Change 实例结构（含扩展 artifact）

```
changes/<change-name>/          ← 自定义模式 Change 实例
├── .openspec.yaml              # 元数据：schema 引用、状态、时间戳
├── proposal.md                 # Artifact: proposal
├── design.md                   # Artifact: design（可选）
├── api.md                      # ★ Artifact: api（仅自定义模式）
├── ui.md                       # ★ Artifact: ui（仅自定义模式）
├── specs/
│   ├── <capability-a>/
│   │   └── spec.md
│   └── <capability-b>/
│       └── spec.md
└── tasks.md                    # Artifact: tasks
```

#### 扩展原因

| 扩展 artifact | 解决的问题 |
|--------------|-----------|
| **api** | 将接口契约从前端/后端设计文档中**抽离为独立 artifact**，使 API 设计可以与 implementation design 并行评审，且在 tasks 阶段有明确的接口参照 |
| **ui** | 将 UI/UX 设计从 design 中**分离出来**，让交互设计师和开发者有独立的交付物，且响应式、无障碍等专项需求不会淹没在架构设计中 |

#### 工作流

**工作流**（8 步，在默认模式 6 步基础上追加 API + UI 阶段）：

```
                    ┌──────────────┐
                    │  1. Propose   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┬────────┐
          ▼                ▼                ▼       ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐ ┌──────────┐
   │2.Proposal│    │3. Specs  │    │4. Design │ │5. API    │
   └──────────┘    └──────────┘    └──────────┘ │6. UI    │
                                               └────┬─────┘
          ┌──────────────────────────────────────┼────────┘
          └──────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ 7. Tasks      │  依赖全部 5 个设计阶段
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ 8. Apply      │  逐项实施 → 归档
                  └──────────────┘
```

#### Artifacts

| 阶段 | ID | 来源 | 输出文件 | 说明 |
|------|-----|------|---------|------|
| **Proposal** | `proposal` | 共享 | `proposal.md` | 变更提案 — Why / What / Impact / Capabilities |
| **Specs** | `specs` | 共享 | `specs/**/*.md` | 规格 — 每个 Capability 一个文件，Requirement + Scenario |
| **Design** | `design` | 共享 | `design.md` | 技术设计 — 架构决策、风险评估、迁移计划 |
| **API** | `api` | **扩展** | `api.md` | 接口设计 — 端点、请求/响应格式、认证、错误处理 |
| **UI** | `ui` | **扩展** | `ui.md` | UI 设计 — 布局、组件、交互流程、响应式、无障碍 |
| **Tasks** | `tasks` | 共享 | `tasks.md` | 实施清单 — `- [ ] X.Y` checkbox 格式 |
| **Apply** | `apply` | 共享 | (执行) | 按任务逐项实施，完成后归档 |

#### 依赖关系

```
proposal ──┬── specs   ──┐
           ├── design  ──┼── tasks ── apply (归档)
           ├──★ api    ──┘
           └──★ ui    ──┘
```

- **proposal** 无前置依赖，起点
- **specs / design / api / ui** 四者可并行，均依赖 proposal
- **tasks** 依赖上述**全部 4 个**设计阶段完成
- **适用场景**：涉及 API 接口变更、UI 改版、前后端联动的全栈变更

---

## 四、流程补丁 — openspec-inject-rules

### 补丁覆盖的流程钩子

| 钩子 | 触发时机 | 补丁行为 | 对应宪法章节 |
|------|---------|---------|-------------|
| **归档后索引维护** | `archive` 后 | 自动提取页面标识，更新 `pages/<page>/INDEX.md` 的历史变更表和功能列表 | （宪法无此规则，纯 OpenSpec 流程逻辑） |
| **违规拦截** | 任意阶段 | 检测产物是否违反宪法，若越界则标记并拒绝 | 全部章节 |

其中**归档后的页面索引维护**是该补丁的核心价值——这是项目宪法中不存在、但 OpenSpec 流程必须的闭环操作：

```
archive 完成
     │
     ▼
┌─────────────────────────────────────┐
│  页面索引维护（openspec-inject-rules │
│                                     │
│  1. 提取页面标识                     │
│     home-add-banner → page = home   │
│     global-refactor → 跳过（全局）    │
│                                     │
│  2. 定位索引文件                     │
│     openspec/pages/<page>/INDEX.md   │
│                                     │
│  3. 更新内容                        │
│     · 历史变更表 +1 行               │
│     · 当前功能列表（如有新增）        │
│                                     │
│  4. 索引不存在？→ 询问用户是否创建    │
└─────────────────────────────────────┘
```

### 使用方式

在以下命令**之前**调用补丁：

```bash
# 发起提案前 — 范围边界检查
/opsx:propose "home-add-banner-image"

# 实施前 — 注入编码规范引用（指向 .qoder/rules/）
/opsx:apply "home-add-banner-image"

# 归档后 — 触发页面索引维护
/opsx:archive "home-add-banner-image"
```

### Guardrails

- **强制索引维护**：归档后必须更新页面索引（`global-*` 变更除外），不可跳过
- **创建需确认**：新建 `pages/<page>/INDEX.md` 前必须征得用户同意

---

## 五、目录结构

```
openspec/
├── config.yaml              # ★ 模式选择（spec-driven 或 workspace）
├── schemas/
│   └── workflow/
│       ├── schema.yaml      # ★ 自定义模式定义（7 个 artifact: +api +ui）
│       └── templates/       # 各阶段文档模板
│           ├── proposal.md
│           ├── spec.md
│           ├── design.md
│           ├── api.md       # ← 仅自定义模式
│           ├── ui.md        # ← 仅自定义模式
│           └── tasks.md
├── specs/                   # 已批准的规格文档（基线）
│   ├── hero-section/
│   │   └── spec.md
│   ├── banner-scroll/
│   │   └── spec.md
│   └── ...
├── changes/                 # 变更记录
│   ├── <change-name>/       # 活跃变更（进行中）
│   │   ├── .openspec.yaml
│   │   ├── proposal.md
│   │   ├── design.md
│   │   ├── api.md           # （仅自定义模式，可选）
│   │   ├── ui.md            # （仅自定义模式，可选）
│   │   ├── specs/
│   │   │   └── <capability>/spec.md
│   │   └── tasks.md
│   └── archive/             # 已完成的归档变更
│       └── YYYY-MM-DD-<name>/
└── pages/                   # 页面级规格（归档后由补丁维护）
    └── <page>/
        └── INDEX.md
```

---

## 六、详细规范

以下按阶段列出各 artifact 的详细编写规范。标注「★」表示**仅自定义模式**拥有。

### 1. Proposal (提案) — 共享

**目的**: 回答「为什么需要这个变更」。

必需章节：
- **Why**: 1-2 句话描述问题或机会，为什么现在要做
- **What Changes**: 具体变更列表，**BREAKING** 标记破坏性变更
- **Capabilities**: 能力清单（决定后续 specs 数量）
  - **New Capabilities**: 新增能力 → 每个 kebab-case 命名对应一个新 spec 文件
  - **Modified Capabilities**: 修改已有能力 → 需要 delta spec 文件
- **Impact**: 影响范围 — 受影响的代码、API、依赖、系统

> ⚠️ Capabilities 是 proposal 和 specs 的桥梁。填写前必须调研已有的 `openspec/specs/`。

### 2. Specs (规格) — 共享

**目的**: 定义「系统应该做什么」，每个 Capability 一个独立文件。

**文件位置**: `changes/<name>/specs/<capability>/spec.md`

需求格式：
```markdown
### Requirement: 用户可以导出数据
系统 SHALL 允许用户导出 CSV 格式的数据。

#### Scenario: 成功导出
- **WHEN** 用户点击"导出"按钮
- **THEN** 系统下载包含所有用户数据的 CSV 文件
```

**Delta 操作**（修改已有能力时使用）：

| 操作类型 | 标题 | 说明 |
|---------|------|------|
| 新增 | `## ADDED Requirements` | 全新能力 |
| 修改 | `## MODIFIED Requirements` | 行为变更，必须包含**完整更新后的内容** |
| 移除 | `## REMOVED Requirements` | 废弃功能，需提供 Reason + Migration |
| 重命名 | `## RENAMED Requirements` | 仅名称变更，用 FROM:/TO: 格式 |

**关键约束**:
- 使用 SHALL/MUST 表达规范性要求（避免 should/may）
- Scenario 必须使用 **4 个 `#`** (`####`)，否则 apply 阶段会静默失败
- 每个 Requirement 至少有一个 Scenario

### 3. Design (技术设计) — 共享

**何时需要**:
- 跨模块/跨服务的架构性变更
- 引入新的外部依赖或数据模型重大变更
- 安全、性能、迁移复杂度较高
- 存在歧义需要在编码前做出技术决策

**章节**:
- **Context**: 背景、现状、限制、利益相关方
- **Goals / Non-Goals**: 目标和明确排除的范围
- **Decisions**: 关键技术选型及理由（为什么选 X 而非 Y），包含备选方案
- **Risks / Trade-offs**: 已知风险与缓解措施 `[Risk] → Mitigation`
- **Migration Plan**: 部署步骤、回滚策略
- **Open Questions**: 待决事项

### ★ 4. API (接口设计) — 仅自定义模式

**何时需要**:
- 新建或修改 API 端点
- 变更请求/响应格式、认证机制、错误处理方式
- API 版本升级或破坏性变更

**章节**:
- **Overview**: API 概述和用途
- **Endpoints**: HTTP 方法 + 路径列表
- **Request/Response**: 请求头、查询参数、路径参数、请求体；状态码、响应头、响应体
- **Authentication**: 认证要求
- **Error Handling**: 统一错误响应格式
- **Examples**: 示例请求和响应

### ★ 5. UI (界面设计) — 仅自定义模式

**何时需要**:
- 新页面、组件或重大 UI 改动
- 布局、导航、用户流程变更
- 响应式设计或无障碍要求

**章节**:
- **Overview**: UI 变更的目的和范围
- **Layout**: 页面/组件布局结构（线框图）
- **Components**: UI 组件及其状态
- **User Flow**: 分步交互流程
- **Responsive Behavior**: 断点适配行为
- **Accessibility**: ARIA 标签、键盘导航、对比度
- **Design Tokens**: 颜色、字体、间距值

### 6. Tasks (任务清单) — 共享

**格式要求**（严格）:
```markdown
## 1. Setup

- [ ] 1.1 创建新模块结构
- [ ] 1.2 添加 package.json 依赖

## 2. Core Implementation

- [ ] 2.1 实现数据导出函数
- [ ] 2.2 添加 CSV 格式化工具
```

**关键规则**:
- 必须 `- [ ] X.Y 描述` 格式（apply 阶段解析此格式来追踪进度）
- 任务粒度：单次会话可完成的大小
- 按依赖顺序排列（先做的排前面）

> **注意**：在自定义模式下，tasks 依赖 specs + design + **api** + **ui** 四个阶段全部完成后才能生成。

### 7. Apply (实施) — 共享

- 按 `tasks.md` 中的 checklist 逐项执行
- 完成一项标记一项 `- [x]`
- 遇到阻塞或需澄清时暂停并沟通
- 全部完成后**归档**到 `openspec/changes/archive/YYYY-MM-DD-<name>/`
- 归档后触发 **流程补丁**的页面索引维护

---

## 七、CLI 用法

```bash
# 全局安装 OpenSpec
npm install -g @fission-ai/openspec@latest

# 安装 find-skills
npx skills add https://github.com/vercel-labs/skills --skill find-skills

# 启动变更流程（自动读取 config.yaml 选择的模式）
openspec propose "添加用户导出功能"
openspec apply "添加用户导出功能"
```

## 八、配置文件

`openspec/config.yaml`:
```yaml
# ★ 本项目使用自定义模式（指向 schemas/workflow/schema.yaml 中的 name）
schema: workflow

# 项目上下文（可选）— AI 创建产物时会参考
# context: |
#   技术栈: HTML, CSS, JS (零依赖)
#   BEM 命名规范, Apple 风格极简设计

# 各产物的自定义规则（可选）
# rules:
#   proposal: 保持 500 字以内
#   tasks: 单个任务不超过 2 小时工作量
```

## 九、当前项目规格索引

已批准的规格文档位于 `openspec/specs/`：

| 规格 | 说明 |
|------|------|
| `hero-section` | Hero 区域规格 |
| `banner-scroll` | Banner 滚轮切换规格 |
| `banner-image` | Banner 图片资源规格 |
| `api-integration` | API 集成规格 |
| `dynamic-data-rendering` | 动态数据渲染规格 |
