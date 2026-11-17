import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const inject = ['llm', 'tools', 'workingDirectory']

const MAX_PENDING = 20
const HISTORY_DIR = '.dsh-skill-refiner/history'
const SYSTEM_PROMPT = `你是 DSH 技能审阅与改进器。根据用户给出的改进目标和真实任务证据，修订现有 SKILL.md。

要求：
- 输出完整的 SKILL.md 原文，不要解释，不要用 Markdown 代码围栏包裹。
- 保留 YAML frontmatter 中原有的 name、description、risk_level 等元数据，不得降低风险等级。
- 只纳入输入内容能支持的规则；不要编造工具、API、验证结果或成功经验。
- 删除重复、含糊、过时或互相矛盾的指引；把触发条件、操作步骤、验证与失败处理写清楚。
- 保留技能原有用途和用户约束；证据不足时采用保守措辞，不添加未经验证的专有事实。`

function hash(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function inside(root, target) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
}

async function workspaceFor(ctx, agent, signal) {
  if (!agent) throw new Error('此工具需要在一个工作区 Agent 会话中调用')
  signal?.throwIfAborted()
  const cwd = await ctx.workingDirectory.ensure(agent, signal)
  return realpath(cwd)
}

async function skillFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new Error('path 必须是工作区内的相对路径')
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[\\/]/.test(relativePath)) throw new Error('不接受绝对路径')
  const lexical = path.resolve(root, relativePath)
  if (!inside(root, lexical)) throw new Error('路径必须位于当前工作区内')
  if (path.basename(lexical) !== 'SKILL.md') throw new Error('目标文件必须命名为 SKILL.md')
  const actual = await realpath(lexical)
  if (!inside(root, actual)) throw new Error('符号链接不能指向当前工作区以外')
  return actual
}

function frontmatter(text) {
  const match = String(text).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error('SKILL.md 必须以 YAML frontmatter 开始')
  const values = new Map()
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/)
    if (item) values.set(item[1], item[2])
  }
  if (!values.get('name')) throw new Error('SKILL.md frontmatter 缺少 name')
  return { raw: match[0], values }
}

function stripFence(text) {
  return String(text).trim().replace(/^```(?:markdown|md)?\s*\r?\n/i, '').replace(/\r?\n```\s*$/, '').trim()
}

function validateRevision(original, revised) {
  const next = stripFence(revised)
  if (!next) throw new Error('模型没有返回技能正文')
  const before = frontmatter(original)
  const after = frontmatter(next)
  for (const key of ['name', 'description', 'risk_level']) {
    if (before.values.has(key) && before.values.get(key) !== after.values.get(key)) {
      throw new Error(`模型修改了受保护的 frontmatter 字段：${key}`)
    }
  }
  return next.endsWith('\n') ? next : `${next}\n`
}

async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.${randomUUID()}.tmp`
  await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' })
  try {
    await rename(tempPath, filePath)
  } catch (error) {
    const { unlink } = await import('node:fs/promises')
    await unlink(tempPath).catch(() => {})
    throw error
  }
}

async function historyRoot(root) {
  const directory = path.join(root, HISTORY_DIR)
  await mkdir(directory, { recursive: true })
  const actual = await realpath(directory)
  if (!inside(root, actual)) throw new Error('历史目录不能指向当前工作区以外')
  return actual
}

function objectOutput(properties) {
  return { schema: { type: 'object', additionalProperties: false, properties } }
}

export function apply(ctx, config = {}) {
  const provider = String(config.provider || 'deepseek-official')
  const model = String(config.model || 'deepseek-v4-flash')
  const maxSkillBytes = Number.isInteger(config.maxSkillBytes) ? config.maxSkillBytes : 65536
  const maxEvidenceChars = Number.isInteger(config.maxEvidenceChars) ? config.maxEvidenceChars : 5000
  const pending = new Map()
  const unregister = []

  const prepare = defineTool({
    name: 'skill_refiner_prepare',
    description: '分析工作区内的 SKILL.md，并基于明确的改进目标和任务证据生成待审阅版本；此工具不会改写文件。',
    parameters: {
      path: { type: 'string', required: true, description: '相对当前工作区根目录的 SKILL.md 路径，例如 .agents/skills/review/SKILL.md。' },
      goal: { type: 'string', required: true, description: '希望改进的具体问题或目标。' },
      evidence: { type: 'string', description: '可选的真实执行结果、错误或用户反馈；最多 5000 字符。' },
    },
    output: objectOutput({
      proposalId: { type: 'string', required: true },
      path: { type: 'string', required: true },
      original: { type: 'string', required: true },
      proposed: { type: 'string', required: true },
      note: { type: 'string', required: true },
    }),
    async execute(args, exec) {
      const root = await workspaceFor(ctx, exec.agent, exec.signal)
      const target = await skillFile(root, args.path)
      const original = await readFile(target, 'utf8')
      if (Buffer.byteLength(original, 'utf8') > maxSkillBytes) throw new Error(`技能文件超过 ${maxSkillBytes} 字节上限`)
      const goal = String(args.goal || '').trim()
      if (!goal) throw new Error('goal 不能为空')
      const evidence = String(args.evidence || '').trim().slice(0, maxEvidenceChars)
      const prompt = `改进目标：\n${goal.slice(0, 2000)}\n\n${evidence ? `任务证据：\n${evidence}\n\n` : ''}当前 SKILL.md：\n${original}`
      let generated = ''
      let finishReason
      for await (const chunk of ctx.llm.stream({
        provider,
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.2,
        maxTokens: 6000,
        signal: exec.signal,
      })) {
        if (chunk.type === 'text-delta') generated += chunk.text
        else if (chunk.type === 'finish') finishReason = chunk.reason
      }
      if (finishReason?.kind === 'error' || finishReason?.kind === 'aborted') {
        throw new Error(`模型生成失败：${finishReason.kind === 'aborted' ? '请求已取消' : finishReason.failure?.message || finishReason.failure?.code || '未知错误'}`)
      }
      if (finishReason?.kind === 'max-tokens') throw new Error('模型输出达到 token 上限，未创建提案；请缩短技能正文后重试')
      const proposed = validateRevision(original, generated)
      const id = randomUUID()
      pending.set(id, { root, target, relativePath: path.relative(root, target), originalHash: hash(original), original, proposed, createdAt: new Date().toISOString() })
      while (pending.size > MAX_PENDING) pending.delete(pending.keys().next().value)
      return { proposalId: id, path: path.relative(root, target), original, proposed, note: '提案仅保存在当前进程内存中。审阅 proposed 后，只有在用户明确同意应用时才调用 skill_refiner_apply。' }
    },
  })
  unregister.push(ctx.tools.register(prepare))

  const applyPatch = defineTool({
    name: 'skill_refiner_apply',
    description: '应用一个已审阅的技能改进提案。仅在用户明确同意应用该提案后调用。',
    parameters: {
      proposalId: { type: 'string', required: true, description: 'skill_refiner_prepare 返回的提案 ID。' },
    },
    output: objectOutput({
      applied: { type: 'boolean', required: true },
      path: { type: 'string', required: true },
      snapshotId: { type: 'string', required: true },
      message: { type: 'string', required: true },
    }),
    async execute(args, exec) {
      const proposal = pending.get(args.proposalId)
      if (!proposal) throw new Error('提案不存在或已过期；请重新生成')
      const root = await workspaceFor(ctx, exec.agent, exec.signal)
      if (root !== proposal.root) throw new Error('提案属于另一个工作区')
      const target = await skillFile(root, proposal.relativePath)
      const current = await readFile(target, 'utf8')
      if (hash(current) !== proposal.originalHash) throw new Error('技能文件在生成提案后已变化；为避免覆盖，请重新生成提案')
      validateRevision(current, proposal.proposed)
      const snapshotId = randomUUID()
      const snapshot = {
        id: snapshotId,
        path: proposal.relativePath,
        createdAt: new Date().toISOString(),
        before: current,
        afterHash: hash(proposal.proposed),
      }
      const dir = await historyRoot(root)
      await writeFile(path.join(dir, `${snapshotId}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      const latest = await readFile(target, 'utf8')
      if (hash(latest) !== proposal.originalHash) throw new Error('技能文件刚刚发生变化；快照已保存但未应用，请重新生成提案')
      await atomicWrite(target, proposal.proposed)
      pending.delete(args.proposalId)
      return { applied: true, path: proposal.relativePath, snapshotId, message: `已应用技能改进。回滚请使用快照 ID ${snapshotId}。` }
    },
  })
  unregister.push(ctx.tools.register(applyPatch))

  const history = defineTool({
    name: 'skill_refiner_history',
    description: '列出当前工作区内已保存的技能改进快照。',
    parameters: {
      path: { type: 'string', description: '可选：只列出某个 SKILL.md 路径的快照。' },
    },
    output: objectOutput({ snapshots: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string', required: true }, path: { type: 'string', required: true }, createdAt: { type: 'string', required: true },
    } } } }),
    async execute(args, exec) {
      const root = await workspaceFor(ctx, exec.agent, exec.signal)
      let dir
      try { dir = await historyRoot(root) } catch (error) {
        if (error?.code === 'ENOENT') return { snapshots: [] }
        throw error
      }
      const { readdir } = await import('node:fs/promises')
      const entries = await readdir(dir, { withFileTypes: true })
      const snapshots = []
      for (const entry of entries) {
        if (!entry.isFile() || !/^[0-9a-f-]+\.json$/i.test(entry.name)) continue
        try {
          const record = JSON.parse(await readFile(path.join(dir, entry.name), 'utf8'))
          if (args.path && record.path !== args.path) continue
          snapshots.push({ id: record.id, path: record.path, createdAt: record.createdAt })
        } catch { /* skip malformed history records */ }
      }
      snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { snapshots: snapshots.slice(0, 100) }
    },
  })
  unregister.push(ctx.tools.register(history))

  const rollback = defineTool({
    name: 'skill_refiner_rollback',
    description: '将技能文件恢复到指定快照保存的前一版本；仅在用户明确要求回滚时调用。',
    parameters: {
      snapshotId: { type: 'string', required: true, description: 'skill_refiner_history 返回的快照 ID。' },
    },
    output: objectOutput({
      rolledBack: { type: 'boolean', required: true }, path: { type: 'string', required: true }, message: { type: 'string', required: true },
    }),
    async execute(args, exec) {
      const root = await workspaceFor(ctx, exec.agent, exec.signal)
      if (!/^[0-9a-f-]{36}$/i.test(args.snapshotId)) throw new Error('快照 ID 格式无效')
      const dir = await historyRoot(root)
      const recordPath = path.join(dir, `${args.snapshotId}.json`)
      const record = JSON.parse(await readFile(recordPath, 'utf8'))
      if (record.id !== args.snapshotId || typeof record.path !== 'string' || typeof record.before !== 'string' || typeof record.afterHash !== 'string') {
        throw new Error('快照内容无效')
      }
      const target = await skillFile(root, record.path)
      const current = await readFile(target, 'utf8')
      if (hash(current) !== record.afterHash) throw new Error('当前技能文件已不等于该快照应用后的版本；为避免覆盖新改动，不能直接回滚')
      const rollbackId = randomUUID()
      const rollbackRecord = {
        id: rollbackId,
        path: record.path,
        createdAt: new Date().toISOString(),
        before: current,
        afterHash: hash(record.before),
      }
      await writeFile(path.join(dir, `${rollbackId}.json`), `${JSON.stringify(rollbackRecord, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      const latest = await readFile(target, 'utf8')
      if (hash(latest) !== record.afterHash) throw new Error('技能文件刚刚发生变化；回滚快照已保存但未回滚')
      await atomicWrite(target, record.before)
      return { rolledBack: true, path: record.path, message: `已恢复快照 ${args.snapshotId} 保存的旧版本；当前版本也已另存为快照 ${rollbackId}。` }
    },
  })
  unregister.push(ctx.tools.register(rollback))

  return () => {
    pending.clear()
    for (const dispose of unregister.reverse()) {
      try { dispose() } catch { /* teardown should continue */ }
    }
  }
}
