'use strict';

const fs = require('fs');
const path = require('path');
const { adapters, isMergeMode } = require('./adapters');

/**
 * Rule 迁移入口
 * @param {{rules:Array}} ast - parser 输出的 AST
 * @param {string[]} targets - 目标平台列表
 * @param {string} outDir - 输出根目录
 * @param {boolean} dryRun - 仅预览不写文件
 * @returns {{type:string, results:Array, skipped?:Array, reason?:string}}
 */
function migrate(ast, targets, outDir, dryRun) {
  const results = [];
  const skipped = [];

  if (!ast || !Array.isArray(ast.rules) || ast.rules.length === 0) {
    return {
      type: 'rule',
      results: [],
      skipped: [],
      reason: 'No rules found in AST',
    };
  }

  for (const target of targets) {
    const adapter = adapters[target];
    if (!adapter) {
      skipped.push({ target, reason: `Unsupported target: ${target}` });
      continue;
    }

    if (isMergeMode(target)) {
      // 合并模式: 所有规则 → 一个文件
      const result = adapter(ast.rules);
      if (!result.content) {
        skipped.push({ target, outputPath: result.outputPath, reason: 'Empty merged content' });
        continue;
      }
      const entry = processFile(result.outputPath, result.content, outDir, dryRun);
      entry.target = target;
      results.push(entry);
    } else {
      // 独立模式: 每条规则一个文件
      for (const rule of ast.rules) {
        const result = adapter(rule);
        if (!result.content) {
          skipped.push({ target, rule: rule.name, reason: 'Empty content' });
          continue;
        }
        const entry = processFile(result.outputPath, result.content, outDir, dryRun);
        entry.target = target;
        entry.ruleName = rule.name;
        results.push(entry);
      }
    }
  }

  return {
    type: 'rule',
    results,
    skipped: skipped.length > 0 ? skipped : undefined,
  };
}

/**
 * 处理单个文件输出（写入或预览）
 */
function processFile(relativePath, content, outDir, dryRun) {
  const fullPath = path.resolve(outDir, relativePath);

  if (dryRun) {
    return {
      outputPath: relativePath,
      status: 'preview',
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  // 自动创建父目录
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');

  return {
    outputPath: relativePath,
    status: 'written',
    size: Buffer.byteLength(content, 'utf-8'),
  };
}

module.exports = { migrate };
