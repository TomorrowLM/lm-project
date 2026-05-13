'use strict';

/**
 * Rule 迁移适配器
 * 将 .qoder/rules 转换为目标平台格式
 */

// --- 合并模式的 target 集合 ---
const MERGE_TARGETS = new Set(['claude', 'copilot', 'cline', 'agents']);

/**
 * 判断目标是否为合并模式
 * @param {string} target
 * @returns {boolean}
 */
function isMergeMode(target) {
  return MERGE_TARGETS.has(target);
}

/**
 * 从 body 中提取第一行作为描述（去掉 # 标题标记）
 * @param {string} body
 * @returns {string}
 */
function extractDescription(body) {
  if (!body || typeof body !== 'string') return '';
  const firstLine = body.split(/\r?\n/)[0].trim();
  // 去掉开头的 # 标题
  return firstLine.replace(/^#+\s*/, '');
}

/**
 * 合并多条规则的 body，用分隔线连接
 * @param {Array<{name:string, body:string}>} rules
 * @returns {string}
 */
function mergeBodies(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return '';
  return rules.map(r => r.body || '').filter(Boolean).join('\n\n---\n\n');
}

// --- 各平台 Adapter ---

/**
 * Cursor — MDC 格式，每条规则独立文件
 * 输出: .cursor/rules/<name>.mdc
 */
function cursor(rule) {
  const desc = extractDescription(rule.body);
  const trigger = (rule.frontmatter && rule.frontmatter.trigger) || 'always_on';

  const content = [
    '---',
    `description: ${desc}`,
    `always_on: ${trigger === 'always_on' ? 'true' : 'false'}`,
    '---',
    '',
    rule.body || '',
  ].join('\n');

  return {
    outputPath: `.cursor/rules/${rule.name}.mdc`,
    content,
  };
}

/**
 * Windsurf — 原样输出，每条规则独立文件
 * 输出: .windsurf/rules/<name>.md
 */
function windsurf(rule) {
  return {
    outputPath: `.windsurf/rules/${rule.name}.md`,
    content: rule.body || '',
  };
}

/**
 * Claude — 合并所有规则到一个文件
 * 输出: CLAUDE.md
 */
function claude(rules) {
  return {
    outputPath: 'CLAUDE.md',
    content: mergeBodies(rules),
  };
}

/**
 * Copilot — 合并所有规则到一个文件
 * 输出: .github/copilot-instructions.md
 */
function copilot(rules) {
  return {
    outputPath: '.github/copilot-instructions.md',
    content: mergeBodies(rules),
  };
}

/**
 * Cline — 合并所有规则到一个文件
 * 输出: .clinerules/project.md
 */
function cline(rules) {
  return {
    outputPath: '.clinerules/project.md',
    content: mergeBodies(rules),
  };
}

/**
 * Agents — 合并所有规则到一个文件
 * 输出: AGENTS.md
 */
function agents(rules) {
  return {
    outputPath: 'AGENTS.md',
    content: mergeBodies(rules),
  };
}

/**
 * CodeBuddy — 合并所有规则到 .codebuddy/rules/ 目录
 * 输出: .codebuddy/rules/<name>.md (每条规则独立) + .codebuddy/rules/_merged.md
 */
function codebuddy(rule) {
  return {
    outputPath: `.codebuddy/rules/${rule.name}.md`,
    content: rule.body || '',
  };
}

const adapters = { cursor, windsurf, claude, copilot, cline, agents, codebuddy };

module.exports = {
  adapters,
  isMergeMode,
  extractDescription,
  mergeBodies,
};
