/**
 * 网页操作执行器 - 后台服务 v2.2.0
 * 支持: 扩展生命周期、消息转发、快捷键命令、截屏、数据存储、自动更新检查
 */

// 常量定义（移至文件顶部，避免 TDZ 问题）
const GITHUB_REPO = "diaoyunxi/web-action";
const UPDATE_ALARM = "update-check";

// 安装/更新时初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('网页操作执行器已安装/更新', details.reason);

  if (details.reason === 'install') {
    chrome.storage.local.set({
      operations: [],
      executionLogs: [],
      repeatSettings: {
        enabled: false,
        mode: 'count',
        count: 3,
        interval: 2000,
        stopOnError: true,
        showProgress: true,
        conditionType: 'elementExists',
        conditionSelector: '',
        conditionTimeout: 30000
      }
    });
  }

  // Create periodic update-check alarm (every 24 hours)
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 1440 });

  // Check for update on install/update
  if (details.reason === 'install' || details.reason === 'update') {
    checkForUpdate();
  }
});

// 标签页更新监听
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log(`页面加载完成: ${tab.url}`);
  }
});

// 消息转发
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }

  if (request.action === 'openTab') {
    // URL 协议校验：仅允许 http/https，防止 javascript:/data:/file: 等危险协议
    try {
      const parsed = new URL(request.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        sendResponse({ success: false, error: '仅允许 http/https 协议' });
        return true;
      }
    } catch (e) {
      sendResponse({ success: false, error: '无效的 URL' });
      return true;
    }
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ tab });
    });
    return true;
  }

  if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true;
  }

  if (request.action === 'storeData') {
    chrome.storage.local.get(['storedData'], (result) => {
      const storedData = result.storedData || {};
      storedData[request.key] = request.value;
      // 确保 sendResponse 在存储写入完成后调用，避免响应先于写入完成导致数据不一致
      chrome.storage.local.set({ storedData }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'closeCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.remove(tabs[0].id);
      }
    });
    sendResponse({ success: true });
    return true;
  }
});

// 快捷键命令监听
chrome.commands.onCommand.addListener(async (command) => {
  console.log('收到快捷键命令:', command);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.warn('未找到活动标签页');
      return;
    }

    if (command === 'execute-operations') {
      // 获取已保存的操作并发送到 popup (popup 监听消息触发执行)
      // 直接向 popup 发送消息触发执行
      // 获取已打开的 popup 视图（chrome.extension.getViews 已废弃，使用 chrome.runtime.getViews）
      const popupViews = chrome.runtime.getViews({ type: 'popup' });
      if (popupViews && popupViews.length > 0) {
        // popup 已打开，可直接通过 postMessage 触发
        try {
          chrome.runtime.sendMessage({ action: 'shortcut-execute' });
        } catch (e) {
          console.warn('无法通知 popup:', e);
        }
      } else {
        // popup 未打开，则从 storage 读取并向 content script 直接执行
        try {
          const result = await chrome.storage.local.get(['operations', 'repeatSettings']);
          if (result.operations && result.operations.length > 0) {
            // 先确保 content script 注入
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
            } catch (e) {
              console.warn('注入 content script 出错或已存在:', e);
            }

            // 发送执行命令
            chrome.tabs.sendMessage(tab.id, {
              action: 'executeOperations',
              operations: result.operations,
              repeatInfo: { current: 1, total: 1, loopIndex: 1 }
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('执行失败:', chrome.runtime.lastError);
              } else {
                console.log('快捷键执行成功:', response);
              }
            });
          }
        } catch (err) {
          console.error('读取操作配置失败:', err);
        }
      }
    } else if (command === 'stop-execution') {
      chrome.tabs.sendMessage(tab.id, { action: 'stopExecution' }).catch(() => {});
      // 也通知 popup 同步状态
      try {
        chrome.runtime.sendMessage({ action: 'shortcut-stop' });
      } catch (e) {}
    }
  } catch (error) {
    console.error('处理快捷键命令出错:', error);
  }
});

// --- Update Checker ---
// Checks GitHub for the latest release/tag and notifies the user when a newer
// version is available. Runs on install/update and every 24 hours via alarm.

function compareVersions(v1, v2) {
  // 解析版本号，分离主版本号与预发布后缀（如 1.0.0-beta.1 -> 主版本 [1,0,0]，后缀 ['beta',1]）
  // 正式版优先级高于预发布版（1.0.0 > 1.0.0-beta）
  const parseVersion = (v) => {
    const clean = v.replace(/^v/, "");
    const dashIdx = clean.indexOf("-");
    const main = dashIdx >= 0 ? clean.slice(0, dashIdx) : clean;
    const pre = dashIdx >= 0 ? clean.slice(dashIdx + 1) : null;
    const parts = main.split(".").map(n => parseInt(n, 10) || 0);
    // preParts 为 null 表示正式版（优先级最高），否则为数组
    let preParts = null;
    if (pre !== null && pre !== "") {
      preParts = pre.split(".").map(p => {
        const num = parseInt(p, 10);
        return isNaN(num) ? p : num;
      });
    }
    return { parts, preParts };
  };

  const a = parseVersion(v1);
  const b = parseVersion(v2);

  // 先比较主版本号
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
    const na = a.parts[i] || 0;
    const nb = b.parts[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  // 主版本号相同，比较预发布后缀
  // 正式版（preParts 为 null）优先级高于预发布版
  if (a.preParts === null && b.preParts !== null) return 1;
  if (a.preParts !== null && b.preParts === null) return -1;
  if (a.preParts === null && b.preParts === null) return 0;

  // 均为预发布版，逐段比较
  for (let i = 0; i < Math.max(a.preParts.length, b.preParts.length); i++) {
    const pa = a.preParts[i];
    const pb = b.preParts[i];
    // 缺失段视为较低优先级
    if (pa === undefined && pb !== undefined) return -1;
    if (pa !== undefined && pb === undefined) return 1;
    if (pa === undefined && pb === undefined) return 0;
    // 数字优先级高于字符串标识（1.0.0-beta.1 > 1.0.0-beta）
    if (typeof pa === "number" && typeof pb === "number") {
      if (pa > pb) return 1;
      if (pa < pb) return -1;
    } else if (typeof pa === "number" && typeof pb === "string") {
      return 1;
    } else if (typeof pa === "string" && typeof pb === "number") {
      return -1;
    } else {
      // 均为字符串，按字典序比较
      if (pa > pb) return 1;
      if (pa < pb) return -1;
    }
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    // 并行请求 Releases API 和 Tags API，谁先返回用谁，加快检查速度
    let latestVersion = null;
    let releaseUrl = null;

    const fetchRelease = async () => {
      const resp = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        return { version: data.tag_name, url: data.html_url };
      }
      throw new Error('Releases API failed');
    };

    const fetchTags = async () => {
      const resp = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/tags`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          return {
            version: data[0].name,
            url: `https://github.com/${GITHUB_REPO}/releases/tag/${data[0].name}`
          };
        }
      }
      throw new Error('Tags API failed');
    };

    // 优先使用 Releases API，失败则回退到 Tags API
    try {
      const result = await fetchRelease();
      latestVersion = result.version;
      releaseUrl = result.url;
    } catch (e) {
      console.warn("Update check: Releases API failed", e);
      try {
        const result = await fetchTags();
        latestVersion = result.version;
        releaseUrl = result.url;
      } catch (e2) {
        console.warn("Update check: Tags API failed", e2);
      }
    }

    if (!latestVersion) {
      console.log("Update check: could not determine latest version");
      return;
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      const notificationId = `update-available-${Date.now()}`;
      chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "发现新版本",
        message: `当前版本 v${currentVersion}，最新版本 ${latestVersion}\n点击此处前往更新`,
        priority: 2,
      });

      // Store release URL for click handler
      chrome.storage.local.set({
        [`updateUrl_${notificationId}`]: releaseUrl,
      });
    } else {
      console.log(
        `Update check: current version v${currentVersion} is up to date`
      );
    }
  } catch (e) {
    console.warn("Update check failed", e);
  }
}

// Periodic update-check alarm handler (every 24 hours)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === UPDATE_ALARM) {
    checkForUpdate();
  }
});

// Handle notification click - open release page in a new tab
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("update-available-")) {
    chrome.storage.local.get([`updateUrl_${notificationId}`], (result) => {
      const url = result[`updateUrl_${notificationId}`];
      if (url) {
        chrome.tabs.create({ url: url });
      }
      chrome.notifications.clear(notificationId);
    });
  }
});
