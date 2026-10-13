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

## 可选 GitHub 工作流

npm release 工作流需要手动启动，在 Use workflow from 中选择已包含工作流的版本标签。不能从分支发布，避免 npm provenance 记录的提交与安装包来源不一致。publish 默认 false，先运行验收、生成可下载安装包，并执行 dry-run。

实际仓库元数据仅在发布检出中根据 GITHUB_REPOSITORY 生成，本地不填写虚构地址。release:check 的 --prepare 是明确的写入操作，需要真实 owner/repo。

以后启用实际发布时，在 npm 为 meshquilt 配置 GitHub trusted publisher，填写真实 owner/repo、release.yml 和 npm-release 环境。publish 勾选后才会运行发布，使用 OIDC 和 provenance，不在源码存放令牌。首次发布或所有权设置可能需要先在 npm 单独完成。

仅添加这些本地文件不会配置远程、推送标签或发布包。
