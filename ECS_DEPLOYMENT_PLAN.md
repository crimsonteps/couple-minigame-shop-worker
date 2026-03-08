# ECS 部署指南

这份项目已经可以直接部署到普通 ECS，不再需要平台专有运行时。

当前后端运行方式：
- Node.js HTTP 服务
- 原生 WebSocket
- 本地 SQLite 文件持久化

## 服务器前提

推荐环境：
- Ubuntu 22.04
- Node.js 22+
- 开放安全组端口 `8787`

如果你后面要挂域名或 HTTPS，再额外开放：
- `80`
- `443`

## 上传代码到 ECS

方式任选其一：
- `git clone`
- `scp` 上传项目目录
- 压缩包上传后解压

假设项目放在：

```bash
/opt/couple-minigame-shop-worker
```

## 首次部署

进入项目目录：

```bash
cd /opt/couple-minigame-shop-worker
```

安装依赖：

```bash
npm install
```

构建：

```bash
npm run build
```

启动：

```bash
HOST=0.0.0.0 PORT=8787 npm run start
```

启动成功后，默认数据库文件会自动创建在：

```bash
data/couple-home.sqlite
```

## 访问方式

直接用你的 ECS 公网 IP 访问：

- `http://47.111.27.3:8787/?user=yzy`
- `http://47.111.27.3:8787/?user=wh`

健康检查：

- `http://47.111.27.3:8787/api/health`

## 建议的持久化方式

如果你不想把数据库放在项目目录里，可以改成独立路径：

```bash
HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/var/lib/couple-home/couple-home.sqlite npm run start
```

这样做更稳，原因很直接：
- 项目代码升级时不容易误删数据库
- 数据和代码目录分离

## 建议的上线流程

推荐顺序：

1. 本地开发和调试
2. `npm run build`
3. 上传到 ECS
4. 在 ECS 上执行 `npm install`
5. 执行 `npm run build`
6. 用 `HOST=0.0.0.0 PORT=8787 npm run start` 启动
7. 放行安全组 `8787`
8. 用公网 IP 验证页面和接口

## 后续建议

当前先用最简单的单进程方式跑就够了，因为你的用户只有两个人。

如果后面要长期运行，再继续补这些：
- `systemd` 守护进程
- Nginx 反向代理
- 域名解析
- HTTPS 证书
- 定时备份 SQLite
