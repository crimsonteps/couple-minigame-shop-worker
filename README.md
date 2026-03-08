# Oh Kahn小游戏积分商城网站

一个只服务固定两位用户 `yzy` 和 `wh` 的双人互动小游戏积分商城项目。

当前仓库已经改为可直接运行在普通服务器上的版本，适合：
- 本地开发和调试
- 上传到 ECS 运行
- 使用本地 SQLite 文件持久化数据

## 当前能力

- 固定房间：`couple-home`
- 固定用户：`yzy`、`wh`
- 先选用户，再进入主页面
- 双人联机方式：原生 WebSocket
- 目前已实现 3 个小游戏：
  - 猜拳
  - 默契问答
  - 猜数字
- 胜负判定、积分结算、库存扣减全部由服务端完成
- 首页展示双方积分、在线状态、最近战绩、最近兑换记录
- 商城页展示礼物、参考价和兑换按钮
- 记录页展示全部小游戏记录和兑换记录
- 所有积分、库存、记录写入本地 SQLite

## 技术栈

- TypeScript
- Node.js
- SQLite
- 原生 WebSocket
- 原生 HTML + CSS + TypeScript
- 无 React / Vue / Next.js
- 无传统数据库

## 目录结构

```text
src/
  api/
  frontend/
  room/
  shared/
  app-context.ts
  index.ts
scripts/
  build-frontend.mjs
  build-server.mjs
package.json
README.md
ECS_DEPLOYMENT_PLAN.md
```

核心目录说明：
- `src/index.ts`：Node.js 服务入口
- `src/api/`：HTTP API
- `src/room/`：房间状态、游戏逻辑、积分和商城服务
- `src/room/games/`：各小游戏结算逻辑
- `src/room/storage/sqlite-storage.ts`：SQLite 存储适配层
- `src/frontend/`：选用户页、首页、商城页、记录页
- `src/shared/`：共享类型、协议、常量、工具函数
- `scripts/build-frontend.mjs`：前端构建脚本
- `scripts/build-server.mjs`：服务端构建脚本

## 本地开发

先安装依赖：

```bash
npm install
```

启动本地开发：

```bash
npm run dev
```

这个命令会同时做两件事：
- 监听并构建前端到 `public/`
- 用 `tsx` 启动 Node.js 服务

本地访问方式：
- `http://127.0.0.1:8787/`：用户选择页
- `http://127.0.0.1:8787/index.html?user=yzy`：以 `yzy` 进入首页
- `http://127.0.0.1:8787/index.html?user=wh`：以 `wh` 进入首页

常用接口：
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/shop`
- `GET /api/records`
- `GET /ws?user=yzy`

## 构建和启动

执行完整构建：

```bash
npm run build
```

生产启动：

```bash
npm run start
```

默认配置：
- 服务监听：`0.0.0.0:8787`
- 数据库文件：`data/couple-home.sqlite`

可选环境变量：
- `HOST`：服务监听地址
- `PORT`：服务端口
- `DATA_DIR`：SQLite 数据目录
- `DATABASE_PATH`：SQLite 文件完整路径，优先级高于 `DATA_DIR`

## 部署到 ECS

最短路径：

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=8787 npm run start
```

然后放行 ECS 安全组端口 `8787`，就可以直接访问：
- `http://你的服务器IP:8787/`
- 进入后先选 `yzy` 或 `wh`

更完整的部署说明见：
- `ECS_DEPLOYMENT_PLAN.md`

## 小游戏说明

1. 猜拳
- 同时出拳
- 胜利 `+10`
- 平局双方 `+2`

2. 默契问答
- 服务端随机抽一题Oh Kahn默契题
- 两个人都选到同一个答案：双方 `+6`
- 没选到同一个答案：双方各 `+1` 参与分

3. 猜数字
- 服务端随机生成 `1-20` 的目标数字
- 谁更接近谁得 `+8`
- 一样接近：双方各 `+3`

## 商城礼物

当前商城包含这些礼物：
- 奶茶
- 小蛋糕
- 抱抱券
- 晚餐加菜券
- 润唇膏
- 护手霜
- 巧克力小礼盒
- 可爱钥匙扣
- 暖暖贴小包

页面里会展示礼物参考价，当前选的都是尽量轻负担的小礼物或低成本互动项。

## 生成文件

以下目录和文件都不会提交到仓库：
- `node_modules/`
- `public/`
- `dist/`
- `data/`
- `.env*`
