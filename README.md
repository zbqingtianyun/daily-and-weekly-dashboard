# 日报 / 周报数据仪表盘

基于 MySQL `日报`、`周报`表生成静态数据快照，并以 Next.js 构建可部署到 Vercel 的经营数据仪表盘。

## 本地运行

```powershell
corepack enable
pnpm install
pnpm data:sync
pnpm dev
```

打开 `http://localhost:3000`。

## 更新数据

```powershell
pnpm data:sync
pnpm data:check
pnpm build
git add data
git commit -m "refresh dashboard data"
git push
```

数据同步只读取 `日报`和`周报`，不会修改数据库。周报周期取自`当周周一`列。数据库配置保存在 `database/.env`，禁止提交。

## 指标口径

- 日报：自然日指标。
- 周报：以`当周周一`为周期，仅可选择源表中已有的周一。
- 次日、7 日、14 日留存在成熟窗口内显示“待成熟”，不把尾部补零当作真实下降。
- 三条业务链路使用阶段条与源表已有转化率，不假设曝光、点击、商详等阶段严格包含。

## 部署

将 GitHub 仓库导入 Vercel。生产分支使用 `main`，PR 自动生成 Preview Deployment。

