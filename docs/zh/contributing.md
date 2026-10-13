# 参与贡献

需要 Node.js22.12+、24+或26+，pnpm10.33.0。运行 pnpm install，官网用 pnpm site。

## 验证

```bash
pnpm check
pnpm test
pnpm test:packages
pnpm test:release
pnpm --filter meshquilt exec playwright install chromium
pnpm test:workers
pnpm site:test
pnpm build
```

TypeScript7构建/检查类型，TypeScript6供 ESLint 使用。编辑 packages/meshquilt/src/runtime/worker.ts 后重新构建生成经典 Worker。Three.js示例及最低版本测试独立在 examples/three，不随库发布。

## 提交与发布

使用简短英文 Conventional Commit。更新根工作区与唯一发布包 packages/meshquilt 的版本，维护 CHANGELOG，在CI通过后创建v*标签。发布前补齐真实仓库元数据与npm发布配置。

报告缺陷和建议用 GitHub Issues；安全问题遵循 SECURITY.md。同步更新官网中英文内容。

发布前运行 pnpm release:check vX.Y.Z，校验工作区/库版本、标签以及已归档的发布说明。发布工作流需要手动启动，默认只生成安装包并 dry-run；本地不需要远程地址。详见[本地发布准备](releasing.md)。
