# 第三方 skill 不复制进仓库

本仓库只存放自建 skill 的本体，第三方 skill 只记录"从哪里来、怎么装"：mattpocock/skills 由 `third-party/mattpocock/` 下的清单、本地补丁和同步脚本管理，其他来源在 README 里列出安装命令。这样上游更新时不必在本仓库里合并大量与自己无关的改动，也不会把别人的作品当作自己的重新发布。代价是新机器要多跑几条安装命令，而且只有 mattpocock 这一路记录了所用的上游版本（`UPSTREAM_SHA`）。

## Considered Options

- **整份复制第三方 skill**：一次 clone 就能拿全，但每次上游更新都要手动合并，仓库噪音大增，重新分发前还要逐个核对许可证。
- **git submodule**：能锁定版本，但 mattpocock 的本地补丁没有地方放，而且 taste-skill、hyperframes 的 skill 只占各自仓库的一部分。
