'use strict';

const fs = require('fs');
const path = require('path');
const { adapters } = require('./adapters');

/**
 * Skill 迁移入口
 * @param {{ skills: Array }} ast - 解析器返回的 AST
 * @param {string[]} targets - 目标平台列表，如 ['cursor', 'claude']
 * @param {string} outDir - 输出根目录
 * @param {boolean} [dryRun=false] - 是否仅预览不写文件
 * @returns {{ type: 'skill', results: Array, skipped?: string[], reason?: string }}
 */
function migrate(ast, targets, outDir, dryRun = false) {
  const skills = (ast && ast.skills) || [];
  const results = [];
  const skipped = [];

  if (skills.length === 0) {
    return { type: 'skill', results, skipped, reason: 'No skills found in AST' };
  }

  for (const target of targets) {
    const adapter = adapters[target];
    if (!adapter) {
      skipped.push(`Unsupported target: ${target}`);
      continue;
    }

    for (const skill of skills) {
      try {
        const { outputPath, content } = adapter(skill);
        const fullPath = path.resolve(outDir, outputPath);
        const dir = path.dirname(fullPath);

        if (!dryRun) {
          // 自动创建父目录
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fullPath, content, 'utf-8');
        }

        results.push({
          skillName: skill.name,
          target,
          outputPath,
          status: dryRun ? 'preview' : 'written',
          size: Buffer.byteLength(content, 'utf-8'),
        });
      } catch (err) {
        results.push({
          skillName: skill.name,
          target,
          status: 'error',
          error: err.message,
        });
      }
    }
  }

  return { type: 'skill', results, skipped: skipped.length ? skipped : undefined };
}

module.exports = { migrate };
