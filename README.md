# 日报 / 周报经营数据看板

一个面向经营分析场景的数据仪表盘。项目从 MySQL 的 `日报`、`周报`表生成静态 JSON 快照，再由 Next.js 展示活跃、留存、收入、付费和业务转化等指标。

默认情况下无需连接数据库：仓库已经包含可直接运行的示例快照。

## 核心能力

- 日报与周报视图切换
- 指定日期查看及跨日期数据对比
- 经营总览、留存与活跃、收入与付费、业务转化四类分析页面
- KPI 卡片、趋势图、分布图和阶段转化展示
- 次日、7 日、14 日留存成熟窗口处理
- 桌面端与移动端响应式布局
- 静态数据快照，部署环境无需直连生产数据库

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端框架 | Next.js 15、React 19、TypeScript |
| 数据可视化 | ECharts |
| 动效与图标 | Motion、Lucide React |
| 数据同步 | Python、MySQL |
| 测试 | Vitest、Playwright |
| 包管理器 | pnpm 10.12.1 |

## 数据链路

```mermaid
flowchart LR
    A["MySQL<br/>日报 / 周报"] -->|只读同步| B["scripts/sync_data.py"]
    B --> C["data/*.json<br/>静态快照"]
    C --> D["Next.js"]
    D --> E["经营数据看板"]
```

数据库只参与生成快照。应用构建和运行时直接读取 `data/`，不会向数据库发起请求。

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- Corepack
- pnpm 10.12.1（由项目锁定）

### 使用仓库快照运行

```powershell
corepack enable
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

生产模式运行：

```powershell
pnpm build
pnpm start
```

## 刷新数据

只有需要从 MySQL 重新生成快照时，才需要配置 Python 和数据库连接。

### 1. 安装 Python 依赖

```powershell
python -m pip install -r database/requirements.txt
```

### 2. 创建本地配置

复制示例配置：

```powershell
Copy-Item database/.env.example database/.env
```

在 `database/.env` 中填写本地连接信息：

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=edu_company
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_CHARSET=utf8mb4
```

`database/.env` 仅用于本地环境，禁止提交到 Git。

### 3. 同步并校验快照

```powershell
pnpm data:sync
pnpm data:check
```

`data:sync` 只读查询 `日报`、`周报`表，并更新：

- `data/daily.json`
- `data/weekly.json`
- `data/metric-catalog.json`
- `data/data-metadata.json`

完成后建议执行：

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## 指标口径

- 日报按自然日展示。
- 周报以源表 `当周周一` 为周期，只能选择快照中已有的周一。
- 次日、7 日、14 日留存遵守成熟窗口；未成熟数据展示为“待成熟”，不会把尾部零值视为真实下降。
- 转化链路优先使用源表已有转化率或项目既有指标逻辑，不假设曝光、点击、商详等阶段严格包含。
- 指标定义以 `scripts/metric_catalog.py` 为源头，通用计算与格式化逻辑集中在 `lib/metrics.ts`。

## 质量检查

```powershell
# TypeScript 类型检查
pnpm typecheck

# Vitest 单元测试
pnpm test

# 静态快照校验
pnpm data:check

# 生产构建
pnpm build

# Playwright 端到端测试（需先完成生产构建）
pnpm test:e2e
```

测试重点覆盖无效分母、空值、百分比格式、周期排序、留存成熟窗口、日报/周报切换和响应式交互。

## 项目结构

```text
.
├─ app/                 # Next.js 页面、布局和全局样式
├─ components/          # 仪表盘与图表组件
├─ data/                # 日报、周报、指标目录与元数据快照
├─ database/            # MySQL 连接与只读查询工具
├─ lib/                 # 类型、指标计算与格式化逻辑
├─ scripts/             # 数据同步、指标目录和快照校验脚本
└─ tests/               # Vitest 与 Playwright 测试
```

## 部署

项目可直接部署到 Vercel：

1. 将仓库导入 Vercel。
2. 保持默认 Next.js 构建配置。
3. 确认待发布的数据快照已经提交到 `data/`。
4. 部署生产分支；Pull Request 可使用 Preview Deployment 验证。

部署环境不需要数据库凭据。刷新数据应在受控环境中完成，校验后再提交生成的快照。

## 安全说明

- 不要提交任何 `.env`、密码、Token 或 API Key。
- 不要在日志、Issue 或 Pull Request 中粘贴真实数据库凭据。
- `pnpm data:sync` 的用途仅限只读同步，不应改为写库操作。
- 数据库写入、DDL、删除和权限变更不属于看板的数据刷新流程。

