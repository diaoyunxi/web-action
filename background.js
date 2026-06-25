/**
 * 网页操作执行器 - 后台服务 v1.5.0
 * 支持: 扩展生命周期、消息转发、快捷键命令、截屏、数据存储
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
