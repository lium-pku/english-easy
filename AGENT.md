# English Vocabulary Size Test

## 项目概述

英语词汇量测试 Web 应用。采用分层抽样（Stratified Sampling）方法，覆盖 40,000 词汇量，通过六选项英文释义匹配题型（含防猜测机制）估算测试者的英语词汇量。

## 需求规格

### 核心需求（已确定）

| 维度 | 选择 |
|------|------|
| 测试方法 | 纯分层抽样（非自适应） |
| 题型 | 六选项英文释义匹配（4 释义 + "以上意思都不正确" + "不认识"，含 A/B 防猜测题型） |
| 词汇覆盖 | 40,000 词 |
| 平台 | Web 前端 |
| 数据持久化 | 一次性测试，不记录历史 |

### 11 个词频层定义

| Band | 频率范围 | 标签 | 层内词数 | 当前题目数 |
|------|---------|------|---------|-----------|
| 1 | 1-1,000 | 1-1K | 1,000 | ~390 |
| 2 | 1,001-2,000 | 1K-2K | 1,000 | ~388 |
| 3 | 2,001-3,000 | 3K-4K | 1,000 | ~375 |
| 4 | 3,001-5,000 | 3K-5K | 2,000 | ~355 |
| 5 | 5,001-7,000 | 5K-7K | 2,000 | ~379 |
| 6 | 7,001-10,000 | 7K-10K | 3,000 | ~374 |
| 7 | 10,001-15,000 | 10K-15K | 5,000 | ~340 |
| 8 | 15,001-20,000 | 15K-20K | 5,000 | ~369 |
| 9 | 20,001-25,000 | 20K-25K | 5,000 | ~361 |
| 10 | 25,001-32,000 | 25K-32K | 7,000 | ~345 |
| 11 | 32,001-40,000 | 32K-40K | 8,000 | ~346 |

### 对标参考

| 考试/水平 | 词汇量 |
|-----------|--------|
| 高考英语 | ~3,500 |
| CET-4 | ~4,500 |
| CET-6 | ~6,500 |
| 考研英语 | ~5,500 |
| 雅思 7+ | ~9,000 |
| 英语专业八级 | ~13,000 |
| 母语成年人 | ~17,000 |

## 架构

### 项目结构

```
├── AGENT.md                    # 本文档
├── package.json                # ESM 项目配置
├── data/
│   ├── config.json             # 层级配置、对标基准
│   └── bands/
│       └── band-{1-11}.json    # 每层题目数据（JSON）
├── public/                     # Web 前端（静态文件）
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js              # 主应用逻辑、页面切换、事件绑定
│       ├── test-engine.js      # 测试引擎：加载数据、抽题、计时、评分
│       └── results.js          # 结果渲染：词汇量估算、层级柱状图、对标比较
├── scripts/
│   ├── generate-data.js        # 数据生成管线
│   ├── dict-cache.json         # 词典 API 释义缓存（可断点续传）
│   └── words_alpha.txt         # 备用词表（未使用，已被 subtlex 替代）
└── node_modules/
    └── subtlex-word-frequencies # SUBTLEXus 词频数据（74,286 词）
```

### 数据流

```
SUBTLEXus 词频表 (74K 词, 按频率排序)
    │
    ▼ 按频率排名分配到 11 个 band
    │
    ▼ 每层均匀间隔取样 ~500 词 (step = totalWords / 500)
    │
    ▼ Free Dictionary API 获取英文释义 (缓存到 dict-cache.json)
    │
    ▼ 生成六选项题目 (A 型 ~70%: 正确释义在选项中; B 型 ~30%: 无正确释义，答案为"以上意思都不正确")
    │
    ▼ 写入 data/bands/band-{N}.json
    │
    ▼ 测试时 test-engine.js 从每层全量题目中随机抽 10 题
```

### 评分算法

```
词汇量 = Σ (每层正确率 × 该层词汇总数)

例：Band 7 (10K-15K, 5000词) 答对 7/10
    → 该层估算 = 0.7 × 5000 = 3500
    → 累加到总词汇量
```

### 数据格式

**data/config.json**:
```json
{
  "bands": [
    {
      "id": 1,
      "range": [1, 1000],
      "label": "1-1K",
      "totalWords": 1000,
      "questionsPerBand": 10,
      "benchmarks": { "高考英语": 3500, "CET-4": 4500, ... }
    }
  ],
  "totalVocabulary": 40000,
  "questionsPerBand": 10
}
```

**data/bands/band-{N}.json**:
```json
{
  "band": 1,
  "range": [1, 1000],
  "label": "1-1K",
  "totalWords": 1000,
  "questions": [
    {
      "word": "good",
      "definition": "having the qualities that are desired or recommended",
      "correctIndex": 2,
      "options": [
        "extremely large in size or extent",
        "moving or done with excessive speed",
        "having the qualities that are desired or recommended",
        "relating to the night",
        "以上意思都不正确",
        "不认识"
      ]
    },
    {
      "word": "what",
      "definition": "which thing or things",
      "correctIndex": 4,
      "options": [
        "(heading) Employment.",
        "Substance, material.",
        "An advertisement by which individuals attempt to meet others.",
        "Without humor or expression of happiness.",
        "以上意思都不正确",
        "不认识"
      ]
    }
  ]
}
```

> **题型说明**：`correctIndex` 为 0-3 时是 A 型题（正确释义在选项中）；为 4 时是 B 型题（无正确释义，答案为"以上意思都不正确"）。选项 5（"不认识"）永远不是正确答案。

## 关键设计决策

### 1. 词频数据源：SUBTLEXus（非启发式）

**决策**：使用 `subtlex-word-frequencies` npm 包（74,286 词，基于影视剧字幕语料库）的真实词频排名分配词层。

**否决方案**：基于词长/后缀/音节数的启发式规则。原因：词频与词长非线性相关，启发式会导致 ±3,000-5,000 词的系统性误差。

### 2. 层内取样：均匀间隔（非取前 N 个）

**决策**：每层按 `step = totalWords / targetPoolSize` 均匀间隔取样，覆盖整个频率区间。

**否决方案**：取每层前 200 个词。原因：会导致题目偏向该层高频端（最简单部分），考生正确率虚高，词汇量被系统性高估。

### 3. 抽题时机：运行时随机（非生成时固定）

**决策**：数据文件存储每层全部题目（~350 题/层），test-engine.js 在每次测试开始时从全量中随机抽 10 题。

**否决方案**：生成时固定 50 题。原因：固定题目会被记忆，且无法保证覆盖层内全部频率段。

### 4. 释义来源：Free Dictionary API

**决策**：使用 `api.dictionaryapi.dev` 获取英文释义，本地 JSON 缓存支持断点续传。

**局限**：高频词覆盖好，低频词（band 8-11）覆盖率约 60-70%。缓存目前约 5,400 条释义。

### 5. 防猜测机制：六选项 A/B 题型（非传统四选一）

**决策**：每题 6 个选项（4 个释义 + "以上意思都不正确" + "不认识"）。约 70% 为 A 型题（正确释义在选项中），约 30% 为 B 型题（4 个释义全错，正确答案为"以上意思都不正确"）。

**否决方案**：传统四选一。原因：排除法有效——用户排除 2 个明显错误选项后，在剩余 2 个中 50/50 猜测，导致词汇量被系统性高估。六选项 A/B 混合使排除法失效，用户必须真正认识单词才能作答。"不认识"选项将"主动承认不会"与"猜错"区分开，提供更干净的信号。

## 开发规范

### 代码风格

- **模块系统**：ESM（`import`/`export`），`package.json` 中 `"type": "module"`
- **前端**：原生 HTML + CSS + JavaScript，无框架、无构建工具
- **后端脚本**：Node.js，仅使用内置模块 + `subtlex-word-frequencies`
- **DOM 操作**：使用 `createElement`/`textContent` 安全构建 DOM，禁止 `innerHTML` 拼接动态数据
- **注释**：只在 WHY 不明显时添加，不写 WHAT 注释

### 数据生成规范

- 生成脚本必须支持断点续传（通过 `dict-cache.json`）
- 干扰项必须从同一 band 中选取，保证难度一致
- 选项顺序必须随机化（shuffle），correctIndex 跟随调整
- 每层目标 ~500 候选词，均匀间隔取样
- A/B 题型比例约 70%/30%，B 型题的 4 个释义必须都不等于正确释义

### 变更同步规范

- **文档同步**：任何影响题型、算法、数据格式、架构的变更，必须同步更新 AGENT.md 对应章节
- **测试同步**：新增或修改核心逻辑（generate-data.js、test-engine.js）时，必须同步新增或更新测试用例
- **测试通过**：提交前必须确保 `npm test` 全部通过
- **数据重新生成**：修改 generate-data.js 后必须运行 `npm run generate` 重新生成数据

### 测试规范

- 测试框架：vitest
- 测试文件放在 `tests/` 目录，命名为 `*.test.js`
- 核心逻辑必须有测试覆盖：题目生成（A/B 型比例、选项结构、correctIndex 有效性）、评分算法（正确率计算、词汇量估算）
- 运行 `npm test` 执行全部测试

### 运行命令

```bash
npm run generate    # 重新生成题库数据
npm test            # 运行测试
npm start           # 启动 Web 服务 (serve . -l 3000)
```

Web 应用访问地址：`http://localhost:3000/public/`

## TODO / 后续开发

### 高优先级

- [x] **防猜测题型**：已实现六选项 A/B 题型（4 释义 + "以上意思都不正确" + "不认识"），~70% A 型 / ~30% B 型
- [ ] **扩展题型**：当前仅支持英文释义匹配。需支持：
  - 中英配对（英文单词 → 中文翻译四选一）
  - 填空题（句子语境中选词）
  - 架构上需抽象出题类型接口，便于扩展
- [ ] **提升高频层数据质量**：Band 8-11 的释义覆盖率不足（~60-70%），考虑：
  - 引入 WordNet 作为备选释义源
  - 使用 Wiktionary dump 批量获取释义
  - 对极低频词允许更简洁的释义格式

### 中优先级

- [ ] **学术词汇补充**：SUBTLEXus 基于口语语料，学术词汇（如 photosynthesis, methodology）排名偏低。可叠加 COCA Academic 词频表做修正
- [ ] **词族处理**：当前同一词族的不同形态（happy/happiness/unhappy）作为独立词条，可能导致同一词根在不同 band 重复出现
- [ ] **题目质量审核**：自动检测并标记以下问题：
  - 干扰项与正确答案过于相似
  - 选项长度差异过大（暗示正确答案）
  - 释义过于生僻或含有超纲词汇

### 低优先级

- [ ] **移动端优化**：当前 CSS 有基本响应式，但未针对小屏深度优化
- [ ] **测试体验增强**：
  - 答题反馈（选对/选错的即时提示）
  - 题目回顾功能（测试结束后查看每题对错）
  - 进度提示（"剩余 X 题"）
- [ ] **更多对标参考**：TOEFL、GRE、Cambridge 系列等
- [ ] **数据持久化**：记录历史成绩、词汇量变化趋势
- [ ] **自适应模式**：作为可选的进阶测试模式，用 CAT 方法减少题量提高精度

## 已知局限

1. **SUBTLEXus 语域偏差**：基于影视剧字幕，偏口语/日常，学术词汇排名可能偏低
2. **专有名词残留**：少量专有名词（如 knox, dora）通过过滤器进入题库，但被词典 API 释义环节大部分过滤
3. **释义风格**：Free Dictionary API 的释义偏正式/词典化，对低水平学习者可能不够友好
4. **干扰项质量**：随机选取的干扰项偶尔可能与正确答案语义相近，降低题目区分度
