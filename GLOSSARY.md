# Skills

Comet32 个人维护的 agent skill 集合，以及它所依赖的第三方 skill 的来源记录。

## Language

### 按来源

**自建 skill**:
由仓库作者自己编写的 skill。本仓库只存放这一类 skill 的本体。
_Avoid_: 私有 skill、个人 skill

**第三方 skill**:
从上游原样获取、内容未被作者改写的 skill。带有本地补丁的仍算第三方 skill。
_Avoid_: 外部 skill、依赖 skill

**改版 skill**:
以某个第三方 skill 为起点、内容已被作者实质改写、需要作者自己维护一份完整副本的 skill。必须注明上游出处。
_Avoid_: fork、魔改版

**本地补丁**:
作者对某个第三方 skill 的小幅修改，每次同步上游后重新应用。
_Avoid_: patch、定制

### 按作用范围

**全局 skill**:
安装在用户级目录、在所有项目中都可用的 skill。本仓库只收录全局 skill。
_Avoid_: 用户级 skill

**项目级 skill**:
存放在某个项目内部、只在该项目中可用的 skill。
_Avoid_: 本地 skill
