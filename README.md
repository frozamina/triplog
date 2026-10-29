# 途迹 TripLog

基于提供的 PRD 与界面设计实现的离线 Android 出行手账。Android 8.0（API 26）及以上；应用包名固定为 `com.frozamina.triplog`。

[下载 APK 1.0.0](https://github.com/frozamina/triplog/raw/refs/heads/main/releases/TripLog-1.0.0.apk)

## 已实现

- 创建、编辑、草稿、删除行程，按月分组和搜索。
- 独立的通行段、换乘等待；完整日期时间，跨天、重叠校验；拖动和上下按钮排序。
- 交通方式、起终点、时间、花费、里程、班次、座位、备注和标签。
- 时间轴、门到门总耗时、通行/等待时长与占比、总花费、有效时速、每公里成本。
- 月度统计、方式效率、同 OD 历史方案均值比较与最快/最省/最省心标记。
- 模板复用、实时打卡、类型切换保留开始时间、重开后恢复计时。
- 系统文件选择器导出 JSON 备份、合并恢复、分段 CSV 和 PNG 行程卡片。
- 原生 SQLite 持久化与事务；更新/删除前保留旧版本，导入失败整批回滚。

界面为随 APK 打包的离线 HTML/CSS/JavaScript，Android 原生 Java 桥接 SQLite 和文件选择器。应用没有网络、定位和广泛文件读写权限。中文和数字采用本机字体回退，保证完全离线；不依赖外部字体服务。

## 安装与后续升级

1. 在安卓手机打开签名 APK 安装。系统可能要求允许该文件来源安装应用。
2. 后续直接打开新版 APK，选择更新。**不要先卸载，也不要清除应用数据。**
3. 始终沿用相同包名、相同签名证书，并递增 `versionCode`。
4. 数据库文件名固定 `triplog.db`，当前 schema 2；任何未来 schema 变动都必须在 `Store.onUpgrade` 增量迁移并验证旧数据。
5. “我的 → 导出 JSON 备份”可制作独立备份。手机损坏、重置、卸载或人为清数据无法靠 APK 更新机制避免，需通过备份恢复。

永久签名证书 SHA-256：
`a305517baa390cdbb8aa878cd269486bb073af8c93ce76539454e409f1d12b31`

**签名 JKS 和密码不在本仓库。** 请保存单独交付的签名备份包，不能丢失，也不能公开上传。更换密钥会导致现有安装无法直接覆盖升级。

## 构建

推荐 JDK 17+、Python 3、Android SDK platform 35 / build-tools 35.0.0。

```sh
export JAVA_HOME=/path/to/jdk
export ANDROID_HOME=/path/to/android-sdk
export TRIPLOG_KEYSTORE=/secure/path/triplog-release.jks
export TRIPLOG_STORE_PASSWORD='your-store-password'
export TRIPLOG_KEY_PASSWORD='your-key-password'
export TRIPLOG_VERSION_CODE=2
export TRIPLOG_VERSION_NAME=1.0.1
python scripts/build.py
```

Windows 使用 PowerShell `$env:变量名='值'` 设置同名环境变量。SDK 直接构建脚本无需第三方运行时依赖，产物在项目上一级目录；同时保留标准 Gradle 工程供 Android Studio 导入。

GitHub Actions 手动构建工作流需由仓库管理员配置三个 Secrets：`TRIPLOG_KEYSTORE_BASE64`、`TRIPLOG_STORE_PASSWORD`、`TRIPLOG_KEY_PASSWORD`。前者为现有 JKS 的 Base64 内容。工作流不会自动生成新密钥，避免后续覆盖安装签名变化。

## 验证

```sh
node tests/core.test.js
```

已验证核心时间/金额计算、跨天、重叠/负数拦截、模板复制、计时与 CSV 公式转义；本地浏览器流程覆盖创建、编辑、保存、模板、洞察、打卡切换、页面重载恢复和结束行程。APK 经 Android 官方 aapt2 / D8 构建、zipalign 对齐和 apksigner v2/v3 验签。

尚未连接安卓真机完成安装及覆盖安装测试。请按 `docs/RELEASE-CHECKLIST.md` 在目标手机验证原生文件选择器、后台恢复和覆盖升级。PRD 的 P2（OCR、年度报告、同行分摊）不在本版；标签支持自由编辑，尚未提供独立标签合并管理；超过 6 小时提供继续/手动编辑，未加入预计时间快捷结束。

## 数据与开发约束

- 禁止使用删表重建迁移，禁止自动降级，禁止启动时写入示例数据覆盖用户记录。
- 备份按 ID 合并，保留备份中不存在的本机记录；同 ID 使用导入版本，旧记录写入修订表。
- 金额聚合先转整数分，避免浮点累加误差。
- 统计只计入已完成行程；有缺失里程时不虚构效率指标。未记录的时间空隙单列为未分配。
- 时间戳保存时区信息，展示按当前设备本地时区；暂不提供独立时区选择器。
- 数据仍含个人位置与时间，请将 JSON/CSV 备份当作个人文件保管。

产品参考资料见 `docs/PRD.md` 和 `docs/ui-design.html`。
