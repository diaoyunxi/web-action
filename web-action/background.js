/**
 * 网页操作执行器 - 后台服务
 */

// 安装/更新时初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('网页操作执行器已安装', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装，设置默认配置
    chrome.storage.local.set({
      operations: [],
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
    
    // 打开欢迎页面（可选）
    // chrome.tabs.create({ url: 'welcome.html' });
  }
});

// 标签页更新监听
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // 页面加载完成，可以在这里做自动操作
    console.log(`页面加载完成: ${tab.url}`);
  }
});

// 消息转发
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 获取当前标签页
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }
  
  // 打开新标签页
  if (request.action === 'openTab') {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ tab });
    });
    return true;
  }
});

// 快捷键命令（可选）
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'execute-operations':
      // 执行保存的操作
      executeSavedOperations();
      break;
      
    case 'stop-execution':
      // 停止执行
      stopAllExecutions();
      break;
  }
});

async function executeSavedOperations() {
  try {
    const result = await chrome.storage.local.get(['operations']);
    if (result.operations && result.operations.length > 0) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'executeOperations',
          operations: result.operations
        });
      }
    }
  } catch (error) {
    console.error('自动执行失败:', error);
  }
}

async function stopAllExecutions() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'stopExecution' }).catch(() => {});
  });
}
