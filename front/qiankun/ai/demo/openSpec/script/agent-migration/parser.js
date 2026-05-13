'use strict';

const fs = require('fs');
const path = require('path');

/**
 * .qoder 统一解析器
 * 扫描 rules/skills/commands，提取 YAML frontmatter + Markdown body
 */

// --- Frontmatter 解析 ---

function parseFrontmatter(content) {
  if (typeof content !== 'string') return {};
  const trimmed = content.trim();

  // 检查是否以 --- 开头和结尾
  const fmStartRegex = /^---\r?\n/;
  const fmEndRegex = /\r?\n---\r?\n/;
  if (!fmStartRegex.test(trimmed)) return {};

  const startMatch = trimmed.match(fmStartRegex);
  const afterStart = trimmed.substring(startMatch[0].length);
  const endMatch = afterStart.match(fmEndRegex);
  if (!endMatch) return {};

  const rawYaml = afterStart.substring(0, endMatch.index);
  return parseYaml(rawYaml);
}

/**
 * 简易 YAML 解析器（支持字符串、数组、嵌套对象的基本格式）
 */
function parseYaml(raw) {
  const result = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = null;
  let inBlock = null; // 当前正在构建的嵌套对象 { key, indent, obj }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过空行和注释
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;

    // 检测缩进级别
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();

    // 如果在嵌套块中，检查是否还在该块内
    if (inBlock && leadingSpaces > inBlock.indent) {
      // 仍在嵌套块内 - 解析为子属性
      parseYamlLine(stripped, inBlock.obj, inBlock.indent);
      continue;
    } else if (inBlock) {
      // 缩进减少或同级，结束当前嵌套块
      result[inBlock.key] = inBlock.obj;
      inBlock = null;
      // 继续处理当前行（重新进入循环逻辑）
      // 需要重新处理这行
      i--;
      continue;
    }

    // 顶级 key:value
    const colonIdx = stripped.indexOf(':');
    if (colonIdx === -1) continue;

    const key = stripped.substring(0, colonIdx).trim();
    const valuePart = stripped.substring(colonIdx + 1).trim();

    if (valuePart === '' || valuePart.startsWith('#')) {
      // 可能是嵌套对象的开始 - 向前探测下一行
      const nextLineIdx = i + 1;
      if (nextLineIdx < lines.length) {
        const nextLeading = lines[nextLineIdx].match(/^(\s*)/)[1].length;
        if (nextLeading > leadingSpaces) {
          // 确认是嵌套对象
          inBlock = { key, indent: leadingSpaces, obj: {} };
          continue;
        }
      }
      result[key] = '';
    } else {
      result[key] = parseYamlValue(valuePart);
    }
  }

  // 处理文件末尾未关闭的嵌套块
  if (inBlock) {
    result[inBlock.key] = inBlock.obj;
  }

  return result;
}

function parseYamlLine(stripped, obj, parentIndent) {
  const colonIdx = stripped.indexOf(':');
  if (colonIdx === -1) return;

  const key = stripped.substring(0, colonIdx).trim();
  const valuePart = stripped.substring(colonIdx + 1).trim();

  if (valuePart === '' || valuePart.startsWith('#')) {
    obj[key] = '';
  } else {
    obj[key] = parseYamlValue(valuePart);
  }
}

/**
 * 解析 YAML 值：字符串、数字、布尔值、数组、null
 */
function parseYamlValue(value) {
  // 引号字符串
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // 数组 [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(item => {
      const t = item.trim();
      return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
        ? t.slice(1, -1)
        : t;
    });
  }

  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;

  // null
  if (value === 'null' || value === '~' || value === '') return null;

  // 数字
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // 普通字符串
  return value;
}

/**
 * 提取 body（去掉 frontmatter 的纯 Markdown 内容）
 */
function extractBody(content) {
  if (typeof content !== 'string') return '';

  const trimmed = content.trim();
  const fmStartRegex = /^---\r?\n/;
  if (!fmStartRegex.test(trimmed)) return trimmed;

  const startMatch = trimmed.match(fmStartRegex);
  const afterStart = trimmed.substring(startMatch[0].length);
  const endMatch = afterStart.match(/\r?\n---\r?\n/);

  if (endMatch) {
    return afterStart.substring(endMatch.index + endMatch[0].length).trimStart();
  }
  return trimmed;
}

// --- 文件系统扫描 ---

/**
 * 安全读取目录，不存在时返回 []
 */
function safeReaddir(dirPath) {
  try {
    const full = path.resolve(dirPath);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return [];
    return fs.readdirSync(full).filter(name => !name.startsWith('.'));
  } catch (e) {
    return [];
  }
}

/**
 * 解析 Rules (.qoder/rules/*.md)
 */
function parseRules(qoderDir) {
  const rulesDir = path.join(qoderDir, 'rules');
  const files = safeReaddir(rulesDir);

  return files
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const filePath = path.join(rulesDir, f);
      const content = readFileSafe(filePath);
      const name = f.replace(/\.md$/, '');
      return {
        name,
        sourcePath: path.join('.qoder', 'rules', f).replace(/\\/g, '/'),
        frontmatter: parseFrontmatter(content),
        body: extractBody(content),
      };
    });
}

/**
 * 解析 Skills 或 Commands（结构类似：子目录/SKILL.md 或 子目录/*.md）
 * @param {'skills'|'commands'} type
 */
function parseSkillLike(qoderDir, type) {
  const baseDir = path.join(qoderDir, type);
  const entries = safeReaddir(baseDir);

  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(baseDir, entry);
    const stat = safeStat(entryPath);
    if (!stat || !stat.isDirectory()) continue;

    if (type === 'skills') {
      // Skills: skills/<name>/SKILL.md
      const skillFile = path.join(entryPath, 'SKILL.md');
      const content = readFileSafe(skillFile);
      if (content !== null) {
        results.push({
          name: entry,
          sourcePath: path.join('.qoder', type, entry, 'SKILL.md').replace(/\\/g, '/'),
          frontmatter: parseFrontmatter(content),
          body: extractBody(content),
        });
      }
    } else if (type === 'commands') {
      // Commands: commands/<group>/*.md
      const cmdFiles = safeReaddir(entryPath)
        .filter(f => f.endsWith('.md'));

      for (const cmdFile of cmdFiles) {
        const cmdPath = path.join(entryPath, cmdFile);
        const content = readFileSafe(cmdPath);
        const cmdName = cmdFile.replace(/\.md$/, '');
        results.push({
          name: `${entry}:${cmdName}`,
          sourcePath: path.join('.qoder', type, entry, cmdFile).replace(/\\/g, '/'),
          frontmatter: parseFrontmatter(content),
          body: extractBody(content),
        });
      }
    }
  }

  return results;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (e) {
    return null;
  }
}

// --- 主入口 ---

/**
 * 解析整个 .qoder 目录，返回统一 AST
 * @param {string} projectRoot 项目根目录
 * @returns {{ rules: Array, skills: Array, commands: Array }}
 */
function parse(projectRoot) {
  const qoderDir = path.resolve(projectRoot, '.qoder');

  return {
    rules: parseRules(qoderDir),
    skills: parseSkillLike(qoderDir, 'skills'),
    commands: parseSkillLike(qoderDir, 'commands'),
  };
}

module.exports = {
  parse,
  parseFrontmatter,
  parseRules,
  parseSkillLike,
};
