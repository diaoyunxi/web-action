## README.md

# 🎯 网页操作执行器 (Web Action Executor)

一个功能强大的 Chrome 浏览器扩展，可以在网页中按顺序自动执行多种操作，支持重复执行和条件循环。

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/diaoyunxi/web-action)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/chrome-88%2B-brightgreen.svg)](https://www.google.com/chrome/)

---

## 📑 目录

- [功能特点](#-功能特点)
- [安装方法](#-安装方法)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [选择器编写](#-选择器编写技巧)
- [常见问题](#-常见问题)
- [项目结构](#-项目结构)
- [技术架构](#-技术架构)
- [开发指南](#-开发指南)
- [更新日志](#-更新日志)
- [贡献指南](#-贡献)
- [许可证](#-许可证)

---

## ✨ 功能特点

### 🎮 支持的操作类型

| 操作 | 图标 | 说明 | 示例 |
|------|------|------|------|
| **输入** | 📝 | 在指定元素中输入文本 | 填写表单、搜索框 |
| **点击** | 👆 | 点击指定元素 | 按钮、链接 |
| **滑动** | ↕️ | 滚动页面到指定位置 | 查看页面内容 |
| **刷新** | 🔄 | 刷新当前页面 | 重新加载、等待元素 |
| **等待** | ⏳ | 等待固定时长或元素状态 | 等待加载完成 |
| **选择** | 📋 | 操作下拉列表 | 按值/索引/文本选择 |
| **脚本** | ⚡ | 执行自定义 JavaScript | 复杂自动化逻辑 |
| **提取** | 🔍 | 提取元素文本/属性值 | 数据采集 |
| **键盘** | ⌨️ | 模拟键盘按键/组合键 | Tab、Enter、Ctrl+A |
| **截屏** | 📷 | 捕获页面或元素截图 | 截图存档 |
| **剪贴板** | 📎 | 读写剪贴板内容 | 复制粘贴数据 |
| **HTTP请求** | 🌐 | 发起 GET/POST/PUT/DELETE 请求 | 调用 API、获取数据 |
| **标签页** | 🗂 | 打开/关闭/重载/聚焦标签页 | 多页面操作 |
| **通知** | 🔔 | 发送系统通知 | 执行结果提醒 |
| **Cookie** | 🍪 | 读取/设置/删除 Cookie | 会话管理 |
| **悬停** | 🖱 | 触发鼠标悬停事件 | 下拉菜单触发 |
| **双击** | 👆👆 | 触发双击事件 | 文本选中、快速操作 |
| **条件判断** | 🔀 | 条件不满足时跳过当前迭代 | 仅在元素存在时执行 |
| **文件上传** | 📁 | 通过 URL 上传文件到文件输入框 | 自动化表单上传 |
| **变量设置** | 📦 | 设置/追加/自增/清除自定义变量 | 跨步骤数据传递 |
| **元素属性** | 🏷 | 设置/移除/切换元素属性 | 禁用按钮、勾选框 |
| **本地存储** | 🗄 | 读写 localStorage/sessionStorage | 站点数据管理 |
| **页面导航** | 🧭 | 跳转URL/后退/前进/重新加载 | 多页面流程 |
| **媒体控制** | 🎬 | 播放/暂停/音量/跳转/速率/全屏 | HTML5 媒体自动化 |
| **右键点击** | 🖱 | 触发 contextmenu 事件 | 自定义右键菜单、复制粘贴 |
| **元素聚焦** | 🎯 | focus 元素并触发 focus 事件 | 激活输入框、唤起键盘 |
| **清空输入** | 🧹 | 清空 input/textarea/contenteditable | 重置表单 |
| **滚动到元素** | 📍 | scrollIntoView 滚动到指定元素 | 定位页面区块 |
| **拖拽** | 🤚 | 模拟 HTML5 拖拽源到目标 | 拖拽排序、拖拽上传 |
| **鼠标滚轮** | 🎰 | 模拟 wheel 事件 (Δx/Δy) | 缩放、滚动特定容器 |
| **打印日志** | 📜 | 输出自定义日志到执行日志 | 调试、流程标记 |
| **隐藏元素** | 🙈 | 隐藏/显示/切换元素 (display:none) | 关闭弹窗、广告遮罩 |
| **JSON 提取** | 🔧 | 解析 JSON 按路径提取值 | 处理 API 响应数据 |
| **切换 iframe** | 🖼 | 进入/退出/回到主文档 | 操作 iframe 内部元素 |
| **元素计数** | 🔢 | 统计匹配元素数量到变量 | 批量循环控制 |
| **文件下载** | ⬇ | 通过 URL 触发浏览器下载 | 自动化下载文件 |
| **页面信息** | 📄 | 获取 URL/标题/域名/UA 到变量 | 流程数据采集 |
| **元素样式** | 🎨 | 设置/获取/移除元素 CSS 样式 | 动态样式控制 |
| **触发事件** | 🎉 | 触发任意 DOM 事件 (含自定义事件) | 框架事件触发 |
| **正则提取** | 🔬 | 从变量或文本中按正则提取匹配内容 | 解析字符串、捕获分组 |
| **元素位置** | 📐 | 获取元素 getBoundingClientRect 坐标 | 定位计算、空间分析 |
| **数组操作** | 📚 | push/unshift/pop/shift/length/join/slice | 数据结构管理 |
| **滚动到边缘** | ⏫ | 滚动到页面/元素上下左右边缘 | 长列表定位 |
| **文本转语音** | 🔊 | speechSynthesis 朗读文本 | 语音播报、无障碍 |
| **网络状态** | 📡 | 获取在线状态/网络类型/下行速度 | 自适应流程控制 |

### 🔄 重复执行模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **指定次数** | 执行固定次数后自动停止 | 批量操作、数据采集 |
| **无限循环** | 持续执行直到手动停止 | 实时监控、轮询刷新 |
| **条件循环** | 等待条件满足时自动停止 | 等待抢购、状态监控 |

### ⚡ 高级特性

- ✅ **可视化编辑器** - 拖拽调整操作顺序
- ✅ **实时进度** - 显示执行进度条
- ✅ **智能重试** - 连接断开自动重连
- ✅ **事件模拟** - 完整模拟鼠标和键盘事件
- ✅ **框架兼容** - 支持 React、Vue、Angular 等
- ✅ **多种选择器** - CSS选择器 + XPath
- ✅ **预设模板** - 一键加载常用操作
- ✅ **错误处理** - 遇错停止/继续选项
- ✅ **本地存储** - 自动保存操作配置
- ✅ **高亮反馈** - 操作元素可视化反馈

---

## 📦 安装方法

### 方法一：开发者模式加载（推荐）

```bash
# 1. 克隆或下载本项目
git clone https://github.com/diaoyunxi/web-action.git

# 2. 打开 Chrome 扩展页面
# 地址栏输入：chrome://extensions/

# 3. 开启右上角「开发者模式」

# 4. 点击「加载已解压的扩展程序」

# 5. 选择项目文件夹
```

### 方法二：打包安装

```
1. 打开 chrome://extensions/
2. 点击「打包扩展程序」
3. 选择项目文件夹
4. 生成 .crx 文件
5. 将 .crx 文件拖入浏览器安装
```

### 系统要求

- Chrome 浏览器 88 或更高版本
- 支持 Edge、Brave 等 Chromium 内核浏览器

---

## 🚀 快速开始

### 示例 1：自动填充登录表单

```
操作步骤：
1. 📝 输入用户名 → #username → "admin@example.com"
2. 📝 输入密码   → #password → "password123"
3. 👆 点击登录   → #login-btn

执行：点击「登录表单」预设 → 打开目标网站 → 点击执行
```

### 示例 2：自动刷新监控

```
操作步骤：
1. 🔄 刷新页面 → 强制刷新
2. ↕️ 滚动到500px

重复设置：无限循环 → 间隔5秒

执行：页面每5秒自动刷新并滚动
```

### 示例 3：等待抢购（条件循环）

```
操作步骤：
1. 👆 点击刷新按钮

重复设置：
- 模式：条件循环
- 条件：元素出现时停止
- 选择器：.buy-now-button
- 间隔：1秒

执行：自动刷新直到"立即购买"按钮出现
```

### 示例 4：批量数据录入

```
操作步骤：
1. 📝 输入数据 → #name → "测试"
2. 👆 点击提交 → #submit
3. 🔄 刷新页面

重复设置：指定次数 10次 → 间隔3秒

执行：自动完成10次数据录入
```

### 示例 5：定时抢购（定时等待 + 随机等待）

```
操作步骤：
1. ⏳ 等待 → 等待类型: 定时等待 → 目标时刻: 10:00:00.000
2. 👆 点击 → .refresh-btn (刷新抢购页)
3. ⏳ 等待 → 等待类型: 随机等待 → 最小 50ms → 最大 200ms
4. 👆 点击 → .buy-now-button (立即购买)
5. ⏳ 等待 → 等待类型: 随机等待 → 最小 100ms → 最大 300ms
6. 👆 点击 → .confirm-pay (确认支付)

执行：在 10:00:00.000 精准触发抢购，每步之间加入随机延迟模拟人工节奏
```

### 示例 6：HTML5 视频自动化（媒体控制）

```
操作步骤：
1. 🎬 媒体 → 操作: 跳转到指定秒 → 秒数: 30
2. 🎬 媒体 → 操作: 设置播放速率 → 速率: 2 (2倍速)
3. 🎬 媒体 → 操作: 设置音量 → 音量: 0.5
4. 🎬 媒体 → 操作: 播放

执行：将页面视频跳到 30 秒位置、2 倍速、半音量播放
未指定选择器时自动取页面中第一个 video/audio 元素
```

### 示例 7：HTTP + JSON 提取 + 等待元素文本（API 联动）

```
操作步骤：
1. 🌐 HTTP → 方法: GET → URL: https://api.example.com/order/status?id=123
                 → 保存响应到变量: apiResponse
2. 🔧 JSON → 来源: 从变量读取 → 变量名: apiResponse
                → 路径: data.status → 保存到变量: orderStatus
3. 📜 日志 → 级别: info → 内容: 订单状态: {{var:orderStatus}}
4. ⏳ 等待 → 等待类型: 等待元素文本
              → 元素选择器: #order-status
              → 匹配方式: 包含
              → 期望文本: {{var:orderStatus}}
              → 超时: 10000
5. 🔔 通知 → 标题: 订单状态同步 → 内容: 当前状态 {{var:orderStatus}}

执行：调用 API 获取订单状态 → 从 JSON 提取 status 字段 →
     打印日志 → 等待页面元素显示对应状态文案 → 弹出系统通知
```

### 示例 8：拖拽 + 滚轮 + 隐藏弹窗（复杂交互自动化）

```
操作步骤：
1. 🙈 隐藏元素 → 选择器: .cookie-banner → 操作类型: 隐藏
2. 📍 滚动到元素 → 选择器: #drag-source-list → 对齐方式: 居中
3. 🤚 拖拽 → 源元素: #item-3 → 目标元素: #drop-zone
4. 🎰 鼠标滚轮 → 选择器: .canvas-container → Δy: -200 (向上滚动)
5. 🖱 右键点击 → 选择器: #context-target

执行：关闭 Cookie 横幅 → 滚动到拖拽源列表 →
     将 item-3 拖拽到 drop-zone → 在画布上滚轮缩放 → 触发右键菜单
```

### 示例 9：切换 iframe + 操作 iframe 内元素（嵌套页面自动化）

```
操作步骤：
1. 🖼 切换iframe → 操作: 进入 → 选择器: iframe#editor-frame
2. 📝 输入 → 选择器: #content → 内容: 在 iframe 中输入文本
3. 👆 点击 → 选择器: #save-btn (iframe 内的保存按钮)
4. 🖼 切换iframe → 操作: 回到主文档

执行：进入编辑器 iframe → 在 iframe 内输入并点击保存 → 退出回到主文档继续后续操作
注意：跨域 iframe 受浏览器安全策略限制无法访问
```

### 示例 10：元素计数 + 条件循环（批量列表处理）

```
操作步骤：
1. 🔢 元素计数 → 选择器: .todo-item → 保存到变量: itemCount
2. 📜 日志 → 内容: 待办事项数量: {{var:itemCount}}
3. 🔀 条件判断 → 条件类型: 变量等于 → 变量名: itemCount → 期望值: 0
                  → 模式: 条件满足时跳过 (pass)
4. 👆 点击 → 选择器: .load-more (有事项时点击加载更多)

重复设置：指定次数 3 次 → 间隔 2 秒

执行：每次循环先统计待办数量 → 打印日志 → 若已无待办则跳过本次循环 → 否则点击加载更多
```

### 示例 11：HTTP 请求 + 页面信息 + 文件下载（API 联动下载）

```
操作步骤：
1. 📄 页面信息 → 信息类型: url → 保存到变量: currentUrl
2. 🌐 HTTP → 方法: POST → URL: https://api.example.com/export
                 → 请求体: {"source": "{{var:currentUrl}}"}
                 → 保存响应到变量: exportResult
3. 🔧 JSON → 来源: 从变量读取 → 变量名: exportResult
                → 路径: data.downloadUrl → 保存到变量: downloadUrl
4. ⬇ 文件下载 → 文件URL: {{var:downloadUrl}} → 保存文件名: export-{{date}}.xlsx

执行：获取当前页面 URL → 调用导出 API → 从响应提取下载链接 → 触发文件下载
```

### 示例 12：元素样式 + 触发事件（动态样式与自定义事件）

```
操作步骤：
1. 🎨 元素样式 → 选择器: #target-box → 操作: 设置 → 属性名: background-color → 属性值: #ffeb3b
2. 🎨 元素样式 → 选择器: #target-box → 操作: 设置 → 属性名: border → 属性值: 2px solid #f44336
3. 🎨 元素样式 → 选择器: #target-box → 操作: 获取 → 属性名: width → 保存到变量: boxWidth
4. 📜 日志 → 内容: 目标宽度: {{var:boxWidth}}
5. 🎉 触发事件 → 选择器: #target-box → 事件类型: custom-highlight
                  → 初始化参数: {"detail": {"width": "{{var:boxWidth}}"}}
6. 🎉 触发事件 → 选择器: form#search → 事件类型: submit

执行：动态修改元素样式 → 获取计算宽度 → 触发自定义事件通知框架 → 触发表单提交
```

### 示例 13：正则提取 + 数组操作 + 元素位置（批量列表解析）

```
操作步骤：
1. 🔬 正则提取 → 来源: 从文本 → 文本: "订单#1001,订单#1002,订单#1003"
                 → 正则: #(\\d+) → 标志: g → 捕获组: 1
                 → 保存到变量: orderIds
2. 📚 数组操作 → 操作: length → 数组变量名: orderIds → 保存到变量: orderCount
3. 📜 日志 → 内容: 共解析 {{var:orderCount}} 个订单 ID
4. 📐 元素位置 → 选择器: #order-table → 信息类型: all → 保存前缀: pos
5. 📜 日志 → 内容: 表格位置 top={{var:pos_top}}, height={{var:pos_height}}
6. ⏫ 滚动到边缘 → 方向: bottom → 行为: smooth (滚动到表格底部)

执行：用正则提取所有订单号 → 计算订单数量 → 打印日志 → 获取表格坐标 → 滚动到底部
注意：数组以 JSON 字符串形式存储在变量中，可被 length/join/slice 等操作读取
```

### 示例 14：文本转语音 + 网络状态（自适应语音播报）

```
操作步骤：
1. 📡 网络状态 → 信息类型: all → 保存前缀: net
2. 🔀 条件判断 → 条件类型: 变量等于 → 变量名: net_online → 期望值: true
                  → 模式: 条件不满足时跳过 (skip)
3. 🔊 文本转语音 → 文本: 网络已连接，类型 {{var:net_effectiveType}}，开始执行任务
                   → 语速: 1 → 音量: 1 → 语言: zh-CN
4. 🎬 媒体 → 操作: 播放 (开始任务背景音)
5. 🔊 文本转语音 → 文本: 任务执行完毕，感谢使用
                   → 语速: 1 → 音量: 0.8

执行：检测网络状态 → 在线时用中文语音播报网络类型 → 播放媒体 → 任务完成播报
注意：speechSynthesis 在每个字 200ms（最少 10s）超时保护下完成朗读
```


---

## 📖 使用指南

### 界面说明

```
┌──────────────────────────────────────────┐
│  🎯 网页操作执行器              v2.2.0  │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ #1 📝 输入用户名                   │  │
│  │ 选择器: #username                 │  │
│  │ 内容:   admin@example.com        │  │
│  │ 延迟:   1000ms                    │  │
│  ├────────────────────────────────────┤  │
│  │ #2 👆 点击登录按钮                 │  │
│  │ 选择器: .login-btn               │  │
│  │ 延迟:   500ms                     │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  ☑ 启用重复执行                         │
│  模式: [指定次数 ▼]  次数: [3]          │
│  间隔: [2000] ms                        │
│  ☑ 遇错停止  ☑ 显示进度               │
├──────────────────────────────────────────┤
│  [📝输入] [👆点击] [↕️滑动] [🔄刷新]    │
│  [▶ 执行操作] [🗑 清空]                │
│  ▓▓▓▓▓▓▓▓▓░░░ 执行中... 2/3           │
│  ✅ 操作执行完成                        │
├──────────────────────────────────────────┤
│  快速预设                               │
│  [登录表单] [搜索操作]                  │
│  [刷新重试] [重复刷新]                  │
└──────────────────────────────────────────┘
```

### 操作配置详解

#### 📝 输入操作

| 参数 | 说明 | 示例 |
|------|------|------|
| 选择器 | 目标元素的CSS选择器或XPath | `#username`, `input[name="email"]` |
| 输入值 | 要输入的文本内容 | `admin@example.com` |
| 延迟 | 执行前等待时间（毫秒） | `1000` (1秒) |

**特殊处理：**
- 自动清空原有内容
- 触发 input/change 事件
- 兼容 React 受控组件
- 支持 contentEditable 元素

#### 👆 点击操作

| 参数 | 说明 | 示例 |
|------|------|------|
| 选择器 | 目标元素的CSS选择器或XPath | `#submit-btn`, `.btn-primary` |
| 延迟 | 执行前等待时间（毫秒） | `500` |

**事件序列：**
```
mouseover → mousedown → focus → mouseup → click
```

#### ↕️ 滑动操作

| 参数 | 说明 | 示例 |
|------|------|------|
| 位置 | 滚动目标位置（像素） | `500` |
| 行为 | 平滑滚动/立即滚动 | `smooth` / `auto` |
| 延迟 | 执行前等待时间（毫秒） | `1000` |

#### 🔄 刷新操作

| 刷新类型 | 说明 | 适用场景 |
|----------|------|----------|
| 普通刷新 | 等同F5刷新 | 常规刷新 |
| 强制刷新 | 忽略缓存重新加载 | 获取最新资源 |
| 刷新后等待 | 刷新后等待指定元素 | 等待加载完成 |

### 重复执行配置

#### 指定次数模式

```
次数：1-9999
间隔：0-300000ms（5分钟）
遇错停止：是/否
```

**使用场景：**
- 批量提交表单
- 自动化测试
- 数据采集

#### 无限循环模式

```
间隔：0-300000ms
遇错停止：是/否
手动停止：点击停止按钮
```

**使用场景：**
- 页面实时监控
- 自动刷新看板
- 持续性轮询

#### 条件循环模式

```
条件类型：
  - 元素出现时停止
  - 元素消失时停止

选择器：目标元素选择器
超时：最大等待时间
间隔：检查间隔时间
```

**使用场景：**
- 等待抢购按钮出现
- 等待加载完成
- 等待错误消失

---

## 🔍 选择器编写技巧

### CSS 选择器

```css
/* ID选择器 - 最精确 */
#login-button
#username-input

/* 类选择器 - 可能匹配多个 */
.submit-btn
.btn.primary.active

/* 属性选择器 - 非常灵活 */
input[name="username"]
input[type="email"]
button[data-action="submit"]
a[href*="login"]

/* 层级选择器 */
form#login input.email
.container > .header button

/* 伪类选择器 */
button:not([disabled])
input:first-of-type
li:nth-child(3)

/* 组合选择器 */
#form input.required, #form textarea.required
```

### XPath 选择器

```xpath
<!-- 文本匹配 -->
//button[contains(text(), '登录')]
//a[text()='查看更多']
//span[contains(text(), '提交')]

<!-- 属性匹配 -->
//input[@placeholder='请输入用户名']
//button[@type='submit']
//div[@class='container']//a

<!-- 位置匹配 -->
//div[@class='list']/div[1]
//ul/li[last()]
//table//tr[position()>1]

<!-- 复杂条件 -->
//button[contains(@class, 'btn') and not(@disabled)]
//input[@type='text' and @name='username']
```

### 选择器调试方法

```javascript
// 在浏览器控制台测试

// 测试CSS选择器
document.querySelector('#your-selector')
document.querySelectorAll('.your-class')

// 测试XPath
$x('//button[contains(text(), "登录")]')

// 检查元素属性
$0.getAttribute('class')  // $0 是当前选中的元素
$0.tagName

// 查看元素是否可见
$0.offsetParent !== null
getComputedStyle($0).display !== 'none'
```

### 选择器最佳实践

1. **优先使用ID选择器** - 最精确、最快
2. **避免依赖动态类名** - 如 `css-1a2b3c`
3. **使用属性选择器** - 对动态页面更稳定
4. **添加备用选择器** - `#btn1, #btn2`
5. **测试选择器唯一性** - 确保只匹配一个元素

---

## ❓ 常见问题

### 连接错误

**Q: 提示 "Could not establish connection"？**

A: 解决方案：
1. 刷新目标网页后重试
2. 关闭并重新打开扩展弹窗
3. 确保不在 `chrome://` 或 `about:` 等内部页面
4. 检查是否在页面完全加载后操作
5. 尝试重启浏览器

### 选择器问题

**Q: 提示 "未找到元素"？**

A: 检查以下内容：
```
1. 元素是否在 iframe 中（暂不支持跨iframe）
2. 元素是否是动态加载的（增加延迟时间）
3. 选择器是否正确（在控制台测试）
4. 是否有多个相同选择器（使用更精确的选择器）
5. 元素是否在 shadow DOM 中
```

**Q: 输入后没有触发验证？**

A: 
```
- 增加输入后的延迟时间
- 在输入前添加点击操作获取焦点
- 检查是否有防抖机制
- 尝试使用XPath选择器
```

### 执行问题

**Q: 点击没有反应？**

A:
```
- 检查元素是否被其他元素遮挡
- 增加点击前的等待时间
- 确认选择器指向了正确的元素
- 检查元素是否可点击（非disabled）
- 尝试使用原生点击事件
```

**Q: 重复执行不停止？**

A:
```
- 点击「停止」按钮手动停止
- 检查条件选择器是否正确
- 确认条件元素是否真的出现/消失
- 检查超时时间设置
```

**Q: 刷新后操作中断？**

A:
```
- 使用「刷新后等待元素」模式
- 增加等待超时时间
- 检查等待元素选择器是否正确
- 考虑使用条件循环替代
```

### 其他问题

**Q: 如何保存操作配置？**

A: 操作配置自动保存在浏览器本地存储中，无需手动保存。清除浏览器数据时注意保留扩展数据。

**Q: 支持哪些网站？**

A: 支持所有普通网页（http/https），不支持：
- `chrome://` 内部页面
- `chrome-extension://` 扩展页面
- Chrome Web Store
- 部分安全限制严格的页面

---

## 📁 项目结构

```
web-action-executor/
├── README.md               # 项目文档
├── LICENSE                 # 许可证文件
├── manifest.json           # Chrome扩展配置
├── popup.html              # 弹出窗口界面
├── popup.js                # 弹出窗口逻辑（操作管理、UI交互）
├── content.js              # 内容脚本（页面操作执行引擎）
├── background.js           # 后台服务脚本
├── styles.css              # 样式表
├── icons/                  # 图标目录
│   ├── icon16.png          # 16x16 图标
│   ├── icon48.png          # 48x48 图标
└── └── icon128.png         # 128x128 图标

```

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│                  popup.html                  │
│              (用户交互界面)                   │
├─────────────────────────────────────────────┤
│                  popup.js                    │
│  ┌─────────────┐  ┌─────────────────────┐   │
│  │ 操作管理器  │  │   重复执行控制器    │   │
│  │ - 增删改查 │  │   - 次数/无限/条件  │   │
│  │ - 拖拽排序 │  │   - 进度显示        │   │
│  │ - 预设模板 │  │   - 错误处理        │   │
│  └─────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────┤
│              background.js                   │
│  - 扩展生命周期管理                          │
│  - 标签页状态监听                            │
│  - 消息路由转发                              │
├─────────────────────────────────────────────┤
│               content.js                     │
│  ┌─────────────────────────────────────┐    │
│  │         操作执行引擎                 │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐│    │
│  │  │ 输入 │ │ 点击 │ │ 滚动 │ │刷新││    │
│  │  └──────┘ └──────┘ └──────┘ └────┘│    │
│  │  - 元素查找 (CSS/XPath)            │    │
│  │  - 事件模拟 (Mouse/Keyboard)       │    │
│  │  - 框架兼容 (React/Vue)            │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│              目标网页 DOM                    │
└─────────────────────────────────────────────┘
```

### 数据流

```
用户操作 → popup.js → chrome.tabs.sendMessage()
                            ↓
                    content.js (执行操作)
                            ↓
                    操作网页DOM元素
                            ↓
                    返回执行结果
                            ↓
用户 ← popup.js (显示状态)
```

### 核心技术

| 技术 | 用途 |
|------|------|
| Chrome Extension API | 扩展基础框架 |
| Manifest V3 | 最新扩展规范 |
| Content Scripts | 页面操作注入 |
| Message Passing | 组件间通信 |
| DOM API | 元素查找和操作 |
| Event Simulation | 事件模拟 |
| Storage API | 本地数据持久化 |

---

## 🔧 开发指南

### 环境准备

```bash
# 克隆项目
git clone https://github.com/diaoyunxi/web-action.git
cd web-action

# 使用任意代码编辑器打开
code .
```

### 调试方法

```javascript
// 1. 调试 popup.js
// 右键扩展图标 → 检查弹出内容

// 2. 调试 content.js  
// 在目标网页按F12 → Console
// 查看 [Web Action Executor] 日志

// 3. 调试 background.js
// 打开 chrome://extensions/
// 点击扩展的「service worker」链接

// 4. 查看存储数据
chrome.storage.local.get(null, console.log)
```

### 构建和打包

```bash
# 开发者模式
1. 修改代码
2. 在 chrome://extensions/ 点击刷新按钮
3. 重新打开扩展弹窗测试

# 打包发布
1. 在 chrome://extensions/ 点击「打包扩展程序」
2. 选择项目文件夹
3. 生成 .crx 和 .pem 文件
```

### 代码规范

```javascript
// 命名规范
- 类名: PascalCase (OperationManager)
- 方法: camelCase (executeOperation)
- 常量: UPPER_CASE (MAX_RETRIES)
- 文件: kebab-case (content.js)

// 注释规范
/**
 * 函数说明
 * @param {string} selector - 元素选择器
 * @returns {Element|null} 找到的元素
 */
```

---

## 📝 更新日志

### v2.2.0 (2026-07-02)

**新增（6 种新操作类型）**
- ✨ 正则提取操作（type: `regexExtract`）- 从变量或文本中按正则表达式提取匹配内容，支持指定捕获组索引和标志位（g/i/m/s/u/y），可保存到自定义变量。常配合 HTTP/提取操作进行字符串二次解析，支持 `variable`（从变量读取）与 `text`（直接文本）两种来源
- ✨ 元素位置操作（type: `elementPosition`）- 通过 `getBoundingClientRect()` 获取元素坐标，支持 8 种字段（x/y/width/height/top/bottom/left/right）和 `all` 全部模式。`all` 模式以 `前缀_字段名` 形式批量保存到变量（如 `pos_x`、`pos_width`），便于空间计算与定位判断
- ✨ 数组操作（type: `arrayOperation`）- 对 JSON 数组变量执行操作：`push`（末尾追加）/`unshift`（开头插入）/`pop`（末尾弹出）/`shift`（开头弹出）/`length`（取长度）/`join`（连接为字符串）/`indexOf`（查找索引）/`slice`（切片）/`clear`（清空）。数组以 JSON 字符串形式存储以兼容 `chrome.storage` 的字符串值
- ✨ 滚动到边缘操作（type: `scrollToEdge`）- 将页面或指定元素滚动到 top/bottom/left/right 四个边缘，支持 smooth/auto 滚动行为。未指定选择器时作用于整个页面（`window.scrollTo`），指定元素时作用于元素的 `scrollLeft/scrollTop`
- ✨ 文本转语音操作（type: `textToSpeech`）- 使用 Web Speech API 的 `speechSynthesis` 朗读文本，支持语言（lang）、语速（rate 0-2）、音调（pitch 0-2）、音量（volume 0-1）、声音（voice URI）。使用 Promise 等待朗读完成，含超时保护（每字 200ms，最少 10s），保证后续操作在朗读完成后执行
- ✨ 网络状态操作（type: `networkStatus`）- 获取浏览器网络信息：`online`（navigator.onLine）/`effectiveType`（4g/3g/2g/slow-2g）/`downlink`（下行 Mbps）/`rtt`（往返时延 ms）/`saveData`（节流模式）/`all`（全部以 `前缀_字段名` 保存）。基于 Network Information API，部分浏览器可能不支持部分字段（将保存 `unknown`）

**变更**
- 📌 `manifest.json` 版本升至 2.2.0，描述补充新功能
- 📌 `popup.html` 新增 6 个操作按钮（正则/位置/数组/边缘/语音/网络）、版本号升级
- 🎨 `styles.css` 新增 v2.2.0 操作类型样式（按钮、类型标签、提示框）
- 📚 README 新增 6 种操作说明、2 个使用示例（示例 13/14）、v2.2.0 更新日志
- 🔧 `popup.js` showHelp 文档同步更新所有新操作说明
- 🔧 `popup.js` exportConfig 版本号同步升级至 2.2.0
- 🔧 `popup.js` typeMap/fieldMap/renderFields/onMessage 同步新增 6 种操作的字段配置与结果处理
- 🔧 `content.js` executeOperation 新增 6 个 case 分发，实现 6 个执行方法 + `parseArrayValue` 辅助方法

**操作类型总数：46 种**（v2.1.0 的 40 种 + v2.2.0 新增 6 种）

### v2.1.0 (2026-07-01)

**新增（6 种新操作类型）**
- ✨ 切换 iframe 操作（type: `switchIframe`）- 在主文档与 iframe 文档之间切换元素查找上下文。支持三种模式：`enter`（通过选择器进入指定 iframe）、`exit`（退出到父级文档）、`main`（回到最顶层主文档）。进入 iframe 后，后续输入/点击/提取等操作的元素查找都会在该 iframe 内进行，操作完成后用「退出」或「回到主文档」恢复。注意：跨域 iframe 因浏览器安全策略无法访问
- ✨ 元素计数操作（type: `elementCount`）- 统计匹配选择器的元素数量并保存到自定义变量，支持 CSS 选择器和 XPath。常配合条件判断（`variableEquals`/`variableNotEmpty`）实现基于数量的循环控制
- ✨ 文件下载操作（type: `fileDownload`）- 通过创建 `<a download>` 元素触发浏览器下载，支持指定保存文件名。同源 URL 可指定文件名，跨域 URL 浏览器可能使用原文件名
- ✨ 页面信息操作（type: `pageInfo`）- 获取页面或浏览器的元信息到变量，支持 10 种信息类型：`url`/`title`/`referrer`/`domain`/`hostname`/`pathname`/`search`/`hash`/`userAgent`/`language`
- ✨ 元素样式操作（type: `elementStyle`）- 设置/获取/移除元素 CSS 样式。设置使用 `setProperty`，获取使用 `getComputedStyle`（可保存到变量），移除使用 `removeProperty`。属性名使用 CSS 连字符格式（如 `background-color`）
- ✨ 触发事件操作（type: `triggerEvent`）- 触发任意 DOM 事件，自动识别事件类型并构造合适的事件对象：Mouse 事件（click/mousedown/dblclick 等）、Keyboard 事件（keydown/keyup/keypress）、Drag 事件（dragstart/drop 等）、Wheel 事件、基础事件（input/change/submit/focus/blur/load 等），未知类型使用 `CustomEvent` 触发（可携带 `detail` 数据）。支持 JSON 格式的事件初始化参数

**变更**
- 📌 `manifest.json` 版本升至 2.1.0，描述补充新功能
- 📌 `popup.html` 新增 6 个操作按钮、版本号升级
- 🎨 `styles.css` 新增 v2.1.0 操作类型样式（按钮、类型标签、提示框）
- 📚 README 新增 6 种操作说明、4 个使用示例、v2.1.0 更新日志
- 🔧 `popup.js` showHelp 文档同步更新所有新操作说明
- 🔧 `popup.js` exportConfig 版本号同步升级至 2.1.0
- 🔧 `content.js` 新增 `currentDocument` 属性，`findElement` 支持在 iframe 文档上下文中查找元素

**操作类型总数：40 种**（v2.0.0 的 34 种 + v2.1.0 新增 6 种）

### v2.0.0 (2026-06-30)

**新增（10 种新操作类型）**
- ✨ 右键点击操作（type: `rightClick`）- 触发完整的 contextmenu 事件序列（mouseover/mousedown/mouseup/contextmenu），适用于自定义右键菜单、复制粘贴等场景
- ✨ 元素聚焦操作（type: `focus`）- 调用 element.focus() 并触发 focus/focusin 事件，适用于激活输入框、唤起键盘等场景
- ✨ 清空输入操作（type: `clear`）- 清空 input/textarea/contenteditable 元素的值并触发 input/change 事件，使用原生 setter 兼容 React 受控组件
- ✨ 滚动到元素操作（type: `scrollToElement`）- 调用 scrollIntoView 将指定元素滚动到视口可见位置，支持 start/center/end/nearest 对齐方式与 smooth/auto 滚动行为
- ✨ 拖拽操作（type: `drag`）- 模拟 HTML5 完整拖拽事件序列：mousedown → dragstart → mousemove → dragenter → dragover → drop → dragend，适用于拖拽排序、拖拽上传等场景
- ✨ 鼠标滚轮操作（type: `mouseWheel`）- 模拟 WheelEvent，支持 Δx/Δy 双轴增量，未指定选择器时作用于整个页面，适用于缩放、滚动特定容器
- ✨ 打印日志操作（type: `log`）- 输出自定义日志到执行日志区域与浏览器 Console，支持 info/warn/error/debug 四种级别，支持变量替换
- ✨ 隐藏元素操作（type: `hideElement`）- 通过 display:none 强制隐藏/显示/切换元素，自动记录原始样式以便恢复，常用于关闭弹窗、模态框、广告遮罩
- ✨ JSON 提取操作（type: `jsonExtract`）- 解析 JSON 字符串并按路径提取值（支持 a.b.c、a[0].b、a/b/c 语法），可保存到自定义变量供后续使用，常配合 HTTP 请求结果使用
- ✨ 等待元素文本操作（waitType: `elementText`）- 等待元素文本满足匹配条件后继续，支持 contains/equals/startsWith/endsWith/notContains 五种匹配模式，常用于等待状态文案出现（如「加载完成」「已支付」）

**变更**
- 📌 `manifest.json` 版本升至 2.0.0，描述补充新功能
- 📌 `popup.html` 新增 10 个操作按钮、版本号升级
- 🎨 `styles.css` 新增 v2.0.0 操作类型样式（按钮、类型标签、提示框）
- 📚 README 新增 10 种操作说明、新增 v2.0.0 更新日志
- 🔧 `popup.js` showHelp 文档同步更新所有新操作说明
- 🔧 `popup.js` exportConfig 版本号同步升级至 2.0.0

**操作类型总数：34 种**（v1.9.0 的 24 种 + v2.0.0 新增 10 种）

### v1.9.0 (2026-06-29)

**新增**
- ✨ 定时等待操作（waitType: `scheduledTime`）- 等待到当天指定时刻，若已过则等待到次日同时刻；支持 `HH:MM:SS` 与 `HH:MM:SS.mmm`（毫秒级精度），常用于定时抢购、定时任务调度
- ✨ 随机等待操作（waitType: `randomDelay`）- 在 `[最小, 最大]` 毫秒区间内随机取值等待，模拟人工操作节奏，规避反爬识别
- ✨ 媒体控制操作（type: `mediaControl`）- 控制 HTML5 `<video>`/`<audio>` 元素：播放、暂停、播放/暂停切换、静音/取消静音、设置音量、跳转、设置播放速率、进入全屏；未指定选择器时自动取页面中第一个媒体元素
- ✨ 长时间等待支持中途停止检查（每 200ms 检测 `shouldStop` 状态）

**变更**
- 📌 `manifest.json` 版本升至 1.9.0，描述补充新功能
- 📌 修正 `manifest.json` 与 README 中的仓库 URL 为实际的 `diaoyunxi/web-action`
- 🎨 新增 `.btn-mediacontrol`、`.wait-hint`、`.mediacontrol-hint` 样式
- 📚 README 新增"定时抢购"、"HTML5 视频自动化"使用示例

### v1.8.0 (2026-06-28)

**新增**
- ✨ 自动更新检查 - 扩展安装/更新时及每 24 小时（通过 `chrome.alarms`）自动检查 GitHub 最新版本，优先 Releases API、回退 Tags API；发现新版本时弹出系统通知，点击通知即可在新标签页打开 GitHub Releases 页面更新

**变更**
- 📌 `manifest.json` 新增 `alarms` 与 `notifications` 权限以支持定时检查与更新通知

### v1.7.0 (2026-06-27)

**新增**
- ✨ 条件判断操作 - 基于元素存在性/可见性/变量值决定是否跳过当前迭代，支持 skip 与 pass 两种模式
- ✨ 文件上传操作 - 通过 URL 拉取文件并填充到 `input[type=file]`，支持自定义保存文件名
- ✨ 变量设置操作 - 设置/追加/自增/清除自定义变量，支持通过 `{{var:变量名}}` 在后续操作中引用
- ✨ 元素属性操作 - 设置/移除/切换元素属性，自动触发 change 事件
- ✨ 本地存储操作 - 读取/写入/删除/清空 localStorage 与 sessionStorage
- ✨ 页面导航操作 - 跳转 URL（支持相对路径）/后退/前进/重新加载，可选保留或替换历史
- ✨ 新增自定义变量 `{{var:变量名}}` 变量替换语法

**修复**
- 🐛 修复 `renderFields` 方法因多余的闭合花括号导致 popup.js 语法错误、扩展弹窗无法加载的严重问题

### v1.6.0

**新增**
- ✨ HTTP请求操作、标签页操作、通知操作、Cookie操作、悬停操作、双击操作

### v1.5.0 (2026-06-24)

**新增**
- ✨ 键盘操作 - 模拟键盘按键、组合键、按键序列
- ✨ 截屏操作 - 整页截图、可视区域截图
- ✨ 剪贴板操作 - 读写剪贴板内容

### v1.2.1 (2024-01-15)

**修复**
- 🐛 修复 "Could not establish connection" 连接错误
- 🐛 添加 content script 自动注入和检测机制
- 🐛 添加消息发送重试机制
- 🐛 修复特殊页面检测

**改进**
- ⚡ 优化错误提示信息
- ⚡ 改进连接稳定性

### v1.2.0 (2024-01-10)

**新增**
- ✨ 重复执行功能
- ✨ 三种重复模式（次数/无限/条件）
- ✨ 进度条显示
- ✨ 手动停止按钮

### v1.1.0 (2024-01-05)

**新增**
- ✨ 刷新操作支持
- ✨ 三种刷新模式
- ✨ 刷新后等待元素功能

### v1.0.0 (2024-01-01)

**初始版本**
- ✨ 基础操作：输入、点击、滑动
- ✨ 可视化操作编辑器
- ✨ 预设模板
- ✨ 操作顺序调整

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献流程

```bash
1. Fork 本仓库
2. 创建功能分支: git checkout -b feature/new-feature
3. 提交更改: git commit -m 'feat: add new feature'
4. 推送分支: git push origin feature/new-feature
5. 提交 Pull Request
```

### 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

---

## 📄 许可证

MIT License

Copyright (c) 2024 Web Action Executor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## ⚠️ 免责声明

本工具仅供学习、研究和合法自动化测试用途。

**禁止用于：**
- ❌ 恶意刷票、刷单、刷流量
- ❌ 绕过网站安全机制
- ❌ 未经授权的自动化操作
- ❌ 违反网站服务条款的行为
- ❌ 任何违法或不当用途

**使用者需自行承担：**
- 使用本工具的一切风险和后果
- 遵守目标网站的服务条款
- 遵守当地法律法规

---

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

<div align="center">
  <sub>Made with ❤️ by Web Action Executor Team</sub>
</div>
```
