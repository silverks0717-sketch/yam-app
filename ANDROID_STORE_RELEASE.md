# YAM Android / 华为上架准备

这份清单对应当前仓库的正式发布配置，目标是同时服务：

- Google Play
- 华为 AppGallery
- 自有官网 APK 分发

## 当前正式地址

- 官网：`https://yam-web.onrender.com/`
- 用户登录：`https://yam-web.onrender.com/auth/user-login`
- 用户注册：`https://yam-web.onrender.com/auth/user-register`
- 隐私政策：`https://yam-web.onrender.com/privacy`

## 包名与版本

- 当前包名：`com.yam.app`
- Android 版本名：自动读取 `package.json` 的 `version`
- Android 版本号：按 `major * 10000 + minor * 100 + patch` 自动生成

发布前只要提升仓库版本，例如：

```bash
npm version 1.1.1 --no-git-tag-version
```

随后重新执行：

```bash
npm run release:prepare
npm run android:store:build
```

## 先配置签名

1. 把你的发布密钥放进 `android/keystores/`
2. 复制 `android/keystore.properties.example` 为 `android/keystore.properties`
3. 写入真实密钥信息

示例：

```properties
storeFile=./keystores/yam-upload.keystore
storePassword=你的store密码
keyAlias=yam-upload
keyPassword=你的key密码
```

## 生成上架包

Google Play / 华为统一产物命令：

```bash
npm run android:store:build
```

构建完成后，会自动把产物整理到：

```text
release/android/
```

常见文件：

- `yam-1.1.0-release.aab`
- `yam-1.1.0-release.apk`

## 发布建议

- Google Play：优先上传 `AAB`
- 华为 AppGallery：保留 `AAB` 与 `APK` 两种产物，按控制台要求选择
- 官网分发：继续保留 `APK`

## 跨设备账号注意

电脑端如果之前注册在 `localhost` 本地环境，那是本机数据库，不会自动出现在正式云端。

从现在开始，请统一使用正式地址注册和登录：

```text
https://yam-web.onrender.com/auth/user-register
https://yam-web.onrender.com/auth/user-login
```

这样电脑和手机会走同一套线上账号库。
