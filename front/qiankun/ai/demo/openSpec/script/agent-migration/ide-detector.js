/**
 * IDE / Agent 环境自动检测器
 *
 * 支持目标平台: cursor, windsurf, claude, copilot, cline, agents, codebuddy
 *
 * 检测优先级:
 *   1. --target 参数（用户显式指定，跳过自动检测）
 *   2. 进程名/环境变量检测
 *   3. 已有配置文件嗅探
 *   4. 默认 fallback → codebuddy
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── 支持的全部平台列表 ────────────────────────────────────────

const SUPPORTED_TARGETS = [
  'cursor',
  'windsurf',
  'claude',
  'copilot',
  'cline',
  'agents',
  'codebuddy',
];

// ─── 检测规则表（按优先级排列） ─────────────────────────────────

/** @type {Array<{ target: string, check: (env: object) => string | null }>} */
const ENV_RULES = [
  // Cursor
  {
    target: 'cursor',
    check(env) {
      if (env.TERM_PROGRAM === 'vscode' && process.argv0 && process.argv0.includes('Cursor')) return 'cursor';
      if (process.argv0 && process.argv0.includes('Cursor')) return 'cursor';
      // Cursor 也可能设置 VSCODE_IPC_HOOK，但进程名更可靠
      return null;
    },
  },

  // Windsurf
  {
    target: 'windsurf',
    check(env) {
      if (process.argv0 && process.argv0.includes('Windsurf')) return 'windsurf';
      return null;
    },
  },

  // Claude Code (CLI)
  {
    target: 'claude',
    check(env) {
      if (process.argv0 && process.argv0.includes('claude')) return 'claude';
      return null;
    },
  },

  // VS Code + Copilot
  {
    target: 'copilot',
    check(env) {
      if (env.TERM_PROGRAM === 'vscode') return 'copilot';
      if (env.VSCODE_IPC_HOOK) return 'copilot';
      return null;
    },
  },

  // Cline
  {
    target: 'cline',
    check(env) {
      // 检查 CLINE_* 环境变量前缀
      const keys = Object.keys(env);
      if (keys.some((k) => k.startsWith('CLINE_'))) return 'cline';
      return null;
    },
  },

  // CodeBuddy
  {
    target: 'codebuddy',
    check(env) {
      if (env.CODEBUDDY) return 'codebuddy';
      return null;
    },
  },
];

/** @type {Array<{ target: string, check: (dir: string) => string | null }>} */
const FILE_RULES = [
  // Cursor
  {
    target: 'cursor',
    check(dir) {
      const p = path.join(dir, '.cursor', 'rules');
      if (fs.existsSync(p)) return 'cursor';
      const root = path.join(dir, '.cursor');
      if (fs.existsSync(root)) return 'cursor';
      return null;
    },
  },

  // Windsurf
  {
    target: 'windsurf',
    check(dir) {
      const p = path.join(dir, '.windsurf');
      if (fs.existsSync(p)) return 'windsurf';
      return null;
    },
  },

  // Claude Code
  {
    target: 'claude',
    check(dir) {
      const p = path.join(dir, 'CLAUDE.md');
      if (fs.existsSync(p)) return 'agents'; // CLAUDE.md 映射到 agents 平台
      return null;
    },
  },

  // Cline
  {
    target: 'cline',
    check(dir) {
      const p = path.join(dir, '.clinerules', 'project.md');
      if (fs.existsSync(p)) return 'cline';
      return null;
    },
  },

  // Agents (AGENTS.md)
  {
    target: 'agents',
    check(dir) {
      const p = path.join(dir, 'AGENTS.md');
      if (fs.existsSync(p)) return 'agents';
      return null;
    },
  },
];

// ─── 公共 API ───────────────────────────────────────────────────

/**
 * 核心解析函数：根据参数和环境确定目标平台列表
 * @param {string|null} targetArg -- 用户通过 --target 显式指定的值，如 "cursor" 或 "cursor,claude"
 * @param {string} baseDir - 项目根目录路径，用于文件嗅探
 * @returns {string[]} 检测到的目标平台数组
 */
function resolveTargets(targetArg, baseDir) {
  // 优先级1：用户显式指定
  if (targetArg && typeof targetArg === 'string' && targetArg.trim()) {
    const targets = targetArg
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // 验证每个目标是否在支持列表中
    const invalid = targets.filter((t) => !SUPPORTED_TARGETS.includes(t));
    if (invalid.length > 0) {
      throw new Error(
        `不支持的目标平台: ${invalid.join(', ')}. 支持的平台: ${SUPPORTED_TARGETS.join(', ')}`
      );
    }

    return targets;
  }

  // 优先级2：环境变量/进程名检测
  const envResult = detectFromEnv();
  if (envResult) return [envResult];

  // 优先级3：文件嗅探
  const fileResult = detectFromFiles(baseDir || '.');
  if (fileResult) return [fileResult];

  // 优先级4：默认 fallback
  return ['codebuddy'];
}

/**
 * 从环境变量和进程信息中检测当前 IDE/Agent 环境
 * @returns {string|null} 检测到的平台名称，或 null
 */
function detectFromEnv() {
  for (const rule of ENV_RULES) {
    const result = rule.check(process.env);
    if (result) return result;
  }
  return null;
}

/**
 * 通过项目中的已有配置文件嗅探当前使用的平台
 * @param {string} baseDir - 项目根目录路径
 * @returns {string|null} 检测到的平台名称，或 null
 */
function detectFromFiles(baseDir) {
  const dir = path.resolve(baseDir || '.');
  for (const rule of FILE_RULES) {
    const result = rule.check(dir);
    if (result) return result;
  }
  return null;
}

module.exports = {
  resolveTargets,
  detectFromEnv,
  detectFromFiles,
  SUPPORTED_TARGETS,
};
