'use strict';

const path = require('path');

/**
 * Skill 迁移适配器
 * 将 .qoder skills 转换为各 IDE/平台格式
 */

// --- 工具函数 ---

/**
 * 将 skill 对象重新序列化为带 frontmatter 的 Markdown 字符串
 * @param {{ name: string, sourcePath: string, frontmatter: Object, body: string }} skill
 * @returns {string} 完整的 Markdown（含 --- frontmatter ---）
 */
function toMarkdown(skill) {
  const fm = skill.frontmatter || {};
  const body = skill.body || '';

  // 如果没有 frontmatter，直接返回 body
  if (Object.keys(fm).length === 0) {
    return body;
  }

  // 序列化 frontmatter 为 YAML
  const yamlLines = serializeFrontmatter(fm);

  return '---\n' + yamlLines.join('\n') + '\n---\n\n' + body;
}

/**
 * 将 frontmatter 对象序列化为 YAML 行数组
 */
function serializeFrontmatter(fm, indent = '') {
  const lines = [];

  for (const key of Object.keys(fm)) {
    const value = fm[key];
    if (value === undefined || value === null) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      // 嵌套对象
      lines.push(indent + key + ':');
      lines.push(...serializeFrontmatter(value, indent + '  '));
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(indent + key + ':');
      for (const item of value) {
        if (typeof item === 'string') {
          lines.push(indent + '  - "' + item + '"');
        } else {
          lines.push(indent + '  - ' + String(item));
        }
      }
    } else {
      lines.push(indent + key + ': ' + yamlValue(value));
    }
  }

  return lines;
}

function yamlValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  // 包含特殊字符时加引号
  if (/[:"'\n{}[\]#$%&*?|<>=!@`]/.test(value)) {
    return '"' + value.replace(/"/g, '\\"') + '"';
  }
  return String(value);
}

// --- Adapter 定义 ---

const adapters = {
  /**
   * Cursor: 输出 MDC 格式，带 frontmatter 包装
   * 输出路径: .cursor/skills/<name>/SKILL.mdc
   */
  cursor: (skill) => ({
    outputPath: path.join('.cursor', 'skills', skill.name, 'SKILL.mdc'),
    content: toMarkdown(skill),
  }),

  /**
   * Claude: 原样保持 Markdown
   * 输出路径: .claude/skills/<name>/SKILL.md
   */
  claude: (skill) => ({
    outputPath: path.join('.claude', 'skills', skill.name, 'SKILL.md'),
    content: toMarkdown(skill),
  }),

  /**
   * Agents: 原样保持 Markdown
   * 输出路径: .agents/skills/<name>/SKILL.md
   */
  agents: (skill) => ({
    outputPath: path.join('.agents', 'skills', skill.name, 'SKILL.md'),
    content: toMarkdown(skill),
  }),

  /**
   * CodeBuddy: 原样保持 Markdown
   * 输出路径: .codebuddy/skills/<name>/SKILL.md
   */
  codebuddy: (skill) => ({
    outputPath: path.join('.codebuddy', 'skills', skill.name, 'SKILL.md'),
    content: toMarkdown(skill),
  }),
};

module.exports = { adapters, toMarkdown };
