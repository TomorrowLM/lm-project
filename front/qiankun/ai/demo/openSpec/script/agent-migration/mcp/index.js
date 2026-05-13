'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/** MCP 输出路径映射 */
const OUTPUT_PATHS = {
  cursor:     '.cursor/mcp.json',
  windsurf:   '.windsurf/mcp.json',
  claude:     '~/.claude/mcp_servers.json',
  codebuddy:  'codebuddy.json',
};

// ─── 轻量 Mustache 子集渲染器 ─────────────────────────────────

function renderTemplate(templateStr, data) {
  let result = templateStr;

  // 处理 sections: {{#key}}...{{/key}} — 对象迭代
  const sectionRegex = /\{\{#(\w+)\}\}\s*([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(sectionRegex, (_, key, inner) => {
    const value = data[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

    return Object.entries(value).map(([k, v]) => {
      let rendered = inner;
      rendered = rendered.replace(/\{\{@key\}\}/g, k);
      rendered = rendered.replace(/\{\{(\w+)\}\}/g, (m, prop) =>
        v[prop] !== undefined ? String(v[prop]) : ''
      );
      rendered = rendered.replace(/\{\{\{(\w+)\}\}\}\}/g, (m, prop) =>
        v[prop] !== undefined ? JSON.stringify(v[prop]) : 'null'
      );
      return rendered;
    }).join('');
  });

  result = result.replace(/\{\{\{(\w+)\}\}\}\}/g, (match, key) =>
    data[key] !== undefined ? JSON.stringify(data[key]) : 'null'
  );

  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    data[key] !== undefined ? String(data[key]) : ''
  );

  return result;
}

// ─── 源 MCP 配置读取 ────────────────────────────────────────

function readSourceMcp(srcDir) {
  const candidates = [
    'codebuddy.json',
    '.cursor/mcp.json',
    '.windsurf/mcp.json',
    'mcp.json',
  ];

  for (const candidate of candidates) {
    const fullPath = path.resolve(srcDir, candidate);
    try {
      if (fs.existsSync(fullPath)) {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        if (!raw.trim()) continue;
        return JSON.parse(raw);
      }
    } catch (e) { /* skip */ }
  }

  return null;
}

// ─── 主迁移函数 ────────────────────────────────────────────

function migrate(ast, targets, srcDir, outDir, dryRun = false) {
  const sourceData = readSourceMcp(srcDir);

  if (!sourceData) {
    return {
      type: 'mcp',
      results: [],
      skipped: true,
      reason: 'No MCP config found in project (checked: codebuddy.json, .cursor/mcp.json, .windsurf/mcp.json, mcp.json)',
    };
  }

  const renderData = {
    servers: sourceData.servers
      || sourceData.mcpServers
      || sourceData.mcpConfig
      || sourceData,
  };

  const results = [];

  for (const target of targets) {
    const templatePath = path.resolve(__dirname, 'template', `${target}.json`);

    if (!fs.existsSync(templatePath)) {
      results.push({ target, status: 'skipped', reason: `No template for target: ${target}` });
      continue;
    }

    const outputPath = OUTPUT_PATHS[target];
    if (!outputPath) {
      results.push({ target, status: 'skipped', reason: `No output path defined for: ${target}` });
      continue;
    }

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const rendered = renderTemplate(templateContent, renderData);

      let cleaned = rendered.replace(/,\s*([}\]])/g, '$1').trim();
      try { cleaned = JSON.stringify(JSON.parse(cleaned), null, 2); } catch { /* keep raw */ }

      const resolvedOutput = outputPath.startsWith('~')
        ? path.join(os.homedir(), outputPath.slice(2))
        : path.resolve(outDir, outputPath);

      if (!dryRun) {
        ensureDir(path.dirname(resolvedOutput));
        fs.writeFileSync(resolvedOutput, cleaned, 'utf-8');
      }

      results.push({
        target,
        outputPath: resolvedOutput,
        status: dryRun ? 'preview' : 'written',
        size: cleaned.length,
      });
    } catch (err) {
      results.push({ target, status: 'error', error: err.message });
    }
  }

  return { type: 'mcp', results };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = { migrate, readSourceMcp, renderTemplate, OUTPUT_PATHS };
