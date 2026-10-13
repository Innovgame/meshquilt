# 本地发布准备

项目可以完全在本地开发、构建和打包。没有配置远程仓库，也没有执行 npm 发布。唯一可发布包是 packages/meshquilt。

## 本地验收与打包

```bash
pnpm check
pnpm test
pnpm test:release
pnpm test:packages
pnpm test:workers
pnpm site:test
pnpm build
```

test:packages 在临时独立项目中安装生成的包，检查根、Draco、Worker 入口、LICENSE、类型声明，以及不依赖 Three.js 的行为，不上传 npm。

在仓库根目录运行下列命令可保留本地压缩包：

```bash
pnpm --filter meshquilt pack --pack-destination .tmp/release
```

## 发布版本校验

将 Unreleased 下的内容归档到目标版本，并同步根工作区与库的版本。该版本必须有非空更新说明。然后运行：

```bash
pnpm release:check v0.1.1
```

普通校验只读，不修改文件。它拒绝标签/版本不一致、错误包名、私有包、未归档变更或缺失发布说明。稳定版本使用 latest，预发布版本使用 next。不要把 Unreleased 改动发布到已有标签下，先归档到目标版本。

## 发布工作流

`.github/workflows/release.yml` 必须从已有的 `vX.Y.Z` 标签运行，从分支启动会失败。发布对应的 GitHub Release 时会写入注册源。手动运行默认只做 dry-run，勾选 `publish` 才会真正发布。

打包任务确认标签属于 `main`，运行库检查，并根据 `GITHUB_REPOSITORY` 写入仓库元数据，然后生成两个安装包。npm 发布 `meshquilt`。GitHub Packages 只接受与仓库所有者同名的 scope，因此发布 `@<owner>/meshquilt`。源码中的包名仍是 `meshquilt`。

注册源发布使用 `npm-release` 环境。npm 使用仓库密钥 `NPM_TOKEN`，并请求 provenance。GitHub Packages 使用 `GITHUB_TOKEN`。令牌不写入源码。需要审批时再给该环境添加 reviewer。

仅添加这些本地文件不会启动工作流、配置远程、推送标签或发布包。
