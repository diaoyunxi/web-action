/**
 * 网页操作执行器 - 后台服务 v1.8.0
 * 支持: 扩展生命周期、消息转发、快捷键命令、截屏、数据存储、自动更新检查
 */

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
      chrome.storage.local.set({ storedData });
    });
    sendResponse({ success: true });
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
      const popupViews = chrome.extension.getViews({ type: 'popup' });
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
const GITHUB_REPO = "diaoyunxi/web-action";
const UPDATE_ALARM = "update-check";

function compareVersions(v1, v2) {
  const a = v1.replace(/^v/, "").split(".");
  const b = v2.replace(/^v/, "").split(".");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const na = parseInt(a[i] || 0, 10);
    const nb = parseInt(b[i] || 0, 10);
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    // Try Releases API first
    let latestVersion = null;
    let releaseUrl = null;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          signal: AbortSignal.timeout(10000),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        latestVersion = data.tag_name;
        releaseUrl = data.html_url;
      }
    } catch (e) {
      console.warn("Update check: Releases API failed", e);
    }

    // Fallback to Tags API
    if (!latestVersion) {
      try {
        const resp = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/tags`,
          {
            signal: AbortSignal.timeout(10000),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.length > 0) {
            latestVersion = data[0].name;
            releaseUrl = `https://github.com/${GITHUB_REPO}/releases/tag/${latestVersion}`;
          }
        }
      } catch (e) {
        console.warn("Update check: Tags API failed", e);
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
