/**
 * 网页操作执行器 - 弹出窗口脚本 v1.2.1
 * 修复了 content script 连接问题
 */

class OperationManager {
  constructor() {
    this.operations = [];
    this.isExecuting = false;
    this.shouldStop = false;
    this.currentRepeat = 0;
    this.totalRepeats = 0;
    
    this.init();
  }

  async init() {
    await this.loadOperations();
    await this.loadRepeatSettings();
    this.initEventListeners();
    this.renderOperations();
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

  // ==================== 事件监听 ====================

  initEventListeners() {
    document.getElementById('addInput').addEventListener('click', () => this.addOperation('input'));
    document.getElementById('addClick').addEventListener('click', () => this.addOperation('click'));
    document.getElementById('addScroll').addEventListener('click', () => this.addOperation('scroll'));
    document.getElementById('addRefresh').addEventListener('click', () => this.addOperation('refresh'));
    
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
  }

  // ==================== 工具方法 ====================

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 【核心修复】确保 content script 已注入
  async ensureContentScriptInjected(tab) {
    // 先尝试 ping
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (response && response.pong) {
        console.log('✅ Content script 已就绪');
        return;
      }
    } catch (error) {
      console.log('Content script 未响应，尝试注入...');
    }

    // 注入 content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script 注入成功');
      
      // 等待初始化
      await this.sleep(300);
      
      // 验证
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      console.log('✅ Content script 验证成功');
    } catch (error) {
      console.error('Content script 注入失败:', error);
      throw new Error('无法在此页面执行操作。请刷新页面后重试，或检查是否在浏览器内部页面。');
    }
  }

  // 【核心修复】带重试的消息发送
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
      id: Date.now(),
      delay: 1000
    };

    const operations = {
      input: { ...baseOperation, type: 'input', selector: '', value: '', description: '输入文本' },
      click: { ...baseOperation, type: 'click', selector: '', description: '点击元素' },
      scroll: { ...baseOperation, type: 'scroll', position: 500, behavior: 'smooth', description: '滚动页面' },
      refresh: { ...baseOperation, type: 'refresh', refreshType: 'normal', waitSelector: '', waitTimeout: 5000, description: '刷新页面' }
    };

    this.operations.push(operations[type]);
    this.saveOperations();
    this.renderOperations();
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
    
    const buttons = document.querySelectorAll('.controls .btn, .preset-buttons .btn, #clearAll');
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
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stopExecution' })
          .catch(() => {}); // 忽略连接错误
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
    const repeatInterval = parseInt(document.getElementById('repeatInterval').value);
    const stopOnError = document.getElementById('stopOnError').checked;

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
    
    if (this.totalRepeats === -1) {
      this.showStatus('🔄 无限循环执行中...', 'info');
    } else if (this.totalRepeats === -2) {
      this.showStatus('🔄 条件循环执行中...', 'info');
    } else {
      this.showStatus(`▶ 执行中... (共 ${this.totalRepeats} 次)`, 'info');
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('未找到活动标签页，请打开一个网页');
      }

      // 检查特殊页面
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('edge://') || 
          tab.url.startsWith('about:') ||
          tab.url.startsWith('chrome-extension://')) {
        throw new Error('无法在浏览器内部页面执行操作，请打开普通网页');
      }

      // 【关键】确保 content script 已注入
      await this.ensureContentScriptInjected(tab);
      
      // 发送配置
      await this.sendMessageWithRetry(tab.id, {
        action: 'setRepeatConfig',
        config: {
          repeatMode, repeatCount, repeatInterval, stopOnError,
          conditionType: document.getElementById('conditionType').value,
          conditionSelector: document.getElementById('conditionSelector').value,
          conditionTimeout: parseInt(document.getElementById('conditionTimeout').value),
          totalRepeats: this.totalRepeats
        }
      });

      // 开始循环
      await this.executeLoop(tab, repeatInterval);
      
    } catch (error) {
      if (error.message === '用户停止执行') {
        this.showStatus('⏹ 执行已停止', 'warning');
      } else {
        this.showStatus(`❌ ${error.message}`, 'error');
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
            total: this.totalRepeats
          }
        });

        if (response && !response.success) {
          if (response.shouldStop || document.getElementById('stopOnError').checked) {
            throw new Error(response.error || '执行失败');
          }
          console.warn('操作执行失败，继续:', response.error);
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
              break;
            }
          } catch (error) {
            console.warn('检查条件失败:', error.message);
          }
        }

        if (this.totalRepeats > 0 && this.currentRepeat >= this.totalRepeats) {
          break;
        }

        if (interval > 0 && !this.shouldStop) {
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
      { id: Date.now(), type: 'input', selector: '#username', value: 'demo@example.com', delay: 500, description: '输入用户名' },
      { id: Date.now() + 1, type: 'input', selector: '#password', value: 'password123', delay: 500, description: '输入密码' },
      { id: Date.now() + 2, type: 'click', selector: '#login-btn, button[type="submit"]', delay: 1000, description: '点击登录' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.showStatus('✅ 已加载登录表单预设', 'success');
  }

  loadSearchPreset() {
    this.operations = [
      { id: Date.now(), type: 'input', selector: '#search-input, input[type="search"]', value: 'Chrome Extension', delay: 500, description: '输入搜索词' },
      { id: Date.now() + 1, type: 'click', selector: '#search-btn, button[type="submit"]', delay: 800, description: '点击搜索' },
      { id: Date.now() + 2, type: 'scroll', position: 300, behavior: 'smooth', delay: 1500, description: '滚动查看结果' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.showStatus('✅ 已加载搜索操作预设', 'success');
  }

  loadRefreshPreset() {
    this.operations = [
      { id: Date.now(), type: 'click', selector: '#submit-btn', delay: 500, description: '点击提交' },
      { id: Date.now() + 1, type: 'refresh', refreshType: 'waitElement', waitSelector: '.success-message', waitTimeout: 5000, delay: 2000, description: '刷新等待结果' },
      { id: Date.now() + 2, type: 'scroll', position: 200, behavior: 'smooth', delay: 1000, description: '查看结果' }
    ];
    this.saveOperations();
    this.renderOperations();
    this.showStatus('✅ 已加载刷新重试预设', 'success');
  }

  loadRepeatPreset() {
    this.operations = [
      { id: Date.now(), type: 'click', selector: '#refresh-btn', delay: 500, description: '点击刷新按钮' },
      { id: Date.now() + 1, type: 'scroll', position: 500, behavior: 'smooth', delay: 1000, description: '向下滚动' }
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
    this.showStatus('✅ 已加载重复刷新预设 (5次)', 'success');
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
    
    switch(op.type) {
      case 'input':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2"><label>CSS选择器</label><input type="text" class="field-selector" data-id="${op.id}" value="${op.selector}" placeholder="#id, .class"></div>
            <div class="field-group flex-2"><label>输入内容</label><input type="text" class="field-value" data-id="${op.id}" value="${op.value}" placeholder="文本"></div>
          </div>`;
        break;
      case 'click':
        fields = `<div class="field-group"><label>CSS选择器</label><input type="text" class="field-selector" data-id="${op.id}" value="${op.selector}" placeholder="#btn, .submit"></div>`;
        break;
      case 'scroll':
        fields = `
          <div class="field-row">
            <div class="field-group flex-2"><label>位置(px)</label><input type="number" class="field-position" data-id="${op.id}" value="${op.position || 500}"></div>
            <div class="field-group flex-1"><label>行为</label><select class="field-behavior" data-id="${op.id}"><option value="smooth" ${op.behavior==='smooth'?'selected':''}>平滑</option><option value="auto" ${op.behavior==='auto'?'selected':''}>立即</option></select></div>
          </div>`;
        break;
      case 'refresh':
        fields = `
          <div class="field-group"><label>刷新类型</label><select class="field-refreshType" data-id="${op.id}"><option value="normal" ${op.refreshType==='normal'?'selected':''}>普通刷新</option><option value="hard" ${op.refreshType==='hard'?'selected':''}>强制刷新</option><option value="waitElement" ${op.refreshType==='waitElement'?'selected':''}>刷新后等待元素</option></select></div>
          ${op.refreshType==='waitElement' ? `
          <div class="field-row">
            <div class="field-group flex-2"><label>等待元素</label><input type="text" class="field-waitSelector" data-id="${op.id}" value="${op.waitSelector||''}" placeholder=".success"></div>
            <div class="field-group flex-1"><label>超时(ms)</label><input type="number" class="field-waitTimeout" data-id="${op.id}" value="${op.waitTimeout||5000}"></div>
          </div>` : ''}`;
        break;
    }
    
    fields += `
      <div class="field-row">
        <div class="field-group flex-1"><label>延迟(ms)</label><input type="number" class="field-delay" data-id="${op.id}" value="${op.delay}" min="0"></div>
        <div class="field-group flex-2"><label>描述</label><input type="text" class="field-description" data-id="${op.id}" value="${op.description||''}" placeholder="说明"></div>
      </div>`;
    
    return fields;
  }

  addFieldListeners() {
    const map = {
      'field-selector': 'selector', 'field-value': 'value',
      'field-position': 'position', 'field-delay': 'delay',
      'field-description': 'description', 'field-waitSelector': 'waitSelector',
      'field-waitTimeout': 'waitTimeout'
    };

    Object.entries(map).forEach(([cls, prop]) => {
      document.querySelectorAll(`.${cls}`).forEach(input => {
        input.addEventListener('change', (e) => {
          const id = parseInt(e.target.dataset.id);
          let val = e.target.value;
          if (['field-position','field-delay','field-waitTimeout'].includes(cls)) val = parseInt(val)||0;
          this.updateOperation(id, prop, val);
        });
      });
    });

    document.querySelectorAll('.field-behavior').forEach(s => {
      s.addEventListener('change', (e) => this.updateOperation(parseInt(e.target.dataset.id), 'behavior', e.target.value));
    });
    document.querySelectorAll('.field-refreshType').forEach(s => {
      s.addEventListener('change', (e) => { this.updateOperation(parseInt(e.target.dataset.id), 'refreshType', e.target.value); this.renderOperations(); });
    });
  }

  initDragDrop() {
    let dragId = null;
    document.querySelectorAll('.operation-item').forEach(item => {
      item.addEventListener('dragstart', (e) => { dragId = parseInt(e.target.closest('.operation-item').dataset.id); e.target.closest('.operation-item').style.opacity='0.4'; });
      item.addEventListener('dragover', (e) => e.preventDefault());
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = parseInt(e.target.closest('.operation-item').dataset.id);
        if (dragId && dragId !== targetId) {
          const si = this.operations.findIndex(o=>o.id===dragId);
          const ti = this.operations.findIndex(o=>o.id===targetId);
          const [r] = this.operations.splice(si,1);
          this.operations.splice(ti,0,r);
          this.saveOperations();
          this.renderOperations();
        }
      });
      item.addEventListener('dragend', (e) => { e.target.closest('.operation-item').style.opacity='1'; });
    });
  }

  getIcon(type) {
    return { input:'📝', click:'👆', scroll:'↕️', refresh:'🔄' }[type] || '❓';
  }

  showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = `status status-${type}`;
    if (type === 'success' || type === 'info') setTimeout(() => { el.textContent=''; el.className='status'; }, 4000);
  }

  showHelp() {
    alert(`📖 使用帮助\n\n【操作类型】\n📝 输入 - 填写内容\n👆 点击 - 点击元素\n↕️ 滑动 - 滚动页面\n🔄 刷新 - 刷新页面\n\n【选择器】\n#id .class [name="x"]\n\n【重复】\n指定次数/无限循环/条件循环\n\n💡 如遇连接错误，请刷新页面后重试`);
  }
}

let manager;
document.addEventListener('DOMContentLoaded', () => { manager = new OperationManager(); });
