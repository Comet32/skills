# skills

[English](README.md) | 简体中文

我自己写、自己在用的全局 agent skill。每个 skill 是 `skills/<name>/SKILL.md`，遵循开放的 Agent Skills 格式，支持这一格式的 agent 客户端都能安装。

## 安装

```bash
npx skills add Comet32/skills
```

安装器会让你选要装哪些 skill、装进哪些客户端。常用参数：

| 想做的事 | 写法 |
|---|---|
| 先看有哪些 skill | `npx skills add Comet32/skills --list` |
| 只装其中一个 | `npx skills add Comet32/skills --skill ambitious` |
| 装到全局，所有项目可用 | 加 `-g` |
| 指定客户端 | 加 `-a claude-code codex cursor` |

安装器是 [vercel-labs/skills](https://github.com/vercel-labs/skills)，它支持的客户端和各自的目录见其文档。

## Skills

| Skill | 做什么 | 客户端 |
|---|---|---|
| [`ambitious`](skills/ambitious/SKILL.md) | 把一个任务或 prompt 沿高度、深度、广度三个方向升级成更有雄心的版本。先交付方案并停下等你选方向，确认后再执行；宣告完成前必须跑外部裁判。用 `/ambitious <任务>` 调用。skill 本身用英文写，回复跟随你使用的语言 | 全部 |
| [`grill-afk`](skills/grill-afk/SKILL.md) | 自动运行的需求拷问：用红队循环代替逐条问人，产出一份 PRD，加上一份只有人能回答的问题清单 | 全部；其中的子代理分工按 Claude Code 写，其他客户端可能退化为单线程执行 |
| [`sync-mattpocock-skills`](skills/sync-mattpocock-skills/SKILL.md) | 把 mattpocock/skills 同步到最新上游，重新应用本地补丁，并总结上游变化 | 仅 Claude Code。标为 internal，`npx skills add` 默认不会列出它 |

这几个 skill 都只在你明确调用时运行。Claude Code 靠 `disable-model-invocation` 保证这一点；其他客户端不认这个字段，靠 description 里的说明约束。

## 在自己的机器上开发

```bash
git clone git@github.com:Comet32/skills.git ~/Documents/GitHub/skills
~/Documents/GitHub/skills/scripts/link.sh --check
~/Documents/GitHub/skills/scripts/link.sh
```

`link.sh` 把 `skills/` 下的每个 skill 软链接到本机已安装客户端的全局 skill 目录，并把 `third-party/mattpocock/` 链接为 `~/.claude/skills-sync`。之后改仓库就是改已安装的 skill。已经存在、且不是本仓库软链接的目标不会被覆盖，只会被报告出来。新增 skill 后再跑一次即可。

## 依赖的第三方 skills

第三方 skill 不复制进本仓库，原因见 [ADR 0001](docs/adr/0001-第三方-skill-不复制进仓库.md)。新机器上按需安装：

| 来源 | 安装 | 内容 |
|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills) | `third-party/mattpocock/sync.sh`，之后用 `/sync-mattpocock-skills` 升级 | `manifest` 中列出的 36 个 skill，加上 `patches/` 里的本地补丁；只装进 Claude Code |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `npx skills add Leonxlnx/taste-skill -g` | 前端设计品味系列，13 个 |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | `npx skills add heygen-com/hyperframes -g` | HyperFrames 视频制作系列，11 个 |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | `npx skills add vercel-labs/skills --skill find-skills -g` | `find-skills` |

## 目录结构

```
skills/<name>/SKILL.md     自建 skill，安装器从这里发现
third-party/mattpocock/    mattpocock/skills 的同步脚本、清单和本地补丁
scripts/link.sh            作者本机的软链接安装
GLOSSARY.md                术语
docs/adr/                  设计决定
```

## License

[MIT](LICENSE)
