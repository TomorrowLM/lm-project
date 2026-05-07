Kimi Agent/                           # 项目根目录
├── .claude/                          # Cherry Studio Agent 核心配置区
│   ├── prompts/                      # 系统提示词（双语）
│   │   ├── system_prompt_cn.md       # 中文版：定义 Agent 行为 + 数据真实规则
│   │   └── system_prompt_en.md       # 英文版
│   ├── skills/                       # 3 个核心 Skills（自动识别）
│   │   ├── skill_financial_data_fetcher.md     # 数据抓取 + 验证
│   │   ├── skill_geopolitical_analyst.md       # 事件分析 + 时间线
│   │   └── skill_financial_report_generator.md # HTML 报告生成
│   ├── agents/                       # Sub-agents 配置
│   │   ├── subagent_financial_intelligence.md  # 量化分析子模块
│   │   └── subagents_usage_strategy.md         # 协作策略
│   ├── config/                       # 路径/工具配置
│   │   └── paths.conf
│   ├── settings.json                 # 主配置：模型 + 提示词路径 + 工具列表
│   └── mcp.json                      # MCP（工具服务器）配置
├── docs/                             # 文档备份（README、数据源、更新日志）
├── start-gold-agent.sh               # 一键启动脚本（可选）
├── USER_PROMPT_EXAMPLE.md            # 示例指令
└── 备份目录（core_config/ skills/ 等）# 原始文件备份，不参与运行