/**
 * 网页操作执行器 - 弹出窗口脚本 v1.7.0
 * 新增: 条件判断、文件上传、变量设置、元素属性、本地存储、页面导航
 */

class OperationManager {
  constructor() {
    this.operations = [];
    this.isExecuting = false;
    this.shouldStop = false;
    this.currentRepeat = 0;
    this.totalRepeats = 0;
    this.logs = [];
    this.pickerMode = false;
    this.pendingPickerField = null;
    this.init();
  }

  async init() {
    await this.loadOperations();
    await this.loadRepeatSettings();
    await this.loadLogs();
    this.initEventListeners();
    this.renderOperations();
    this.renderLogs();
    await this.checkPendingPickerResult();
  }

  // ==================== 数据持久化 ====================

  async loadOperations() {
    try {
      const result = await chrome.storage.local.get(['operations']);
      this.operations = result.operations || [];
    } catch (error) {
      console.error('加载操作失败:', error);
      this.operations = [];
    }
  }

  async saveOperations() {
    try {
      await chrome.storage.local.set({ operations: this.operations });
    } catch (error) {
      console.error('保存操作失败:', error);
    }
  }

  async loadRepeatSettings() {
    try {
      const result = await chrome.storage.local.get(['repeatSettings']);
      if (result.repeatSettings) {
        const s = result.repeatSettings;
        document.getElementById('enableRepeat').checked = s.enabled || false;
        document.getElementById('repeatMode').value = s.mode || 'count';
        document.getElementById('repeatCount').value = s.count || 3;
        document.getElementById('repeatInterval').value = s.interval || 2000;
        document.getElementById('stopOnError').checked = s.stopOnError !== false;
        document.getElementById('showProgress').checked = s.showProgress !== false;
        document.getElementById('conditionType').value = s.conditionType || 'elementExists';
        document.getElementById('conditionSelector').value = s.conditionSelector || '';
        document.getElementById('conditionTimeout').value = s.conditionTimeout || 30000;
        this.toggleRepeatSettings();
      }
    } catch (error) {
      console.error('加载重复设置失败:', error);
    }
  }

  async saveRepeatSettings() {
    const settings = {
      enabled: document.getElementById('enableRepeat').checked,
      mode: document.getElementById('repeatMode').value,
      count: parseInt(document.getElementById('repeatCount').value) || 3,
      interval: parseInt(document.getElementById('repeatInterval').value) || 2000,
      stopOnError: document.getElementById('stopOnError').checked,
      showProgress: document.getElementById('showProgress').checked,
      conditionType: document.getElementById('conditionType').value,
      conditionSelector: document.getElementById('conditionSelector').value,
      conditionTimeout: parseInt(document.getElementById('conditionTimeout').value) || 30000
    };

    try {
      await chrome.storage.local.set({ repeatSettings: settings });
    } catch (error) {
      console.error('保存重复设置失败:', error);
    }
  }

  async loadLogs() {
    try {
      const result = await chrome.storage.local.get(['executionLogs']);
      this.logs = result.executionLogs || [];
    } catch (error) {
      this.logs = [];
    }
  }

  async saveLogs() {
    try {
      // 只保留最近 100 条日志
      if (this.logs.length > 100) {
        this.logs = this.logs.slice(-100);
      }
      await chrome.storage.local.set({ executionLogs: this.logs });
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }

  addLog(type, message) {
    const entry = {
      time: new Date().toLocaleString('zh-CN'),
      type,
      message
    };
    this.logs.push(entry);
    this.saveLogs();
    this.renderLogs();
  }

  // ==================== 事件监听 ====================

  initEventListeners() {
    document.getElementById('addInput').addEventListener('click', () => this.addOperation('input'));
    document.getElementById('addClick').addEventListener('click', () => this.addOperation('click'));
    document.getElementById('addScroll').addEventListener('click', () => this.addOperation('scroll'));
    document.getElementById('addRefresh').addEventListener('click', () => this.addOperation('refresh'));
    document.getElementById('addWait').addEventListener('click', () => this.addOperation('wait'));
    document.getElementById('addSelect').addEventListener('click', () => this.addOperation('select'));
    document.getElementById('addScript').addEventListener('click', () => this.addOperation('script'));
    document.getElementById('addExtract').addEventListener('click', () => this.addOperation('extract'));
    document.getElementById('addKeyboard').addEventListener('click', () => this.addOperation('keyboard'));
    document.getElementById('addScreenshot').addEventListener('click', () => this.addOperation('screenshot'));
    document.getElementById('addClipboard').addEventListener('click', () => this.addOperation('clipboard'));
    document.getElementById('addHttpRequest').addEventListener('click', () => this.addOperation('httpRequest'));
    document.getElementById('addTab').addEventListener('click', () => this.addOperation('tab'));
    document.getElementById('addNotification').addEventListener('click', () => this.addOperation('notification'));
    document.getElementById('addCookie').addEventListener('click', () => this.addOperation('cookie'));
    document.getElementById('addHover').addEventListener('click', () => this.addOperation('hover'));
    document.getElementById('addDoubleClick').addEventListener('click', () => this.addOperation('doubleClick'));
    document.getElementById('addIf').addEventListener('click', () => this.addOperation('if'));
    document.getElementById('addFileUpload').addEventListener('click', () => this.addOperation('fileUpload'));
    document.getElementById('addSetVariable').addEventListener('click', () => this.addOperation('setVariable'));
    document.getElementById('addSetAttribute').addEventListener('click', () => this.addOperation('setAttribute'));
    document.getElementById('addStorage').addEventListener('click', () => this.addOperation('storage'));
    document.getElementById('addNavigate').addEventListener('click', () => this.addOperation('navigate'));

    document.getElementById('executeAll').addEventListener('click', () => this.executeAllOperations());
    document.getElementById('stopExecution').addEventListener('click', () => this.stopExecution());
    document.getElementById('clearAll').addEventListener('click', () => this.clearAllOperations());

    document.getElementById('presetLogin').addEventListener('click', () => this.loadLoginPreset());
    document.getElementById('presetSearch').addEventListener('click', () => this.loadSearchPreset());
    document.getElementById('presetRefresh').addEventListener('click', () => this.loadRefreshPreset());
    document.getElementById('presetRepeat').addEventListener('click', () => this.loadRepeatPreset());

    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp();
    });

    document.getElementById('enableRepeat').addEventListener('change', () => {
      this.toggleRepeatSettings();
      this.saveRepeatSettings();
    });

    document.getElementById('repeatMode').addEventListener('change', () => {
      this.toggleRepeatSettings();
      this.saveRepeatSettings();
    });

    const autoSaveElements = [
      'repeatCount', 'repeatInterval', 'conditionSelector',
      'conditionTimeout', 'conditionType'
    ];

    autoSaveElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.saveRepeatSettings());
        el.addEventListener('input', () => this.saveRepeatSettings());
      }
    });

    ['stopOnError', 'showProgress'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.saveRepeatSettings());
    });

    // 导入导出
    document.getElementById('exportConfig').addEventListener('click', () => this.exportConfig());
    document.getElementById('importConfig').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => this.importConfig(e));

    // 日志
    document.getElementById('clearLog').addEventListener('click', () => {
      this.logs = [];
      this.saveLogs();
      this.renderLogs();
      this.showStatus('✅ 日志已清空', 'success');
    });

    // 监听后台快捷键消息和拾取器消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'shortcut-execute') {
        this.executeAllOperations();
      } else if (request.action === 'shortcut-stop') {
        this.stopExecution();
      } else if (request.action === 'pickerResult') {
        this.handlePickerResult(request);
      } else if (request.action === 'pickerCancelled') {
        this.handlePickerCancelled();
      } else if (request.action === 'extractResult') {
        this.handleExtractResult(request);
      } else if (request.action === 'scriptResult') {
        this.handleScriptResult(request);
      } else if (request.action === 'httpRequestResult') {
        this.handleHttpRequestResult(request);
      }
    });
  }

  // ==================== 工具方法 ====================

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 元素拾取器 ====================

  async startPicker(fieldId) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        this.showStatus('未找到活动标签页', 'error');
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        this.showStatus('无法在浏览器内部页面拾取元素', 'error');
        return;
      }

      this.pickerMode = true;
      this.pendingPickerField = fieldId;

      await this.ensureContentScriptInjected(tab);
      await chrome.tabs.sendMessage(tab.id, { action: 'startPicker', targetField: fieldId });

      this.showStatus('🎯 请在页面中点击目标元素', 'info');
      this.addLog('info', '启动元素拾取器');

      // 关闭 popup 让用户点击页面
      window.close();
    } catch (error) {
      console.error('启动拾取器失败:', error);
      this.showStatus(`启动拾取器失败: ${error.message}`, 'error');
    }
  }

  handlePickerResult(request) {
    this.pickerMode = false;

    // 保存选择器到 storage，下次打开 popup 时应用
    chrome.storage.local.set({
      pendingPickerSelector: request.selector,
      pendingPickerField: this.pendingPickerField
    });

    console.log('✅ 拾取成功:', request.selector);
    this.addLog('success', `拾取成功: ${request.selector}`);
  }

  handlePickerCancelled() {
    this.pickerMode = false;
    this.pendingPickerField = null;
    this.addLog('warning', '拾取已取消');
  }

  // 检查是否有待应用的拾取结果
  async checkPendingPickerResult() {
    try {
      const result = await chrome.storage.local.get(['pendingPickerSelector', 'pendingPickerField']);
      if (result.pendingPickerSelector && result.pendingPickerField) {
        // 应用选择器到对应字段
        const fieldId = result.pendingPickerField;
        const input = document.querySelector(`[data-picker-target="${fieldId}"]`);
        if (input) {
          input.value = result.pendingPickerSelector;
          // 触发 change 事件更新数据
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 清除临时数据
        chrome.storage.local.remove(['pendingPickerSelector', 'pendingPickerField']);

        this.showStatus(`✅ 已应用选择器: ${result.pendingPickerSelector}`, 'success');
      }
    } catch (error) {
      console.error('检查拾取结果失败:', error);
    }
  }

  // ==================== 结果处理 ====================

  handleExtractResult(request) {
    const valuePreview = request.value.substring(0, 100);
    this.addLog('success', `提取成功 (${request.extractType}): ${valuePreview}${request.value.length > 100 ? '...' : ''}`);
    console.log('提取结果:', request.value);
  }

  handleScriptResult(request) {
    this.addLog('success', `脚本返回: ${request.result}`);
    console.log('脚本结果:', request.result);
  }

  handleHttpRequestResult(request) {
    const statusEmoji = request.status >= 200 && request.status < 300 ? '✅' : '⚠️';
    this.addLog('info', `HTTP ${request.status} - ${request.url} - ${request.preview?.substring(0, 50)}...`);
    console.log(`HTTP请求结果: ${request.status}`, request.preview);
  }

  // 【核心修复】确保 content script 已注入
  async ensureContentScriptInjected(tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (response && response.pong) {
        return;
      }
    } catch (error) {
      console.log('Content script 未响应，尝试注入...');
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script 注入成功');
      await this.sleep(300);
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (error) {
      console.error('Content script 注入失败:', error);
      throw new Error('无法在此页面执行操作。请刷新页面后重试，或检查是否在浏览器内部页面。');
    }
  }

  async sendMessageWithRetry(tabId, message, maxRetries = 5, retryDelay = 500) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
      } catch (error) {
        lastError = error;
        if (error.message.includes('Receiving end does not exist')) {
          console.log(`连接失败 (${i + 1}/${maxRetries})，正在重试...`);
          await this.sleep(retryDelay);
        } else {
          throw error;
        }
      }
    }

    throw new Error(`无法连接到页面: ${lastError.message}`);
  }

  sleepWithCancel(ms) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      const checkStop = setInterval(() => {
        if (this.shouldStop) {
          clearTimeout(timeout);
          clearInterval(checkStop);
          reject(new Error('用户停止执行'));
        }
      }, 100);
    });
  }

  // ==================== 操作管理 ====================

  addOperation(type) {
    const baseOperation = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      delay: 1000
    };

    const typeMap = {
      input: { ...baseOperation, type: 'input', selector: '', value: '', description: '输入文本' },
      click: { ...baseOperation, type: 'click', selector: '', description: '点击元素' },
      scroll: { ...baseOperation, type: 'scroll', position: 500, behavior: 'smooth', description: '滚动页面' },
      refresh: { ...baseOperation, type: 'refresh', refreshType: 'normal', waitSelector: '', waitTimeout: 5000, description: '刷新页面' },
      wait: { ...baseOperation, type: 'wait', waitType: 'fixed', waitDuration: 2000, waitSelector: '', waitTimeout: 10000, description: '等待' },
      select: { ...baseOperation, type: 'select', selector: '', selectType: 'value', selectValue: '', description: '下拉选择' },
      script: { ...baseOperation, type: 'script', scriptCode: '', description: '执行脚本' },
      extract: { ...baseOperation, type: 'extract', selector: '', extractType: 'text', extractAttribute: '', description: '提取元素' },
      keyboard: { ...baseOperation, type: 'keyboard', keyType: 'key', keyValue: 'Enter', modifierKeys: [], description: '键盘按键' },
      screenshot: { ...baseOperation, type: 'screenshot', screenshotType: 'page', selector: '', description: '页面截屏' },
      clipboard: { ...baseOperation, type: 'clipboard', clipboardAction: 'write', clipboardValue: '', clipboardVariable: '', description: '剪贴板操作' },
      httpRequest: { ...baseOperation, type: 'httpRequest', httpMethod: 'GET', httpUrl: '', httpHeaders: '', httpBody: '', httpSaveVariable: '', description: 'HTTP请求' },
      tab: { ...baseOperation, type: 'tab', tabAction: 'open', tabUrl: '', description: '标签页操作' },
      notification: { ...baseOperation, type: 'notification', notifTitle: '网页操作执行器', notifBody: '', notifDuration: 3000, description: '通知' },
      cookie: { ...baseOperation, type: 'cookie', cookieAction: 'get', cookieName: '', cookieValue: '', cookieDomain: '', cookiePath: '/', cookieMaxAge: '', cookieVariable: '', description: 'Cookie操作' },
      hover: { ...baseOperation, type: 'hover', selector: '', hoverDuration: 1000, description: '悬停' },
      doubleClick: { ...baseOperation, type: 'doubleClick', selector: '', description: '双击' },
      if: { ...baseOperation, type: 'if', ifMode: 'skip', ifConditionType: 'elementExists', ifSelector: '', ifVariableName: '', ifVariableValue: '', description: '条件判断' },
      fileUpload: { ...baseOperation, type: 'fileUpload', selector: '', fileUrl: '', fileName: 'uploaded-file', description: '文件上传' },
      setVariable: { ...baseOperation, type: 'setVariable', varName: '', varAction: 'set', varValue: '', description: '变量设置' },
      setAttribute: { ...baseOperation, type: 'setAttribute', selector: '', attrAction: 'set', attrName: '', attrValue: '', description: '元素属性' },
      storage: { ...baseOperation, type: 'storage', storageType: 'localStorage', storageAction: 'get', storageKey: '', storageValue: '', storageVariable: '', description: '本地存储' },
      navigate: { ...baseOperation, type: 'navigate', navigateAction: 'url', navigateUrl: '', navigateWaitLoad: true, description: '页面导航' }
    };

    if (typeMap[type]) {
      this.operations.push(typeMap[type]);
      this.saveOperations();
      this.renderOperations();
    }
  }

  deleteOperation(id) {
    this.operations = this.operations.filter(op => op.id !== id);
    this.saveOperations();
    this.renderOperations();
  }

  moveOperation(id, direction) {
    const index = this.operations.findIndex(op => op.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.operations.length) return;

    [this.operations[index], this.operations[newIndex]] =
    [this.operations[newIndex], this.operations[index]];

    this.saveOperations();
    this.renderOperations();
  }

  updateOperation(id, property, value) {
    const operation = this.operations.find(op => op.id === id);
    if (operation) {
      operation[property] = value;
      this.saveOperations();
    }
  }

  clearAllOperations() {
    if (this.operations.length === 0) {
      this.showStatus('没有可清空的操作', 'info');
      return;
    }

    if (confirm(`确定要清空所有 ${this.operations.length} 个操作吗？`)) {
      this.operations = [];
      this.saveOperations();
      this.renderOperations();
      this.showStatus('已清空所有操作', 'success');
    }
  }

  // ==================== 导入导出 ====================

  exportConfig() {
    const config = {
      version: '1.7.0',
      exportTime: new Date().toISOString(),
      operations: this.operations,
      repeatSettings: {
        enabled: document.getElementById('enableRepeat').checked,
        mode: document.getElementById('repeatMode').value,
        count: parseInt(document.getElementById('repeatCount').value) || 3,
        interval: parseInt(document.getElementById('repeatInterval').value) || 2000,
        stopOnError: document.getElementById('stopOnError').checked,
        showProgress: document.getElementById('showProgress').checked,
        conditionType: document.getElementById('conditionType').value,
        conditionSelector: document.getElementById('conditionSelector').value,
        conditionTimeout: parseInt(document.getElementById('conditionTimeout').value) || 30000
      }
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-action-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.addLog('info', `导出配置成功 (${this.operations.length} 个操作)`);
    this.showStatus('✅ 配置已导出', 'success');
  }

  importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);

        if (!config.operations || !Array.isArray(config.operations)) {
          throw new Error('无效的配置文件');
        }

        if (!confirm(`将导入 ${config.operations.length} 个操作，是否覆盖当前配置？`)) {
          event.target.value = '';
          return;
        }

        this.operations = config.operations.map(op => ({
          ...op,
          id: Date.now() + Math.floor(Math.random() * 1000) + op.id
        }));
        this.saveOperations();

        if (config.repeatSettings) {
          const s = config.repeatSettings;
          document.getElementById('enableRepeat').checked = !!s.enabled;
          document.getElementById('repeatMode').value = s.mode || 'count';
          document.getElementById('repeatCount').value = s.count || 3;
          document.getElementById('repeatInterval').value = s.interval || 2000;
          document.getElementById('stopOnError').checked = s.stopOnError !== false;
          document.getElementById('showProgress').checked = s.showProgress !== false;
          document.getElementById('conditionType').value = s.conditionType || 'elementExists';
          document.getElementById('conditionSelector').value = s.conditionSelector || '';
          document.getElementById('conditionTimeout').value = s.conditionTimeout || 30000;
          this.toggleRepeatSettings();
          this.saveRepeatSettings();
        }

        this.renderOperations();
        this.addLog('success', `导入配置成功 (${config.operations.length} 个操作)`);
        this.showStatus(`✅ 成功导入 ${config.operations.length} 个操作`, 'success');
      } catch (error) {
        console.error('导入失败:', error);
        this.addLog('error', `导入失败: ${error.message}`);
        this.showStatus(`❌ 导入失败: ${error.message}`, 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  // ==================== 执行控制 ====================

  toggleRepeatSettings() {
    const enabled = document.getElementById('enableRepeat').checked;
    const settings = document.getElementById('repeatSettings');
    const mode = document.getElementById('repeatMode').value;

    settings.style.display = enabled ? 'block' : 'none';
    document.getElementById('repeatCountGroup').style.display =
      mode === 'count' ? 'block' : 'none';
    document.getElementById('repeatConditionGroup').style.display =
      mode === 'condition' ? 'block' : 'none';
  }

  setExecutingState(executing) {
    this.isExecuting = executing;
    document.getElementById('executeAll').style.display = executing ? 'none' : 'inline-flex';
    document.getElementById('stopExecution').style.display = executing ? 'inline-flex' : 'none';

    const buttons = document.querySelectorAll('.controls .btn, .preset-buttons .btn, #clearAll, .btn-io');
    buttons.forEach(btn => {
      btn.disabled = executing;
      btn.style.opacity = executing ? '0.6' : '1';
      btn.style.cursor = executing ? 'not-allowed' : 'pointer';
    });

    document.getElementById('enableRepeat').disabled = executing;
    document.getElementById('repeatMode').disabled = executing;
    document.getElementById('repeatCount').disabled = executing;
    document.getElementById('repeatInterval').disabled = executing;
  }

  updateProgress(current, total) {
    const container = document.getElementById('progressContainer');

    if (document.getElementById('showProgress').checked) {
      container.style.display = 'block';
      document.getElementById('progressText').textContent =
        total === -1 ? '无限循环中...' : '执行中...';
      document.getElementById('progressCount').textContent =
        total === -1 ? `${current}/∞` : `${current}/${total}`;
      document.getElementById('progressFill').style.width =
        total === -1 ? '100%' : `${(current / total) * 100}%`;
    }
  }

  stopExecution() {
    this.shouldStop = true;
    this.showStatus('⏹ 正在停止...', 'warning');
    this.addLog('warning', '用户请求停止执行');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stopExecution' })
          .catch(() => {});
      }
    });
  }

  // ==================== 执行引擎 ====================

  async executeAllOperations() {
    if (this.operations.length === 0) {
      this.showStatus('⚠️ 请先添加操作', 'warning');
      return;
    }

    if (this.isExecuting) {
      this.showStatus('正在执行中...', 'warning');
      return;
    }

    const enableRepeat = document.getElementById('enableRepeat').checked;
    const repeatMode = document.getElementById('repeatMode').value;
    const repeatCount = parseInt(document.getElementById('repeatCount').value);

    this.shouldStop = false;
    this.currentRepeat = 0;

    if (!enableRepeat) {
      this.totalRepeats = 1;
    } else if (repeatMode === 'infinite') {
      this.totalRepeats = -1;
    } else if (repeatMode === 'condition') {
      this.totalRepeats = -2;
    } else {
      this.totalRepeats = repeatCount;
    }

    this.setExecutingState(true);

    const modeText = this.totalRepeats === -1 ? '无限循环' :
                     this.totalRepeats === -2 ? '条件循环' :
                     `共 ${this.totalRepeats} 次`;
    this.showStatus(`▶ 执行中... (${modeText})`, 'info');
    this.addLog('info', `开始执行 - ${this.operations.length} 个操作, ${modeText}`);

    const startTime = Date.now();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('未找到活动标签页，请打开一个网页');
      }

      if (tab.url.startsWith('chrome://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:') ||
          tab.url.startsWith('chrome-extension://')) {
        throw new Error('无法在浏览器内部页面执行操作，请打开普通网页');
      }

      await this.ensureContentScriptInjected(tab);

      await this.sendMessageWithRetry(tab.id, {
        action: 'setRepeatConfig',
        config: {
          repeatMode, repeatCount,
          repeatInterval: parseInt(document.getElementById('repeatInterval').value) || 2000,
          stopOnError: document.getElementById('stopOnError').checked,
          conditionType: document.getElementById('conditionType').value,
          conditionSelector: document.getElementById('conditionSelector').value,
          conditionTimeout: parseInt(document.getElementById('conditionTimeout').value),
          totalRepeats: this.totalRepeats
        }
      });

      await this.executeLoop(tab, parseInt(document.getElementById('repeatInterval').value) || 2000);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.addLog('success', `执行完成，耗时 ${duration} 秒`);
      this.showStatus(`✅ 完成! (耗时 ${duration}s)`, 'success');

    } catch (error) {
      if (error.message === '用户停止执行') {
        this.showStatus('⏹ 执行已停止', 'warning');
        this.addLog('warning', '执行已停止');
      } else {
        this.showStatus(`❌ ${error.message}`, 'error');
        this.addLog('error', `执行失败: ${error.message}`);
      }
    } finally {
      this.setExecutingState(false);
      document.getElementById('progressContainer').style.display = 'none';
    }
  }

  async executeLoop(tab, interval) {
    while (!this.shouldStop) {
      this.currentRepeat++;

      if (this.totalRepeats > 0 && this.currentRepeat > this.totalRepeats) {
        break;
      }

      this.updateProgress(this.currentRepeat, this.totalRepeats);

      try {
        const response = await this.sendMessageWithRetry(tab.id, {
          action: 'executeOperations',
          operations: this.operations,
          repeatInfo: {
            current: this.currentRepeat,
            total: this.totalRepeats,
            loopIndex: this.currentRepeat
          }
        });

        if (response && !response.success) {
          if (response.shouldStop || document.getElementById('stopOnError').checked) {
            throw new Error(response.error || '执行失败');
          }
          console.warn('操作执行失败，继续:', response.error);
          this.addLog('error', `操作失败但继续: ${response.error}`);
        }

        // 条件循环检查
        if (this.totalRepeats === -2) {
          try {
            const conditionResponse = await this.sendMessageWithRetry(tab.id, {
              action: 'checkCondition',
              conditionType: document.getElementById('conditionType').value,
              selector: document.getElementById('conditionSelector').value
            });

            if (conditionResponse?.conditionMet) {
              this.showStatus('✅ 条件满足，停止执行', 'success');
              this.addLog('success', '条件满足，停止条件循环');
              break;
            }
          } catch (error) {
            console.warn('检查条件失败:', error.message);
          }
        }

        if (this.totalRepeats > 0 && this.currentRepeat >= this.totalRepeats) {
          break;
        }

        if (interval > 0 && !this.shouldStop && this.currentRepeat < this.totalRepeats) {
          await this.sleepWithCancel(interval);
        } else if (this.totalRepeats === -1 && !this.shouldStop) {
          await this.sleepWithCancel(interval);
        } else if (this.totalRepeats === -2 && !this.shouldStop) {
          await this.sleepWithCancel(interval);
        }

      } catch (error) {
        if (error.message === '用户停止执行') throw error;
        if (error.message.includes('无法连接到页面')) {
          throw new Error('页面连接丢失，请刷新页面后重试');
        }

        if (document.getElementById('stopOnError').checked) {
          throw error;
        }
        console.error('执行出错，继续:', error);
        this.addLog('error', `继续执行 - 错误: ${error.message}`);
      }
    }

    if (!this.shouldStop && this.totalRepeats > 0) {
      this.showStatus(`✅ 完成! (共 ${this.totalRepeats} 次)`, 'success');
    } else if (this.shouldStop) {
      throw new Error('用户停止执行');
    }
  }

  // ==================== 预设模板 ====================

  loadLoginPreset() {
    this.operations = [
      { id: Date.now() + 1, type: 'click', selector: 'input[type="text"], input[name="username"], input#username', delay: 500, description: '聚焦用户名' },
      { id: Date.now() + 2, type: 'input', selector: 'input[type="text"], input[name="username"], input#username', value: 'demo@example.com', delay: 500, description: '输入用户名' },
      { id: Date.now() + 3, type: 'input', selector: 'input[type="password"], input[name="password"]', value: 'password123', delay: 500, description: '输入密码' },
      { id: Date.now() + 4, type: 'click', selector: 'button[type="submit"], .login-btn, button:contains("登录")', delay: 1000, description: '点击登录' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.addLog('info', '加载登录表单预设');
    this.showStatus('✅ 已加载登录表单预设', 'success');
  }

  loadSearchPreset() {
    this.operations = [
      { id: Date.now() + 1, type: 'input', selector: '#search-input, input[type="search"], input[name="q"]', value: 'Chrome Extension {{timestamp}}', delay: 500, description: '输入搜索词' },
      { id: Date.now() + 2, type: 'click', selector: '#search-btn, button[type="submit"]', delay: 800, description: '点击搜索' },
      { id: Date.now() + 3, type: 'wait', waitType: 'element', waitSelector: '.search-results, .results', waitTimeout: 5000, delay: 0, description: '等待搜索结果' },
      { id: Date.now() + 4, type: 'scroll', position: 300, behavior: 'smooth', delay: 1500, description: '滚动查看结果' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.addLog('info', '加载搜索操作预设');
    this.showStatus('✅ 已加载搜索操作预设 (含变量)', 'success');
  }

  loadRefreshPreset() {
    this.operations = [
      { id: Date.now() + 1, type: 'click', selector: '#submit-btn, button.submit', delay: 500, description: '点击提交' },
      { id: Date.now() + 2, type: 'refresh', refreshType: 'waitElement', waitSelector: '.success-message', waitTimeout: 5000, delay: 2000, description: '刷新等待结果' },
      { id: Date.now() + 3, type: 'wait', waitType: 'element', waitSelector: '.success-message', waitTimeout: 5000, delay: 0, description: '等待成功提示' },
      { id: Date.now() + 4, type: 'scroll', position: 200, behavior: 'smooth', delay: 1000, description: '查看结果' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.addLog('info', '加载刷新重试预设');
    this.showStatus('✅ 已加载刷新重试预设', 'success');
  }

  loadRepeatPreset() {
    this.operations = [
      { id: Date.now() + 1, type: 'wait', waitType: 'fixed', waitDuration: 1000, delay: 0, description: '等待1秒' },
      { id: Date.now() + 2, type: 'scroll', position: 500, behavior: 'smooth', delay: 1000, description: '向下滚动' }
    ];

    document.getElementById('enableRepeat').checked = true;
    document.getElementById('repeatMode').value = 'count';
    document.getElementById('repeatCount').value = '5';
    document.getElementById('repeatInterval').value = '3000';
    document.getElementById('stopOnError').checked = true;
    document.getElementById('showProgress').checked = true;

    this.toggleRepeatSettings();
    this.saveOperations();
    this.saveRepeatSettings();
    this.renderOperations();
    this.addLog('info', '加载重复刷新预设');
    this.showStatus('✅ 已加载重复执行预设 (5次)', 'success');
  }

  // ==================== UI渲染 ====================

  renderOperations() {
    const container = document.getElementById('operationsList');

    if (this.operations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>暂无操作</p>
          <p class="empty-hint">点击下方按钮添加操作</p>
        </div>`;
      return;
    }

    container.innerHTML = this.operations.map((op, index) => `
      <div class="operation-item" draggable="true" data-id="${op.id}">
        <div class="operation-header">
          <span class="operation-number">#${index + 1}</span>
          <span class="operation-type type-${op.type}">${this.getIcon(op.type)} ${op.description}</span>
          <div class="operation-controls">
            <button class="btn-icon-only" onclick="manager.moveOperation(${op.id}, 'up')" ${index === 0 ? 'disabled' : ''} title="上移">↑</button>
            <button class="btn-icon-only" onclick="manager.moveOperation(${op.id}, 'down')" ${index === this.operations.length - 1 ? 'disabled' : ''} title="下移">↓</button>
            <button class="btn-icon-only btn-delete" onclick="manager.deleteOperation(${op.id})" title="删除">✕</button>
          </div>
        </div>
        <div class="operation-content">
          ${this.renderFields(op)}
        </div>
      </div>
    `).join('');

    this.addFieldListeners();
    this.initDragDrop();
  }

  renderFields(op) {
    let fields = '';

    const pickerButton = (fieldId) => `
      <button class="btn-picker" onclick="manager.startPicker('${fieldId}')" title="点击拾取页面元素">
        🎯
      </button>`;

    switch (op.type) {
      case 'input':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>CSS选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#id, .class">
            </div>
            <div class="field-group flex-2">
              <label>输入内容 (支持变量)</label>
              <input type="text" class="field-value" data-id="${op.id}" value="${this.escapeHtml(op.value || '')}" placeholder="文本或 {{timestamp}}">
            </div>
          </div>`;
        break;

      case 'click':
        fields = `<div class="field-group">
          <label>CSS选择器 ${pickerButton(`selector-${op.id}`)}</label>
          <div class="input-with-picker">
            <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#btn, .submit">
          </div>
        </div>`;
        break;

      case 'scroll':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>位置(px)</label>
              <input type="number" class="field-position" data-id="${op.id}" value="${op.position || 500}">
            </div>
            <div class="field-group flex-1">
              <label>行为</label>
              <select class="field-behavior" data-id="${op.id}">
                <option value="smooth" ${op.behavior === 'smooth' ? 'selected' : ''}>平滑</option>
                <option value="auto" ${op.behavior === 'auto' ? 'selected' : ''}>立即</option>
              </select>
            </div>
          </div>`;
        break;

      case 'refresh':
        fields = `
          <div class="field-group">
            <label>刷新类型</label>
            <select class="field-refreshType" data-id="${op.id}">
              <option value="normal" ${op.refreshType === 'normal' ? 'selected' : ''}>普通刷新</option>
              <option value="hard" ${op.refreshType === 'hard' ? 'selected' : ''}>强制刷新</option>
              <option value="waitElement" ${op.refreshType === 'waitElement' ? 'selected' : ''}>刷新后等待元素</option>
            </select>
          </div>
          ${op.refreshType === 'waitElement' ? `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>等待元素 ${pickerButton(`waitSelector-${op.id}`)}</label>
              <input type="text" class="field-waitSelector" data-id="${op.id}" data-picker-target="waitSelector-${op.id}" value="${this.escapeHtml(op.waitSelector || '')}" placeholder=".success">
            </div>
            <div class="field-group flex-1">
              <label>超时(ms)</label>
              <input type="number" class="field-waitTimeout" data-id="${op.id}" value="${op.waitTimeout || 5000}">
            </div>
          </div>` : ''}`;
        break;

      case 'wait':
        fields = `
          <div class="field-group">
            <label>等待类型</label>
            <select class="field-waitType" data-id="${op.id}">
              <option value="fixed" ${op.waitType === 'fixed' ? 'selected' : ''}>固定时长</option>
              <option value="element" ${op.waitType === 'element' ? 'selected' : ''}>等待元素出现</option>
              <option value="elementVisible" ${op.waitType === 'elementVisible' ? 'selected' : ''}>等待元素可见</option>
              <option value="elementDisappear" ${op.waitType === 'elementDisappear' ? 'selected' : ''}>等待元素消失</option>
            </select>
          </div>
          ${op.waitType === 'fixed' ? `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>等待时长(ms)</label>
              <input type="number" class="field-waitDuration" data-id="${op.id}" value="${op.waitDuration || 2000}" min="0">
            </div>
          </div>` : `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>元素选择器 ${pickerButton(`waitSelectorOp-${op.id}`)}</label>
              <input type="text" class="field-waitSelectorOp" data-id="${op.id}" data-picker-target="waitSelectorOp-${op.id}" value="${this.escapeHtml(op.waitSelector || '')}" placeholder="#target">
            </div>
            <div class="field-group flex-1">
              <label>超时(ms)</label>
              <input type="number" class="field-waitTimeoutOp" data-id="${op.id}" value="${op.waitTimeout || 10000}" min="100">
            </div>
          </div>`}`;
        break;

      case 'select':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>下拉元素选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="select#city">
            </div>
            <div class="field-group flex-1">
              <label>选择方式</label>
              <select class="field-selectType" data-id="${op.id}">
                <option value="value" ${op.selectType === 'value' ? 'selected' : ''}>按值 (value)</option>
                <option value="index" ${op.selectType === 'index' ? 'selected' : ''}>按索引 (index)</option>
                <option value="text" ${op.selectType === 'text' ? 'selected' : ''}>按文本 (text)</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group flex-1">
              <label>目标值/索引/文本</label>
              <input type="text" class="field-selectValue" data-id="${op.id}" value="${this.escapeHtml(op.selectValue || '')}" placeholder="1 或 Beijing">
            </div>
          </div>`;
        break;

      case 'script':
        fields = `
          <div class="field-group">
            <label>JavaScript 代码 (支持变量)</label>
            <textarea class="field-scriptCode" data-id="${op.id}" rows="4" placeholder="return document.title; 或 findElement('#btn').click();">${this.escapeHtml(op.scriptCode || '')}</textarea>
          </div>
          <div class="script-hint">
            💡 可用变量: <code>{{loopIndex}}</code> <code>{{timestamp}}</code> | 可用函数: <code>findElement(selector)</code> <code>sleep(ms)</code>
          </div>`;
        break;

      case 'extract':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>元素选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#target">
            </div>
            <div class="field-group flex-1">
              <label>提取类型</label>
              <select class="field-extractType" data-id="${op.id}">
                <option value="text" ${op.extractType === 'text' ? 'selected' : ''}>文本内容</option>
                <option value="innerHtml" ${op.extractType === 'innerHtml' ? 'selected' : ''}>内部HTML</option>
                <option value="value" ${op.extractType === 'value' ? 'selected' : ''}>输入值</option>
                <option value="attribute" ${op.extractType === 'attribute' ? 'selected' : ''}>属性值</option>
                <option value="href" ${op.extractType === 'href' ? 'selected' : ''}>链接地址</option>
                <option value="src" ${op.extractType === 'src' ? 'selected' : ''}>图片地址</option>
              </select>
            </div>
          </div>
          ${op.extractType === 'attribute' ? `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>属性名称</label>
              <input type="text" class="field-extractAttribute" data-id="${op.id}" value="${this.escapeHtml(op.extractAttribute || '')}" placeholder="class, data-id...">
            </div>
          </div>` : ''}`;
        break;

      case 'keyboard':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>按键类型</label>
              <select class="field-keyType" data-id="${op.id}">
                <option value="key" ${op.keyType === 'key' ? 'selected' : ''}>普通按键</option>
                <option value="modifier" ${op.keyType === 'modifier' ? 'selected' : ''}>组合键</option>
                <option value="sequence" ${op.keyType === 'sequence' ? 'selected' : ''}>按键序列</option>
              </select>
            </div>
            <div class="field-group flex-2">
              <label>按键值</label>
              <input type="text" class="field-keyValue" data-id="${op.id}" value="${this.escapeHtml(op.keyValue || 'Enter')}" placeholder="Enter, Tab, Escape...">
            </div>
          </div>
          <div class="field-row">
            <div class="field-group flex-1">
              <label>修饰键</label>
              <div class="modifier-checkboxes">
                <label class="checkbox-label"><input type="checkbox" class="field-modCtrl" data-id="${op.id}" ${(op.modifierKeys || []).includes('ctrl') ? 'checked' : ''}> Ctrl</label>
                <label class="checkbox-label"><input type="checkbox" class="field-modShift" data-id="${op.id}" ${(op.modifierKeys || []).includes('shift') ? 'checked' : ''}> Shift</label>
                <label class="checkbox-label"><input type="checkbox" class="field-modAlt" data-id="${op.id}" ${(op.modifierKeys || []).includes('alt') ? 'checked' : ''}> Alt</label>
              </div>
            </div>
          </div>
          <div class="keyboard-hint">💡 常用键: Enter, Tab, Escape, Backspace, ArrowUp, F1-F12</div>`;
        break;

      case 'screenshot':
        fields = `
          <div class="field-group">
            <label>截屏类型</label>
            <select class="field-screenshotType" data-id="${op.id}">
              <option value="page" ${op.screenshotType === 'page' ? 'selected' : ''}>整页截图</option>
              <option value="viewport" ${op.screenshotType === 'viewport' ? 'selected' : ''}>可视区域</option>
              <option value="element" ${op.screenshotType === 'element' ? 'selected' : ''}>元素截图</option>
            </select>
          </div>
          ${op.screenshotType === 'element' ? `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>元素选择器 ${pickerButton(`screenshotSelector-${op.id}`)}</label>
              <input type="text" class="field-screenshotSelector" data-id="${op.id}" data-picker-target="screenshotSelector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#target">
            </div>
          </div>` : ''}`;
        break;

      case 'clipboard':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>操作类型</label>
              <select class="field-clipboardAction" data-id="${op.id}">
                <option value="write" ${op.clipboardAction === 'write' ? 'selected' : ''}>写入剪贴板</option>
                <option value="read" ${op.clipboardAction === 'read' ? 'selected' : ''}>读取剪贴板</option>
              </select>
            </div>
          </div>
          ${op.clipboardAction === 'write' ? `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>写入内容</label>
              <input type="text" class="field-clipboardValue" data-id="${op.id}" value="${this.escapeHtml(op.clipboardValue || '')}" placeholder="文本内容">
            </div>
            <div class="field-group flex-1">
              <label>存储变量</label>
              <input type="text" class="field-clipboardVariable" data-id="${op.id}" value="${this.escapeHtml(op.clipboardVariable || '')}" placeholder="myData">
            </div>
          </div>` : `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>存储变量</label>
              <input type="text" class="field-clipboardVariable" data-id="${op.id}" value="${this.escapeHtml(op.clipboardVariable || '')}" placeholder="clipboardContent">
            </div>
          </div>`}`;
        break;

      case 'httpRequest':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>请求方法</label>
              <select class="field-httpMethod" data-id="${op.id}">
                <option value="GET" ${op.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" ${op.httpMethod === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" ${op.httpMethod === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="DELETE" ${op.httpMethod === 'DELETE' ? 'selected' : ''}>DELETE</option>
                <option value="PATCH" ${op.httpMethod === 'PATCH' ? 'selected' : ''}>PATCH</option>
              </select>
            </div>
            <div class="field-group flex-2">
              <label>请求URL (支持变量)</label>
              <input type="text" class="field-httpUrl" data-id="${op.id}" value="${this.escapeHtml(op.httpUrl || '')}" placeholder="https://api.example.com/data">
            </div>
          </div>
          <div class="field-group">
            <label>请求头 (每行一个, 格式: Key: Value)</label>
            <textarea class="field-httpHeaders" data-id="${op.id}" rows="2" placeholder="Content-Type: application/json&#10;Authorization: Bearer token">${this.escapeHtml(op.httpHeaders || '')}</textarea>
          </div>
          ${op.httpMethod !== 'GET' ? `
          <div class="field-group">
            <label>请求体 (支持变量)</label>
            <textarea class="field-httpBody" data-id="${op.id}" rows="3" placeholder='{"key": "value"}'>${this.escapeHtml(op.httpBody || '')}</textarea>
          </div>` : ''}
          <div class="field-row">
            <div class="field-group flex-1">
              <label>保存响应到变量</label>
              <input type="text" class="field-httpSaveVariable" data-id="${op.id}" value="${this.escapeHtml(op.httpSaveVariable || '')}" placeholder="responseData">
            </div>
          </div>
          <div class="http-hint">💡 响应内容可通过变量引用，支持GET/POST/PUT/DELETE/PATCH</div>`;
        break;

      case 'tab':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>操作类型</label>
              <select class="field-tabAction" data-id="${op.id}">
                <option value="open" ${op.tabAction === 'open' ? 'selected' : ''}>打开新标签页</option>
                <option value="close" ${op.tabAction === 'close' ? 'selected' : ''}>关闭当前标签页</option>
                <option value="reload" ${op.tabAction === 'reload' ? 'selected' : ''}>重载当前标签页</option>
                <option value="focus" ${op.tabAction === 'focus' ? 'selected' : ''}>聚焦当前标签页</option>
              </select>
            </div>
          </div>
          ${op.tabAction === 'open' ? `
          <div class="field-group">
            <label>URL地址 (支持变量)</label>
            <input type="text" class="field-tabUrl" data-id="${op.id}" value="${this.escapeHtml(op.tabUrl || '')}" placeholder="https://example.com">
          </div>` : ''}`;
        break;

      case 'notification':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>通知标题 (支持变量)</label>
              <input type="text" class="field-notifTitle" data-id="${op.id}" value="${this.escapeHtml(op.notifTitle || '')}" placeholder="通知标题">
            </div>
            <div class="field-group flex-1">
              <label>显示时长(ms)</label>
              <input type="number" class="field-notifDuration" data-id="${op.id}" value="${op.notifDuration || 3000}" min="1000">
            </div>
          </div>
          <div class="field-group">
            <label>通知内容 (支持变量)</label>
            <input type="text" class="field-notifBody" data-id="${op.id}" value="${this.escapeHtml(op.notifBody || '')}" placeholder="通知正文内容">
          </div>`;
        break;

      case 'cookie':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>操作类型</label>
              <select class="field-cookieAction" data-id="${op.id}">
                <option value="get" ${op.cookieAction === 'get' ? 'selected' : ''}>读取Cookie</option>
                <option value="set" ${op.cookieAction === 'set' ? 'selected' : ''}>设置Cookie</option>
                <option value="delete" ${op.cookieAction === 'delete' ? 'selected' : ''}>删除Cookie</option>
              </select>
            </div>
            <div class="field-group flex-2">
              <label>Cookie名称 (支持变量)</label>
              <input type="text" class="field-cookieName" data-id="${op.id}" value="${this.escapeHtml(op.cookieName || '')}" placeholder="session_id">
            </div>
          </div>
          ${op.cookieAction === 'set' ? `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>Cookie值 (支持变量)</label>
              <input type="text" class="field-cookieValue" data-id="${op.id}" value="${this.escapeHtml(op.cookieValue || '')}" placeholder="value123">
            </div>
            <div class="field-group flex-1">
              <label>过期时间(秒)</label>
              <input type="text" class="field-cookieMaxAge" data-id="${op.id}" value="${this.escapeHtml(op.cookieMaxAge || '')}" placeholder="3600">
            </div>
          </div>
          <div class="field-row">
            <div class="field-group flex-1">
              <label>域名</label>
              <input type="text" class="field-cookieDomain" data-id="${op.id}" value="${this.escapeHtml(op.cookieDomain || '')}" placeholder=".example.com">
            </div>
            <div class="field-group flex-1">
              <label>路径</label>
              <input type="text" class="field-cookiePath" data-id="${op.id}" value="${this.escapeHtml(op.cookiePath || '/')}" placeholder="/">
            </div>
          </div>` : ''}
          ${op.cookieAction === 'get' ? `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>存储到变量</label>
              <input type="text" class="field-cookieVariable" data-id="${op.id}" value="${this.escapeHtml(op.cookieVariable || '')}" placeholder="myCookie">
            </div>
          </div>` : ''}`;
        break;

      case 'hover':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>CSS选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#menu, .dropdown">
            </div>
            <div class="field-group flex-1">
              <label>悬停时长(ms)</label>
              <input type="number" class="field-hoverDuration" data-id="${op.id}" value="${op.hoverDuration || 1000}" min="100">
            </div>
          </div>
          <div class="hover-hint">💡 悬停操作会触发 mouseover/mouseenter 事件，适用于下拉菜单等场景</div>`;
        break;

      case 'doubleClick':
        fields = `
          <div class="field-group">
            <label>CSS选择器 ${pickerButton(`selector-${op.id}`)}</label>
            <div class="input-with-picker">
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#target, .item">
            </div>
          </div>
          <div class="dblclick-hint">💡 双击操作会触发完整的鼠标事件序列和 dblclick 事件</div>`;
        break;

      case 'if':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>判断模式</label>
              <select class="field-ifMode" data-id="${op.id}">
                <option value="skip" ${op.ifMode === 'skip' ? 'selected' : ''}>条件不满足时跳过当前迭代</option>
                <option value="pass" ${op.ifMode === 'pass' ? 'selected' : ''}>条件满足时跳过当前迭代</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group flex-1">
              <label>条件类型</label>
              <select class="field-ifConditionType" data-id="${op.id}">
                <option value="elementExists" ${op.ifConditionType === 'elementExists' ? 'selected' : ''}>元素存在</option>
                <option value="elementNotExists" ${op.ifConditionType === 'elementNotExists' ? 'selected' : ''}>元素不存在</option>
                <option value="elementVisible" ${op.ifConditionType === 'elementVisible' ? 'selected' : ''}>元素可见</option>
                <option value="elementNotVisible" ${op.ifConditionType === 'elementNotVisible' ? 'selected' : ''}>元素不可见</option>
                <option value="variableEquals" ${op.ifConditionType === 'variableEquals' ? 'selected' : ''}>变量等于</option>
                <option value="variableNotEmpty" ${op.ifConditionType === 'variableNotEmpty' ? 'selected' : ''}>变量非空</option>
              </select>
            </div>
          </div>
          ${(op.ifConditionType || 'elementExists').startsWith('element') ? `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>元素选择器 ${pickerButton(`ifSelector-${op.id}`)}</label>
              <input type="text" class="field-ifSelector" data-id="${op.id}" data-picker-target="ifSelector-${op.id}" value="${this.escapeHtml(op.ifSelector || '')}" placeholder="#target, .item">
            </div>
          </div>` : `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>变量名</label>
              <input type="text" class="field-ifVariableName" data-id="${op.id}" value="${this.escapeHtml(op.ifVariableName || '')}" placeholder="myVar">
            </div>
            ${op.ifConditionType === 'variableEquals' ? `
            <div class="field-group flex-2">
              <label>期望值 (支持变量)</label>
              <input type="text" class="field-ifVariableValue" data-id="${op.id}" value="${this.escapeHtml(op.ifVariableValue || '')}" placeholder="期望的值">
            </div>` : ''}
          </div>`}
          <div class="if-hint">💡 条件判断会跳过当前循环迭代中剩余的操作；用变量 {{var:name}} 引用先前设置的变量</div>`;
        break;

      case 'fileUpload':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>文件输入框选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="input[type=file]">
            </div>
            <div class="field-group flex-1">
              <label>保存文件名 (支持变量)</label>
              <input type="text" class="field-fileName" data-id="${op.id}" value="${this.escapeHtml(op.fileName || 'uploaded-file')}" placeholder="file.png">
            </div>
          </div>
          <div class="field-group">
            <label>文件URL (支持变量，将自动下载并上传)</label>
            <input type="text" class="field-fileUrl" data-id="${op.id}" value="${this.escapeHtml(op.fileUrl || '')}" placeholder="https://example.com/file.pdf">
          </div>
          <div class="fileupload-hint">💡 通过 URL 拉取文件并填充到 input[type=file]，目标元素必须是文件输入框</div>`;
        break;

      case 'setVariable':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>变量操作</label>
              <select class="field-varAction" data-id="${op.id}">
                <option value="set" ${op.varAction === 'set' ? 'selected' : ''}>设置 (覆盖)</option>
                <option value="append" ${op.varAction === 'append' ? 'selected' : ''}>追加 (字符串拼接)</option>
                <option value="increment" ${op.varAction === 'increment' ? 'selected' : ''}>自增 (数字)</option>
                <option value="clear" ${op.varAction === 'clear' ? 'selected' : ''}>清除</option>
              </select>
            </div>
            <div class="field-group flex-1">
              <label>变量名</label>
              <input type="text" class="field-varName" data-id="${op.id}" value="${this.escapeHtml(op.varName || '')}" placeholder="myVar">
            </div>
          </div>
          ${op.varAction !== 'clear' ? `
          <div class="field-group">
            <label>变量值 (支持变量)</label>
            <input type="text" class="field-varValue" data-id="${op.id}" value="${this.escapeHtml(op.varValue || '')}" placeholder="值或 {{var:otherVar}}">
          </div>` : ''}
          <div class="var-hint">💡 设置的变量可通过 {{var:变量名}} 在后续操作中引用</div>`;
        break;

      case 'setAttribute':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2">
              <label>元素选择器 ${pickerButton(`selector-${op.id}`)}</label>
              <input type="text" class="field-selector" data-id="${op.id}" data-picker-target="selector-${op.id}" value="${this.escapeHtml(op.selector || '')}" placeholder="#target">
            </div>
            <div class="field-group flex-1">
              <label>操作类型</label>
              <select class="field-attrAction" data-id="${op.id}">
                <option value="set" ${op.attrAction === 'set' ? 'selected' : ''}>设置属性</option>
                <option value="remove" ${op.attrAction === 'remove' ? 'selected' : ''}>移除属性</option>
                <option value="toggle" ${op.attrAction === 'toggle' ? 'selected' : ''}>切换属性</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group flex-1">
              <label>属性名 (支持变量)</label>
              <input type="text" class="field-attrName" data-id="${op.id}" value="${this.escapeHtml(op.attrName || '')}" placeholder="disabled, checked, data-id">
            </div>
            ${op.attrAction !== 'remove' ? `
            <div class="field-group flex-2">
              <label>属性值 (支持变量)</label>
              <input type="text" class="field-attrValue" data-id="${op.id}" value="${this.escapeHtml(op.attrValue || '')}" placeholder="属性值">
            </div>` : ''}
          </div>
          <div class="attr-hint">💡 设置后自动触发 change 事件；常用于禁用/启用按钮、勾选复选框、修改 data-* 属性</div>`;
        break;

      case 'storage':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>存储类型</label>
              <select class="field-storageType" data-id="${op.id}">
                <option value="localStorage" ${op.storageType === 'localStorage' ? 'selected' : ''}>localStorage</option>
                <option value="sessionStorage" ${op.storageType === 'sessionStorage' ? 'selected' : ''}>sessionStorage</option>
              </select>
            </div>
            <div class="field-group flex-1">
              <label>操作类型</label>
              <select class="field-storageAction" data-id="${op.id}">
                <option value="get" ${op.storageAction === 'get' ? 'selected' : ''}>读取</option>
                <option value="set" ${op.storageAction === 'set' ? 'selected' : ''}>写入</option>
                <option value="remove" ${op.storageAction === 'remove' ? 'selected' : ''}>删除</option>
                <option value="clear" ${op.storageAction === 'clear' ? 'selected' : ''}>清空</option>
              </select>
            </div>
          </div>
          ${op.storageAction !== 'clear' ? `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>键名 (支持变量)</label>
              <input type="text" class="field-storageKey" data-id="${op.id}" value="${this.escapeHtml(op.storageKey || '')}" placeholder="myKey">
            </div>
            ${op.storageAction === 'set' ? `
            <div class="field-group flex-2">
              <label>值 (支持变量)</label>
              <input type="text" class="field-storageValue" data-id="${op.id}" value="${this.escapeHtml(op.storageValue || '')}" placeholder="要存储的值">
            </div>` : ''}
          </div>` : ''}
          ${op.storageAction === 'get' ? `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>保存到变量 (留空则不保存)</label>
              <input type="text" class="field-storageVariable" data-id="${op.id}" value="${this.escapeHtml(op.storageVariable || '')}" placeholder="storedValue">
            </div>
          </div>` : ''}
          <div class="storage-hint">💡 读取的值可保存到自定义变量，后续用 {{var:变量名}} 引用</div>`;
        break;

      case 'navigate':
        fields = `
          <div class="field-row">
            <div class="field-group flex-1">
              <label>导航操作</label>
              <select class="field-navigateAction" data-id="${op.id}">
                <option value="url" ${op.navigateAction === 'url' ? 'selected' : ''}>跳转到URL</option>
                <option value="back" ${op.navigateAction === 'back' ? 'selected' : ''}>后退</option>
                <option value="forward" ${op.navigateAction === 'forward' ? 'selected' : ''}>前进</option>
                <option value="reload" ${op.navigateAction === 'reload' ? 'selected' : ''}>重新加载</option>
              </select>
            </div>
            ${op.navigateAction === 'url' ? `
            <div class="field-group flex-1">
              <label>等待加载</label>
              <select class="field-navigateWaitLoad" data-id="${op.id}">
                <option value="true" ${op.navigateWaitLoad !== false ? 'selected' : ''}>是 (保留历史)</option>
                <option value="false" ${op.navigateWaitLoad === false ? 'selected' : ''}>否 (替换历史)</option>
              </select>
            </div>` : ''}
          </div>
          ${op.navigateAction === 'url' ? `
          <div class="field-group">
            <label>目标URL (支持变量，支持相对路径)</label>
            <input type="text" class="field-navigateUrl" data-id="${op.id}" value="${this.escapeHtml(op.navigateUrl || '')}" placeholder="https://example.com 或 /path">
          </div>` : ''}
          <div class="navigate-hint">💡 跳转URL后页面会重新加载，建议作为单次操作的最后一步</div>`;
        break;
    }

    fields += `
      <div class="field-row">
        <div class="field-group flex-1">
          <label>前置延迟(ms)</label>
          <input type="number" class="field-delay" data-id="${op.id}" value="${op.delay || 0}" min="0">
        </div>
        <div class="field-group flex-2">
          <label>描述</label>
          <input type="text" class="field-description" data-id="${op.id}" value="${this.escapeHtml(op.description || '')}" placeholder="说明">
        </div>
      </div>`;

    return fields;
  }

  addFieldListeners() {
    const fieldMap = {
      'field-selector': 'selector',
      'field-value': 'value',
      'field-position': 'position',
      'field-delay': 'delay',
      'field-description': 'description',
      'field-waitSelector': 'waitSelector',
      'field-waitDuration': 'waitDuration',
      'field-waitTimeout': 'waitTimeout',
      'field-waitTimeoutOp': 'waitTimeout',
      'field-waitSelectorOp': 'waitSelector',
      'field-selectValue': 'selectValue',
      'field-scriptCode': 'scriptCode',
      'field-extractAttribute': 'extractAttribute',
      'field-keyValue': 'keyValue',
      'field-screenshotSelector': 'selector',
      'field-clipboardValue': 'clipboardValue',
      'field-clipboardVariable': 'clipboardVariable',
      'field-httpUrl': 'httpUrl',
      'field-httpHeaders': 'httpHeaders',
      'field-httpBody': 'httpBody',
      'field-httpSaveVariable': 'httpSaveVariable',
      'field-tabUrl': 'tabUrl',
      'field-notifTitle': 'notifTitle',
      'field-notifBody': 'notifBody',
      'field-cookieName': 'cookieName',
      'field-cookieValue': 'cookieValue',
      'field-cookieDomain': 'cookieDomain',
      'field-cookiePath': 'cookiePath',
      'field-cookieMaxAge': 'cookieMaxAge',
      'field-cookieVariable': 'cookieVariable',
      'field-hoverDuration': 'hoverDuration',
      'field-ifSelector': 'ifSelector',
      'field-ifVariableName': 'ifVariableName',
      'field-ifVariableValue': 'ifVariableValue',
      'field-fileUrl': 'fileUrl',
      'field-fileName': 'fileName',
      'field-varName': 'varName',
      'field-varValue': 'varValue',
      'field-attrName': 'attrName',
      'field-attrValue': 'attrValue',
      'field-storageKey': 'storageKey',
      'field-storageValue': 'storageValue',
      'field-storageVariable': 'storageVariable',
      'field-navigateUrl': 'navigateUrl'
    };

    Object.entries(fieldMap).forEach(([cls, prop]) => {
      document.querySelectorAll(`.${cls}`).forEach(input => {
        input.addEventListener('change', (e) => {
          const id = parseInt(e.target.dataset.id);
          let val = e.target.value;
          if (['field-position', 'field-delay', 'field-waitDuration', 'field-waitTimeout', 'field-waitTimeoutOp', 'field-hoverDuration'].includes(cls)) {
            val = parseInt(val) || 0;
          }
          this.updateOperation(id, prop, val);
        });
        // textarea 需要监听 input 事件
        if (input.tagName === 'TEXTAREA') {
          input.addEventListener('input', (e) => {
            const id = parseInt(e.target.dataset.id);
            this.updateOperation(id, prop, e.target.value);
          });
        }
      });
    });

    document.querySelectorAll('.field-behavior').forEach(s => {
      s.addEventListener('change', (e) => this.updateOperation(parseInt(e.target.dataset.id), 'behavior', e.target.value));
    });

    document.querySelectorAll('.field-refreshType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'refreshType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-waitType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'waitType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-selectType').forEach(s => {
      s.addEventListener('change', (e) => this.updateOperation(parseInt(e.target.dataset.id), 'selectType', e.target.value));
    });

    document.querySelectorAll('.field-extractType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'extractType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-keyType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'keyType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-screenshotType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'screenshotType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-clipboardAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'clipboardAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-httpMethod').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'httpMethod', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-tabAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'tabAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-cookieAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'cookieAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-ifMode').forEach(s => {
      s.addEventListener('change', (e) => this.updateOperation(parseInt(e.target.dataset.id), 'ifMode', e.target.value));
    });

    document.querySelectorAll('.field-ifConditionType').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'ifConditionType', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-varAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'varAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-attrAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'attrAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-storageType').forEach(s => {
      s.addEventListener('change', (e) => this.updateOperation(parseInt(e.target.dataset.id), 'storageType', e.target.value));
    });

    document.querySelectorAll('.field-storageAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'storageAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-navigateAction').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'navigateAction', e.target.value);
        this.renderOperations();
      });
    });

    document.querySelectorAll('.field-navigateWaitLoad').forEach(s => {
      s.addEventListener('change', (e) => {
        this.updateOperation(parseInt(e.target.dataset.id), 'navigateWaitLoad', e.target.value === 'true');
      });
    });

    ['field-modCtrl', 'field-modShift', 'field-modAlt'].forEach(cls => {
      document.querySelectorAll(`.${cls}`).forEach(cb => {
        cb.addEventListener('change', (e) => {
          const id = parseInt(e.target.dataset.id);
          const operation = this.operations.find(op => op.id === id);
          if (operation) {
            const modKey = cls === 'field-modCtrl' ? 'ctrl' : cls === 'field-modShift' ? 'shift' : 'alt';
            if (!operation.modifierKeys) operation.modifierKeys = [];
            if (e.target.checked) {
              if (!operation.modifierKeys.includes(modKey)) operation.modifierKeys.push(modKey);
            } else {
              operation.modifierKeys = operation.modifierKeys.filter(k => k !== modKey);
            }
            this.saveOperations();
          }
        });
      });
    });
  }

  initDragDrop() {
    let dragId = null;
    document.querySelectorAll('.operation-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragId = parseInt(e.target.closest('.operation-item').dataset.id);
        e.target.closest('.operation-item').style.opacity = '0.4';
      });
      item.addEventListener('dragover', (e) => e.preventDefault());
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = parseInt(e.target.closest('.operation-item').dataset.id);
        if (dragId && dragId !== targetId) {
          const si = this.operations.findIndex(o => o.id === dragId);
          const ti = this.operations.findIndex(o => o.id === targetId);
          const [moved] = this.operations.splice(si, 1);
          this.operations.splice(ti, 0, moved);
          this.saveOperations();
          this.renderOperations();
        }
      });
      item.addEventListener('dragend', (e) => { e.target.closest('.operation-item').style.opacity = '1'; });
    });
  }

  getIcon(type) {
    const icons = { input: '📝', click: '👆', scroll: '↕️', refresh: '🔄', wait: '⏳', select: '📋', script: '⚡', extract: '🔍', keyboard: '⌨️', screenshot: '📷', clipboard: '📎', httpRequest: '🌐', tab: '🗂', notification: '🔔', cookie: '🍪', hover: '🖱', doubleClick: '👆👆', if: '🔀', fileUpload: '📁', setVariable: '📦', setAttribute: '🏷', storage: '🗄', navigate: '🧭' };
    return icons[type] || '❓';
  }

  showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = `status status-${type}`;
    if (type === 'success' || type === 'info') setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 4000);
  }

  renderLogs() {
    const container = document.getElementById('logContainer');
    if (!this.logs || this.logs.length === 0) {
      container.innerHTML = '<div class="log-empty">暂无日志</div>';
      return;
    }

    container.innerHTML = this.logs.slice(-20).reverse().map(log => `
      <div class="log-item log-${log.type}">
        <span class="log-time">${log.time}</span>
        <span class="log-msg">${this.escapeHtml(log.message)}</span>
      </div>
    `).join('');
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  showHelp() {
    alert(`📖 使用帮助 v1.7.0

【操作类型】
📝 输入       - 填写表单内容 (支持变量)
👆 点击       - 点击任意元素
↕️ 滑动       - 滚动到指定位置
🔄 刷新       - 重新加载页面
⏳ 等待       - 等待固定时长 / 元素出现 / 元素消失
📋 选择       - 操作下拉列表 (按值/索引/文本)
⚡ 脚本       - 执行自定义 JavaScript
🔍 提取       - 获取元素文本/属性值
⌨️ 键盘       - 模拟键盘按键/组合键
📷 截屏       - 整页/可视区域截图
📎 剪贴板     - 读写剪贴板内容
🌐 HTTP       - 发起 HTTP 请求
🗂 标签页     - 打开/关闭/重载标签页
🔔 通知       - 发送系统通知
🍪 Cookie     - 读写删除 Cookie
🖱 悬停       - 触发鼠标悬停事件
👆👆 双击     - 触发双击事件
🔀 条件判断   - 满足/不满足条件时跳过当前迭代
📁 文件上传   - 通过 URL 上传文件到 input[type=file]
📦 变量设置   - 设置/追加/自增/清除自定义变量
🏷 元素属性   - 设置/移除/切换元素属性
🗄 本地存储   - 读写 localStorage/sessionStorage
🧭 页面导航   - 跳转URL/后退/前进/重新加载

【元素拾取器】
点击 🎯 按钮可进入拾取模式
在页面中点击元素自动获取选择器
按 ESC 取消拾取

【选择器】
CSS选择器: #id .class [name="x"]
XPath: //button[contains(text(),'登录')]

【变量】(在输入框中使用)
{{timestamp}}  - 时间戳 (毫秒)
{{date}}       - 当前日期 YYYY-MM-DD
{{datetime}}   - 当前日期时间
{{random}}     - 0-1 的随机数
{{randomInt:min:max}} - 范围内随机整数
{{uuid}}       - 随机 UUID
{{loopIndex}}  - 当前循环次数 (从1开始)
{{var:变量名}} - 引用 setVariable 操作设置的变量

【脚本执行】
可用函数: findElement(selector), sleep(ms)
可用变量: loopIndex, document, window

【重复】
指定次数 / 无限循环 / 条件循环

【快捷键】
Ctrl+Shift+E - 执行保存的操作
Ctrl+Shift+S - 停止执行

【配置导入导出】
⬇ 导出当前所有操作为 JSON
⬆ 从 JSON 文件导入操作配置

💡 如遇连接错误，请刷新页面后重试`);
  }
}

let manager;
document.addEventListener('DOMContentLoaded', () => { manager = new OperationManager(); });
