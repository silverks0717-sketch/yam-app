# YAM

YAM 是一个可公网访问、可注册登录、可云端同步、可下载 Android 安装包、可作为 iPhone / iPad PWA 使用的健康记录系统。

当前这一版已经具备：

- 官网级首页与下载站
- 用户端 Web / Android / PWA 入口
- 管理员后台
- 用户与管理员严格分流的注册登录
- 饮食 / 训练 / 身体数据云端同步
- 登录页下方明确的 iPhone / iPad / Android 入口与可复制链接
- 版本检查与更新提示
- 多端适配：手机 / 折叠屏 / iPad / 桌面端

## 当前产品结构

- 官网首页：`/`
- 登录与注册：`/auth`
- 用户端：`/app`
- 管理后台：`/admin`
- 下载页：`/install`
- 隐私页：`/privacy`
- 版本接口：`/version`
- 固定 APK 地址：`/downloads/latest.apk`

## 这次已经完成的重点

### 品牌与视觉

- 界面展示名称统一为 `YAM`
- 首页首屏改成沉浸式动态背景
- 进入节奏改成：
  1. 先只有背景
  2. 约 1.4 秒后 `YAM` 浮现
  3. 再过约 0.5 秒四个入口按钮浮现
- 首页第二屏才展示产品介绍、下载与使用说明

### 身份与权限

- 角色分为 `user` 和 `admin`
- 用户登录后只能进入用户端
- 管理员登录后只能进入管理员后台
- 管理员注册必须填写密钥：`88888888`
- 注册时必须选择性别：`男 / 女`
- 登录后左上角显示当前用户头像，不再显示统一 App 图标

### 数据与同步

- PostgreSQL + Prisma
- JWT + Refresh Token
- 数据严格按 `userId` 隔离
- 用户登录后从云端拉取数据
- 写入时优先同步到 API，再刷新本地缓存
- 顶部提供同步状态提示

### PWA 与多端入口

- iPhone / iPad 通过 Safari + 添加到主屏幕作为 Web App 使用
- 登录页下方会展示可复制公开网址
- Android 继续使用固定 APK 下载地址
- iPad 与折叠屏展开态会自动切换双栏布局

### 分发与更新

- Android 固定下载地址：`/downloads/latest.apk`
- iPhone / iPad 可通过 Safari “添加到主屏幕” 作为 PWA 使用
- 客户端启动会请求 `/version`
- 如果版本落后，会出现全屏更新界面
- `forceUpdate = true` 时不能继续进入系统

## 项目目录

```text
codex试用/
├── android/                         Android 打包工程
├── prisma/
│   ├── schema.prisma               Prisma 数据模型
│   ├── init.sql                    初始化数据库 SQL
│   └── seed.mjs                    可选的本地管理员种子脚本
├── public/
│   ├── index.html                  官网首页
│   ├── auth.html                   四条独立登录 / 注册入口
│   ├── app.html                    用户端应用
│   ├── admin.html                  管理后台
│   ├── install.html                下载页
│   ├── privacy.html                隐私说明页
│   ├── manifest.webmanifest        PWA 清单
│   ├── sw.js                       Service Worker
│   ├── site.js                     首页与下载页交互
│   ├── auth.js                     登录注册逻辑
│   ├── app.js                      用户端逻辑
│   ├── admin.js                    管理后台逻辑
│   ├── avatar-utils.js             品牌图标与性别头像规则
│   ├── version-check.js            版本检查与强更拦截
│   ├── storage.js                  云端同步与本地缓存
│   ├── analytics.js                趋势与双周回顾
│   ├── charts.js                   图表渲染
│   ├── export-data.js              Excel 导出数据拼装
│   ├── generated-version.js        当前前端版本号
│   ├── version.json                发布版本清单
│   ├── assets/
│   │   ├── avatars/                男女头像资源
│   │   └── icon/                   App / PWA / favicon 图标
│   └── downloads/
│       ├── latest.apk              固定下载地址
│       └── YAM.apk                 人工分发文件名
├── release/
│   └── release.config.json         发布更新日志源文件
├── scripts/
│   └── generate-version.mjs        自动生成版本清单
├── src/server/
│   ├── app.js                      Express 服务入口
│   ├── config.js                   环境变量与服务配置
│   ├── lib/
│   │   ├── auth.js                 JWT / 刷新令牌 / 密码哈希
│   │   ├── dataset.js              用户数据映射
│   │   ├── excel.js                Excel 导出
│   │   └── prisma.js               Prisma Client
│   ├── middleware/
│   │   └── auth.js                 用户 / 管理员鉴权
│   └── routes/
│       ├── auth.js                 注册 / 登录 / 刷新 / 退出
│       ├── data.js                 用户数据同步与 CRUD
│       ├── admin.js                管理后台统计 / 详情 / 状态
│       └── public.js               官网版本与下载信息
├── .env
├── .env.example
├── capacitor.config.ts
├── package.json
├── server.js
└── start.command
```

## 数据模型

当前核心表：

- `users`
- `user_sessions`
- `meals`
- `trainings`
- `body_metrics`
- `exports`
- `admin_logs`
- `activity_logs`

关键字段：

- 用户：`role`、`status`、`gender`
- 饮食：日期、时间、餐别、食物名称、份量、高热量、应酬/喝酒、备注
- 训练：日期、时间、训练名称、训练时长、动作内容、重量、次数、组数、备注
- 身体：日期、体重、腰围、体脂率、骨骼肌含量

## 本地初始化

### 1. 安装依赖

```bash
npm install
```

### 2. 创建数据库

```bash
createdb yam_plan
```

### 3. 准备环境变量

```bash
cp .env.example .env
```

默认开发连接串已经写成：

```env
DATABASE_URL="postgresql://你的本机用户名@localhost:5432/yam_plan?schema=public"
```

如果你换机器，把用户名改成当前 macOS 用户名即可。

### 4. 初始化数据库

```bash
npm run db:generate
psql yam_plan -f prisma/init.sql
```

### 5. 关于账号

这一版不会自动创建任何账号。

旧用户和旧管理员应该已经清空，系统默认从“重新注册”开始。

推荐方式：

- 直接打开官网首页
- 走“管理员注册”
- 输入管理员密钥 `88888888`
- 完成首个管理员创建

如果你只是本地开发，也可以手动执行：

```bash
npm run db:seed
```

这个脚本只用于本地调试，不是产品默认流程。

## 本地启动

### 终端启动

```bash
npm start
```

### 开发模式

```bash
npm run dev
```

启动后默认地址：

- 官网：[http://localhost:4321/](http://localhost:4321/)
- 登录页：[http://localhost:4321/auth](http://localhost:4321/auth)
- 用户端：[http://localhost:4321/app](http://localhost:4321/app)
- 管理后台：[http://localhost:4321/admin](http://localhost:4321/admin)
- 下载页：[http://localhost:4321/install](http://localhost:4321/install)
- 版本接口：[http://localhost:4321/version](http://localhost:4321/version)

## 登录与注册规则

四条入口严格独立：

- 用户登录：只显示账号 / 密码 / 进入用户端
- 用户注册：只显示用户名 / 邮箱 / 密码 / 性别 / 创建用户账号
- 管理员登录：只显示账号 / 密码 / 进入总控后台
- 管理员注册：只显示用户名 / 邮箱 / 密码 / 性别 / 管理员密钥 / 创建管理员账号

管理员密钥固定为：

```text
88888888
```

## iPhone / iPad 使用方式

登录页下方会直接给出公开网址和复制按钮。

### iPhone

1. 用 Safari 打开登录页给出的公开网址
2. 点击分享按钮
3. 点击“添加到主屏幕”
4. 如果系统显示，选择“Open as Web App”
5. 添加后即可像 App 一样打开使用

### iPad

1. 用 Safari 打开登录页给出的公开网址
2. 点击分享按钮
3. 点击“添加到主屏幕”
4. 如果系统显示，选择“Open as Web App”
5. 添加后即可像 App 一样打开使用

## 版本更新系统

服务端提供：

- `GET /version`

返回内容包括：

- `latestVersion`
- `forceUpdate`
- `downloadUrl`
- `webUrl`
- `changelog`

客户端启动后会自动检查版本：

- Android：更新时跳转 `/downloads/latest.apk`
- iPhone / iPad：更新时跳转最新 Web / PWA 入口
- 如果 `forceUpdate = true`，则只能更新，不能继续进入系统

## Android 构建

### 同步前端到 Android

```bash
npm run android:sync
```

### 构建 APK

```bash
npm run android:build
```

构建产物：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### 发布到下载目录

```bash
npm run apk:publish-local
```

执行后会同步生成：

- `public/downloads/latest.apk`
- `public/downloads/YAM.apk`

## 部署建议

仓库里已经补好这些上线骨架：

- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `/healthz` 健康检查
- 静态资源缓存策略
- `PUBLIC_APP_ORIGIN` 公开域名配置

也就是说，这一版已经不是只能在本地开发机里跑的结构，而是已经具备：

- 一个 Node 服务
- 一个 PostgreSQL 数据库
- 一个静态下载目录
- 一个可长期分享的 HTTPS 部署骨架

推荐公开地址：

- 官网：`https://你的域名/`
- 用户端：`https://你的域名/app`
- 后台：`https://你的域名/admin`
- API：`https://你的域名/api/*`
- APK：`https://你的域名/downloads/latest.apk`

登录页下方的 iPhone / iPad / Android 复制链接，会直接读取 `PUBLIC_APP_ORIGIN` 和下载地址来生成。

上线前至少确认：

- HTTPS 已接好
- `DATABASE_URL` 正确
- `JWT_SECRET` 改成正式强随机值
- `PUBLIC_APP_ORIGIN` 设置成正式 HTTPS 域名
- 管理员密钥只掌握在可信范围内
- APK 下载目录稳定可访问

## 当前不在第一阶段范围内

- 手机号登录
- 邮箱验证码
- 邀请码
- 社交关系
- 推送通知
- App Store 上架
- 复杂离线冲突合并
- 多租户 / 多组织

## 推荐下一步

1. 接正式域名和云数据库
2. 创建首个正式管理员账号
3. 做一轮真实用户试用
4. 继续补管理员筛选与运营视图
5. 再做 release 签名 APK 与更细更新策略
