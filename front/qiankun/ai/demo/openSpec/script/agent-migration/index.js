#!/usr/bin/env node
'use strict';

/**
 * Agent Migration Tool — CLI 主入口
 *
 * 从 .qoder 目录解析 Rule/Skill/MCP 配置，迁移至目标 IDE/Agent 平台
 *
 * 用法:
 *   node index.js [options]
 */

const path = require('path');

const { resolveTargets, SUPPORTED_TARGETS } = require('./ide-detector');
const { parse } = require('./parser');
const { migrate: migrateRules } = require('./rule');
const { migrate: migrateSkills } = require('./skill');
const { migrate: migrateMcp } = require('./mcp');

// ─── 参数解析 ────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    target: undefined,
    only: ['rule', 'skill', 'mcp'],
    src: '.',
    out: '.',
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--target':
        options.target = args[++i]; break;
      case '--only':
        options.only = args[++i].split(',').map(s => s.trim()); break;
      case '--src':
        options.src = args[++i]; break;
      case '--out':
        options.out = args[++i]; break;
      case '--dry-run':
        options.dryRun = true; break;
      case '-h':
      case '--help':
        options.help = true; break;
      default:
        if (args[i].startsWith('-')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return options;
}

// ─── 帮助信息 ────────────────────────────────────────────────

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     Agent Migration Tool — .qoder → IDE/Agent       ║
╚══════════════════════════════════════════════════════╝

从 .qoder 目录迁移 Rule / Skill / MCP 配置到目标平台

用法:
  node index.js [options]

选项:
  --target <list>   目标平台，逗号分隔
                    (${SUPPORTED_TARGETS.join('/')})
  --only <list>     迁移类型: rule, skill, mcp (默认全部)
  --src <path>      源项目目录 (默认 ./)
  --out <path>      输出目录 (默认 覆盖源项目)
  --dry-run         预览模式，不写入文件
  -h, --help        帮助信息

示例:
  node index.js                              # 自动检测，迁移全部
  node index.js --target cursor              # 迁移到 Cursor
  node index.js --target cursor,claude \\
                   --only rule,skill         # 指定目标和类型
  node index.js --dry-run                    # 预览不写入

支持的目标平台:
  ${SUPPORTED_TARGETS.map(t => `  • ${t}`).join('\n')}
`);
}

// ─── 格式化工具 ──────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ─── 摘要报告 ────────────────────────────────────────────────

function printSummary({ srcDir, targets, dryRun, reports }) {
  const mode = dryRun ? '[DRY-RUN] ' : '';
  let totalWritten = 0;
  let totalSkipped = 0;

  console.log(`\n${mode}╔══════════════════════════════════════════════╗`);
  console.log(`${mode}║       Agent Migration Summary               ║`);
  console.log(`${mode}╚══════════════════════════════════════════════╝`);
  console.log(`\n${mode}Source:  ${path.resolve(srcDir)}`);
  console.log(`${mode}Targets: ${targets.join(', ')}`);
  if (dryRun) console.log(`${mode}Mode:    DRY-RUN (no files written)`);

  for (const report of reports) {
    console.log(`\n${mode}── ${report.type.toUpperCase()} ${'─'.repeat(40 - report.type.length)}`);

    if (report.skipped || report.reason) {
      console.log(`  ⏭  ${report.reason || 'Skipped'}`);
      totalSkipped++;
      continue;
    }

    for (const r of report.results) {
      const icon = r.status === 'written' ? '✓'
                 : r.status === 'preview' ? '👁'
                 : r.status === 'error' ? '✗'
                 : '⏭';

      const label = r.skillName || r.target || r.ruleName || r.outputPath;
      const detail = r.status === 'error' ? r.error : `${r.outputPath} (${formatSize(r.size)})`;

      console.log(`  ${icon}  ${label}: ${detail}`);

      if (r.status === 'written' || r.status === 'preview') totalWritten++;
      else totalSkipped++;
    }
  }

  console.log(`\n${mode}─────────────────────────────────────────────`);
  console.log(`${mode}Total: ${totalWritten} processed, ${totalSkipped} skipped`);
}

// ─── 主流程 ──────────────────────────────────────────────────

function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // 1. 解析路径
  const srcDir = path.resolve(options.src);
  const outDir = path.resolve(options.out);

  // 2. 检测目标平台
  try {
    var targets = resolveTargets(options.target, srcDir);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // 3. 解析 .qoder
  const ast = parse(srcDir);
  console.log(`Parsed .qoder: ${ast.rules.length} rules, ${ast.skills.length} skills, ${ast.commands.length} commands`);
  console.log(`Detected targets: ${targets.join(', ')}`);
  if (options.dryRun) console.log('Running in DRY-RUN mode...\n');

  // 4. 按 type 迁移
  const onlyTypes = new Set(options.only.map(t => t.trim().toLowerCase()));
  const validTypes = new Set(['rule', 'skill', 'mcp']);
  const invalidTypes = [...onlyTypes].filter(t => !validTypes.has(t));

  if (invalidTypes.length > 0) {
    console.error(`Error: Invalid --only types: ${invalidTypes.join(', ')}. Valid: rule, skill, mcp`);
    process.exit(1);
  }

  const reports = [];

  if (onlyTypes.has('rule')) {
    reports.push(migrateRules(ast, targets, outDir, options.dryRun));
  }
  if (onlyTypes.has('skill')) {
    reports.push(migrateSkills(ast, targets, outDir, options.dryRun));
  }
  if (onlyTypes.has('mcp')) {
    reports.push(migrateMcp(ast, targets, srcDir, outDir, options.dryRun));
  }

  // 5. 输出摘要
  printSummary({
    srcDir,
    targets,
    dryRun: options.dryRun,
    reports,
  });
}

main();
