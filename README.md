## README.md

# 🎯 网页操作执行器 (Web Action Executor)

一个功能强大的 Chrome 浏览器扩展，可以在网页中按顺序自动执行多种操作，支持重复执行和条件循环。

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)](https://github.com/your-repo/web-action-executor)
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
git clone https://github.com/your-repo/web-action-executor.git

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

---

## 📖 使用指南

### 界面说明

```
┌──────────────────────────────────────────┐
│  🎯 网页操作执行器              v1.2.1  │
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
git clone https://github.com/your-repo/web-action-executor.git
cd web-action-executor

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
