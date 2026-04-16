# YAM 上 Render 的最简单方式

你可以把 Render 理解成：

“把这个项目放到公网，别人打开网址就能直接进官网”的平台。

对这个项目来说，最省事的路径是：

1. 先把项目传到 GitHub
2. 再让 Render 读取 GitHub 仓库
3. Render 会按仓库里的 `render.yaml` 自动创建：
   - 一个网站服务
   - 一个 PostgreSQL 数据库

## 你只需要做的事

### 第 1 步：注册 GitHub

打开：

https://github.com/

如果没有账号，就先注册一个。

### 第 2 步：在 GitHub 新建仓库

建议仓库名：

`yam-app`

创建时：

- 选择 Public 或 Private 都可以
- 不要勾选 README
- 不要勾选 .gitignore
- 不要勾选 License

### 第 3 步：把本地项目推到 GitHub

在项目目录打开终端，运行：

```bash
git init -b main
git add .
git commit -m "Deploy YAM to Render"
git remote add origin https://github.com/你的GitHub用户名/yam-app.git
git push -u origin main
```

如果终端让你登录 GitHub，就按提示登录。

注意：

- 我已经帮你加了 `.gitignore`
- APK 文件不会被错误地推到 GitHub
- 网站先上线没问题
- APK 后面可以继续用单独文件分发路径接上

### 第 4 步：注册 Render

打开：

https://render.com/

最简单的方式：

- 点击 `Get Started`
- 直接用 GitHub 账号登录

### 第 5 步：在 Render 里创建 Blueprint

登录后：

1. 点击 `New +`
2. 选择 `Blueprint`
3. 选择你刚刚上传的 GitHub 仓库 `yam-app`
4. Render 会自动识别仓库根目录里的 `render.yaml`

这个项目已经配好了：

- Web 服务
- PostgreSQL 数据库
- 健康检查
- Docker 构建

### 第 6 步：填写首次部署信息

Render 第一次会让你确认几个东西：

- `JWT_SECRET`
  直接让它自动生成或者填一串随机字符
- `ADMIN_PASSWORD`
  填你自己想要的管理员密码

其余大部分配置已经在仓库里准备好了。

### 第 7 步：点创建并等待部署

创建后 Render 会开始：

1. 拉 GitHub 仓库
2. 建数据库
3. 构建网站
4. 发布到公网

完成后你会得到一个这样的正式网址：

`https://yam-web.onrender.com`

或类似的 `onrender.com` 地址。

这时候别人就能直接打开这个网址进入 YAM 官网了。

## 上线后你该怎么用

### 官网入口

```text
https://你的-render-网址/
```

### 登录页

```text
https://你的-render-网址/auth
```

### iPhone / iPad 使用

把上面的登录页链接发给别人即可。

对方在 Safari 里打开后：

1. 点击分享按钮
2. 点击“添加到主屏幕”
3. 如果系统显示，选择 “Open as Web App”
4. 添加后就能像 App 一样使用

### Android 下载入口

```text
https://你的-render-网址/downloads/latest.apk
```

## 你现在最需要做的一件事

先完成这两个外部动作：

1. 注册 GitHub
2. 注册 Render（直接用 GitHub 登录）

只要你把 GitHub 仓库网址给我，或者告诉我你已经把仓库建好了，我下一步就能继续替你往下接。
