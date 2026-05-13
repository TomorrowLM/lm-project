# Agent Migration Tool — 设计规格

> 日期: 2026-05-13
> 状态: **已实现** ✅
> 方案: Adapter 驱动 (Rule/Skill) + 模板驱动 (MCP)
> 最后更新: 2026-05-13

## 1. 目标

构建一个 Node.js CLI 工具，从 `.qoder` 源目录解析 **Rule / Skill / MCP** 配置，自动迁移至目标 IDE/Agent 平台。

**支持的目标平台**: Cursor, Windsurf, Claude Code, GitHub Copilot, Cline, CodeBuddy (AGENTS.md)

## 2. 架构概览

```
.qoder/sources → parser.js(统一AST) → [rule/skill adapters 或 mcp模板] → 目标文件
                       ↑                                    ↑
              提取 frontmatter + body              根据 --target 选择输出格式

IDE 检测: 环境变量/进程/文件嗅探 (--target 可覆盖)
```

## 3. 目录结构

```
script/agent-migration/
├── index.js                # 主入口 (CLI)
├── ide-detector.js         # IDE 自动识别
├── parser.js               # .qoder 统一解析器
│
├── rule/
│   ├── index.js            # rule 迁移入口
│   └── adapters.js         # 各平台 frontmatter 格式适配器
│
├── skill/
│   ├── index.js            # skill 迁移入口
│   └── adapters.js         # 各平台路径+frontmatter 适配
│
└── mcp/
    ├── index.js            # mcp 迁移入口 + 渲染逻辑
    └── template/
        ├── cursor.json     # .cursor/mcp.json 模板
        ├── windsurf.json   # .windsurf/mcp.json 模板
        ├── claude.json     # ~/.claude/mcp_servers.json 模板
        └── codebuddy.json  # codebuddy.json 模板
```

## 4. CLI 接口

```bash
node index.js [options]

选项:
  --target <list>    目标平台，逗号分隔 (cursor,windsurf,claude,copilot,cline,agents,codebuddy)
  --only <list>      仅迁移的类型: rule,skill,mcp
  --src <path>       源项目根目录 (默认: ./)
  --out <path>       输出目录 (默认: 覆盖源项目)
  --dry-run          预览模式，不写文件
  -h, --help         帮助信息
```

示例:
```bash
node index.js                              # 自动检测 IDE，迁移全部
node index.js --target cursor              # 迁移到 Cursor
node index.js --target cursor,claude --only rule,skill  # 多目标+类型筛选
node index.js --dry-run                    # 预览不写入
```

## 5. IDE 自动检测 (ide-detector.js)

检测优先级: `--target 参数 > 进程/环境变量 > 已有配置文件 > fallback(codebuddy)`

| 指标 | Cursor | Windsurf | Claude Code | VS Code+Copilot | Cline | CodeBuddy |
|------|--------|----------|-------------|-----------------|-------|-----------|
| 进程名含 `Cursor` | ✓ | — | — | — | — | — |
| 进程名含 `Windsurf` | — | ✓ | — | — | — | — |
| 进程名含 `claude` | — | — | ✓ | — | — | — |
| `TERM_PROGRAM=vscode` | — | — | — | ✓ | — | — |
| `VSCODE_*` 存在 | — | — | — | ✓ | — | — |
| 环境变量 `CLINE_` | — | — | — | — | ✓ | — |
| 环境变量 `CODEBUDDY` | — | — | — | — | — | ✓ |
| 文件 `.cursor/rules/` 存在 | ✓ | — | — | — | — | — |
| 文件 `.windsurf/` 存在 | — | ✓ | — | — | — | — |

## 6. Parser 输入/输出

### 输入 (.qoder 目录)

**Rules**: `.qoder/rules/*.md`
```yaml
---
trigger: always_on
---
# 标题
内容...
```

**Skills**: `.qoder/skills/*/SKILL.md`
```yaml
---
name: skill-name
description: 描述文字
license: MIT
compatibility: Requires xxx
metadata:
  author: xxx
  version: "1.0"
---
技能内容...
```

**Commands**: `.qoder/commands/*/*.md` (结构与 Skills 类似)

### 输出 (统一 AST)

```javascript
{
  rules: [
    {
      name: "1",
      sourcePath: ".qoder/rules/1.md",
      frontmatter: { trigger: "always_on" },
      body: "# 项目宪法..."    // 纯 Markdown
    }
  ],
  skills: [
    {
      name: "openspec-propose",
      sourcePath: ".qoder/skills/openspec-propose/SKILL.md",
      frontmatter: { name, description, license, compatibility, metadata },
      body: "Propose a new change..."
    }
  ],
  commands: [ /* 同 skills 结构 */ ]
}
```

## 7. Rule 迁移策略

### 输出路径映射

| 目标 | 输出路径 | 格式 | 策略 |
|------|---------|------|------|
| **cursor** | `.cursor/rules/<name>.mdc` | MDC frontmatter | 每条规则独立文件 |
| **windsurf** | `.windsurf/rules/<name>.md` | Markdown | 独立文件 |
| **claude** | `CLAUDE.md` | 纯 Markdown | 合并所有规则 |
| **copilot** | `.github/copilot-instructions.md` | 纯 Markdown | 合并所有规则 |
| **cline** | `.clinerules/project.md` | 纯 Markdown | 合并所有规则 |
| **agents** | `AGENTS.md` | 纯 Markdown | 合并所有规则 |
| **codebuddy** | `.codebuddy/rules/<name>.md` | Markdown | 每条规则独立文件 |

### Adapter 逻辑

- **cursor**: `trigger: always_on` → MDC 的 `always_on: true` + `description` 字段
- **windsurf/codebuddy/agents/copilot/cline**: 原样输出 body
- **claude/copilot/cline/agents**: 多条规则用 `\n\n---\n\n` 分隔合并
- **codebuddy**: 独立模式，每条规则输出到 `.codebuddy/rules/<name>.md`（与 cursor/windsurf 同策略）

## 8. Skill 迁移策略

### 输出路径映射

| 目标 | 输出路径 | 格式 | 备注 |
|------|---------|------|------|
| **cursor** | `.cursor/skills/<name>/SKILL.mdc` | MDC | 转 MDC frontmatter |
| **claude** | `.claude/skills/<name>/SKILL.md` | 原样 | 保持 SKILL.md |
| **agents** | `.agents/skills/<name>/SKILL.md` | 原样 | 保持 SKILL.md |
| **codebuddy** | `.codebuddy/skills/<name>/SKILL.md` | 原样 | 保持 SKILL.md |

### Adapter 逻辑

- 大部分平台: **原样复制内容 + 正确的存放路径**
- cursor: 额外包装 MDC frontmatter (`name`, `description`)

## 9. MCP 迁移策略

### 使用 Mustache 模板渲染

各平台 MCP JSON 结构差异大（字段名、嵌套、数组格式等），使用模板:

**template/cursor.json**:
```json
{
  "{{#servers}}": {
    "{{@key}}": {
      "type": "stdio",
      "command": "{{command}}",
      "args": {{toJson args}}
      {{#env}}, "env": {{{mapEnv env}}}{{/env}}
    }
  }{{/servers}}
}
```

类似地为 windsurf / claude / codebuddy 编写对应模板。

### 输出路径

| 目标 | 输出路径 |
|------|---------|
| **cursor** | `.cursor/mcp.json` |
| **windsurf** | `.windsurf/mcp.json` |
| **claude** | `~/.claude/mcp_servers.json` (需确认是否写入用户主目录) |
| **codebuddy** | `codebuddy.json` |

## 10. 主入口流程 (index.js)

1. `parseArgs()` — 解析命令行参数
2. `detectIDE()` — 自动识别或使用 --target
3. `parser.parse(srcDir)` — 解析 .qoder 为 AST
4. 对每个 target × type 组合执行迁移:
   - rule → `rule/index.js` → `adapters.js` → 写文件
   - skill → `skill/index.js` → `adapters.js` → 写文件  
   - mcp → `mcp/index.js` → 加载 template + mustache 渲染 → 写文件
5. 输出摘要报告 (迁移了哪些文件到哪些位置)
6. `--dry-run` 时跳过第4步写文件，仅打印预览

## 11. 依赖

| 包名 | 用途 | 必须 |
|------|------|------|
| **无 (纯 Node.js)** | YAML frontmatter 用正则解析，Mustache 子集手写渲染器 | — |

**原则**: 零外部依赖。frontmatter 解析用正则；MCP 模板渲染使用手写的 Mustache 子集（支持 `{{var}}`、`{{{json}}}`、`{{#section}}{{/section}}`、`{{@key}}`）。

## 12. 错误处理

- `.qoder` 目录不存在 → 提示并退出
- 某个类型的目录为空 (如无 rules) → 跳过该类型，继续其他
- 目标目录无写权限 → 报错退出
- 模板文件缺失 → 警告并跳过该平台的 mcp 迁移
- `--dry-run` 不做任何文件操作

## 13. 实现状态

### 已完成模块 (2026-05-13)

| 模块 | 文件 | 状态 |
|------|------|------|
| CLI 主入口 | `index.js` | ✅ |
| IDE 检测器 | `ide-detector.js` | ✅ (7 平台) |
| Parser | `parser.js` | ✅ (rules + skills + commands) |
| Rule adapters | `rule/adapters.js` + `rule/index.js` | ✅ (7 平台) |
| Skill adapters | `skill/adapters.js` + `skill/index.js` | ✅ (4 平台) |
| MCP 迁移 + 模板渲染 | `mcp/index.js` + `mcp/template/*.json` | ✅ (4 平台) |

### 支持目标平台总览

| 平台 | Rule | Skill | MCP | 输出位置 |
|------|:----:|:-----:|:---:|---------|
| cursor | ✅ | ✅ | ✅ | `.cursor/` |
| windsurf | ✅ | — | ✅ | `.windsurf/` |
| claude | ✅ | ✅ | ✅ | `.claude/`, `CLAUDE.md` |
| copilot | ✅ | — | — | `.github/` |
| cline | ✅ | — | — | `.clinerules/` |
| agents | ✅ | ✅ — | `AGENTS.md`, `.agents/` |
| **codebuddy** | **✅** | **✅** | ✅ | **`.codebuddy/rules/`, `.codebuddy/skills/`** |

> 注: `codebuddy` 为独立模式（与 cursor/windsurf 同策略），每条规则/Skill 输出独立文件到 `.codebuddy/` 目录下。
