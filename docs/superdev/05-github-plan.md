# GitHub 发布清单

## 当前阻塞

本机没有 `gh` 命令，无法直接用 GitHub CLI 创建远程仓库。

## 建议仓库

```text
codex-reset-radar
```

## 发布前整理

- 保留 `codex-reset-radar/` 为项目代码目录。
- 保留 `output/codex-reset-radar-project/` 为 Super Dev 文稿。
- 不提交 `node_modules/`。
- 不提交 Cloudflare token、X token。
- `worker/wrangler.toml` 中 KV id 用占位或项目实际 id。

## 推荐远程

```bash
git init
git add codex-reset-radar output/codex-reset-radar-project
git commit -m "Build Codex reset radar"
git remote add origin git@github.com:<user>/codex-reset-radar.git
git push -u origin main
```

如果提供 GitHub 远程地址或安装 `gh`，可以直接推送。
