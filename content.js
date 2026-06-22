/**
 * 网页操作执行器 - 内容脚本 v1.4.0
 * 在目标页面中执行实际操作
 * 支持: 输入、点击、滑动、刷新、等待、选择、脚本、提取 及 变量替换、元素拾取
 */

class OperationExecutor {
  constructor() {
    this.shouldStop = false;
    this.repeatConfig = null;
    this.loopIndex = 0;
    this.pickerMode = false;
    this.pickerCallback = null;
    this.initMessageListener();
    this.checkRefreshWait();
  }

  // ==================== 消息监听 ====================

  initMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'executeOperations':
          this.shouldStop = false;
          if (request.repeatInfo && request.repeatInfo.loopIndex) {
            this.loopIndex = request.repeatInfo.loopIndex;
          }
          this.executeOperations(request.operations, request.repeatInfo)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({
              success: false,
              error: error.message,
              shouldStop: this.shouldStop
            }));
          return true;

        case 'stopExecution':
          this.shouldStop = true;
          sendResponse({ success: true });
          return true;

        case 'setRepeatConfig':
          this.repeatConfig = request.config;
          sendResponse({ success: true });
          return true;

        case 'checkCondition':
          const met = this.checkConditionMet(request.conditionType, request.selector);
          sendResponse({ conditionMet: met });
          return true;

        case 'ping':
          sendResponse({ pong: true });
          return true;

        case 'startPicker':
          this.startElementPicker(request.targetField);
          sendResponse({ success: true, message: '拾取模式已启动' });
          return true;

        case 'stopPicker':
          this.stopElementPicker();
          sendResponse({ success: true });
          return true;
      }
    });
  }

  // ==================== 元素拾取器 ====================

  startElementPicker(targetField) {
    this.pickerMode = true;
    this.pickerTargetField = targetField;

    // 创建拾取提示
    this.createPickerOverlay();

    // 添加鼠标事件监听
    document.addEventListener('mouseover', this.handlePickerHover.bind(this), true);
    document.addEventListener('mouseout', this.handlePickerOut.bind(this), true);
    document.addEventListener('click', this.handlePickerClick.bind(this), true);

    console.log('🎯 元素拾取模式已启动');
  }

  stopElementPicker() {
    this.pickerMode = false;
    this.pickerTargetField = null;

    // 移除拾取提示
    this.removePickerOverlay();

    // 移除鼠标事件监听
    document.removeEventListener('mouseover', this.handlePickerHover.bind(this), true);
    document.removeEventListener('mouseout', this.handlePickerOut.bind(this), true);
    document.removeEventListener('click', this.handlePickerClick.bind(this), true);

    console.log('🎯 元素拾取模式已停止');
  }

  createPickerOverlay() {
    // 创建顶部提示条
    const overlay = document.createElement('div');
    overlay.id = '__executor_picker_overlay__';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: linear-gradient(135deg, #FF9800, #F57C00);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    overlay.innerHTML = '🎯 点击页面元素获取选择器 | 按 ESC 取消';
    document.body.appendChild(overlay);

    // 创建高亮框
    const highlight = document.createElement('div');
    highlight.id = '__executor_picker_highlight__';
    highlight.style.cssText = `
      position: fixed;
      border: 2px solid #FF9800;
      background: rgba(255, 152, 0, 0.1);
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(highlight);

    // 监听 ESC 键取消
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.pickerMode) {
        this.stopElementPicker();
        chrome.runtime.sendMessage({ action: 'pickerCancelled' });
      }
    }, true);
  }

  removePickerOverlay() {
    const overlay = document.getElementById('__executor_picker_overlay__');
    const highlight = document.getElementById('__executor_picker_highlight__');
    if (overlay) overlay.remove();
    if (highlight) highlight.remove();
  }

  handlePickerHover(e) {
    if (!this.pickerMode) return;
    e.stopPropagation();

    const element = e.target;
    if (element.id === '__executor_picker_overlay__' || 
        element.id === '__executor_picker_highlight__') return;

    const rect = element.getBoundingClientRect();
    const highlight = document.getElementById('__executor_picker_highlight__');

    if (highlight) {
      highlight.style.display = 'block';
      highlight.style.top = rect.top + 'px';
      highlight.style.left = rect.left + 'px';
      highlight.style.width = rect.width + 'px';
      highlight.style.height = rect.height + 'px';
    }
  }

  handlePickerOut(e) {
    if (!this.pickerMode) return;
    const highlight = document.getElementById('__executor_picker_highlight__');
    if (highlight) highlight.style.display = 'none';
  }

  handlePickerClick(e) {
    if (!this.pickerMode) return;
    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    if (element.id === '__executor_picker_overlay__' || 
        element.id === '__executor_picker_highlight__') return;

    const selector = this.generateSelector(element);
    console.log('✅ 已获取选择器:', selector);

    // 发送选择器到 popup
    chrome.runtime.sendMessage({
      action: 'pickerResult',
      selector: selector,
      elementInfo: {
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        className: element.className || null,
        text: element.textContent?.substring(0, 50) || null
      }
    });

    this.stopElementPicker();
  }

  generateSelector(element) {
    // 优先使用 ID
    if (element.id) {
      return '#' + CSS.escape(element.id);
    }

    // 尝试使用唯一的属性
    const uniqueAttrs = ['name', 'data-id', 'data-name', 'aria-label', 'title', 'placeholder'];
    for (const attr of uniqueAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        const selector = `${element.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // 使用类名组合
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c && !c.includes(':'));
      if (classes.length > 0) {
        // 尝试找到唯一的类名组合
        for (let i = classes.length; i > 0; i--) {
          const classSelector = '.' + classes.slice(0, i).map(c => CSS.escape(c)).join('.');
          const fullSelector = element.tagName.toLowerCase() + classSelector;
          if (document.querySelectorAll(fullSelector).length === 1) {
            return fullSelector;
          }
        }
      }
    }

    // 使用路径选择器
    const path = this.getElementPath(element);
    return path;
  }

  getElementPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // 添加索引
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  // ==================== 操作执行引擎 ====================

  async executeOperations(operations, repeatInfo) {
    if (repeatInfo) {
      const totalStr = repeatInfo.total > 0 ? repeatInfo.total : '∞';
      console.log(`🔄 第 ${repeatInfo.current}/${totalStr} 次执行`);
      if (repeatInfo.loopIndex) {
        this.loopIndex = repeatInfo.loopIndex;
      }
    }

    for (let i = 0; i < operations.length; i++) {
      if (this.shouldStop) {
        throw new Error('用户停止执行');
      }

      const op = operations[i];
      console.log(`📌 [${i + 1}/${operations.length}] ${op.type}: ${op.description || ''}`);

      try {
        await this.executeOperation(op);
        console.log(`✅ 操作 ${i + 1} 完成`);
      } catch (error) {
        console.error(`❌ 操作 ${i + 1} 失败:`, error);
        throw new Error(`步骤 ${i + 1} [${op.description || op.type}] 失败: ${error.message}`);
      }
    }
  }

  async executeOperation(operation) {
    if (operation.delay > 0) {
      await this.sleep(operation.delay);
    }

    if (this.shouldStop) {
      throw new Error('用户停止执行');
    }

    switch (operation.type) {
      case 'input':   await this.executeInput(operation); break;
      case 'click':   await this.executeClick(operation); break;
      case 'scroll':  await this.executeScroll(operation); break;
      case 'refresh': await this.executeRefresh(operation); break;
      case 'wait':    await this.executeWait(operation); break;
      case 'select':  await this.executeSelect(operation); break;
      case 'script':  await this.executeScript(operation); break;
      case 'extract': await this.executeExtract(operation); break;
      default: throw new Error(`未知操作类型: ${operation.type}`);
    }
  }

  // ==================== 变量替换 ====================

  substituteVariables(input) {
    if (input === null || input === undefined) return input;
    if (typeof input !== 'string') return input;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    // {{timestamp}} - 毫秒时间戳
    input = input.replace(/\{\{timestamp\}\}/g, String(Date.now()));

    // {{date}} - YYYY-MM-DD
    input = input.replace(/\{\{date\}\}/g,
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

    // {{datetime}} - YYYY-MM-DD HH:mm:ss
    input = input.replace(/\{\{datetime\}\}/g,
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

    // {{time}} - HH:mm:ss
    input = input.replace(/\{\{time\}\}/g,
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

    // {{random}} - 0~1 随机数
    input = input.replace(/\{\{random\}\}/g, String(Math.random()));

    // {{randomInt:min:max}} - 范围内随机整数
    input = input.replace(/\{\{randomInt:(\d+):(\d+)\}\}/g, (match, min, max) => {
      const lo = parseInt(min);
      const hi = parseInt(max);
      if (isNaN(lo) || isNaN(hi) || lo > hi) return match;
      return String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
    });

    // {{uuid}} - 简易 UUID
    input = input.replace(/\{\{uuid\}\}/g,
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));

    // {{loopIndex}} - 当前循环次数
    input = input.replace(/\{\{loopIndex\}\}/g, String(this.loopIndex || 1));

    // {{loopIndex0}} - 从0开始的循环索引
    input = input.replace(/\{\{loopIndex0\}\}/g, String(Math.max(0, (this.loopIndex || 1) - 1)));

    return input;
  }

  // ==================== 输入操作 ====================

  async executeInput(operation) {
    const element = this.findElement(operation.selector);

    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    element.focus();

    // 对字符串值进行变量替换
    let value = operation.value || '';
    value = this.substituteVariables(value);

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = value;
    } else if (element.isContentEditable) {
      element.textContent = value;
    } else {
      element.value = value;
    }

    this.dispatchInputEvents(element, value);
    this.highlightElement(element, '#2196F3');
  }

  dispatchInputEvents(element, value) {
    ['input', 'change'].forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ==================== 点击操作 ====================

  async executeClick(operation) {
    const element = this.findElement(operation.selector);

    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.dispatchClickEvents(element, centerX, centerY);
    this.highlightElement(element, '#4CAF50');
  }

  dispatchClickEvents(element, clientX, clientY) {
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX, clientY,
      screenX: clientX + window.screenX,
      screenY: clientY + window.screenY,
      detail: 1
    };

    const events = [
      new MouseEvent('mouseover', options),
      new MouseEvent('mousedown', options),
      new MouseEvent('focus', { bubbles: false }),
      new MouseEvent('mouseup', options),
      new MouseEvent('click', options)
    ];

    events.forEach(event => element.dispatchEvent(event));

    if (typeof element.click === 'function') {
      element.click();
    }
  }

  // ==================== 滚动操作 ====================

  async executeScroll(operation) {
    const position = operation.position || 0;
    const behavior = operation.behavior || 'smooth';

    window.scrollTo({
      top: position,
      left: 0,
      behavior: behavior
    });

    await this.sleep(behavior === 'smooth' ? 500 : 100);
  }

  // ==================== 刷新操作 ====================

  async executeRefresh(operation) {
    switch (operation.refreshType) {
      case 'normal':
        window.location.reload();
        break;

      case 'hard':
        window.location.reload(true);
        break;

      case 'waitElement':
        if (operation.waitSelector) {
          sessionStorage.setItem('__executor_wait_config__', JSON.stringify({
            selector: operation.waitSelector,
            timeout: operation.waitTimeout || 5000,
            timestamp: Date.now()
          }));
        }
        window.location.reload();
        break;

      default:
        window.location.reload();
    }
  }

  // ==================== 等待操作 ====================

  async executeWait(operation) {
    const waitType = operation.waitType || 'fixed';

    switch (waitType) {
      case 'fixed': {
        const duration = parseInt(operation.waitDuration) || 1000;
        await this.sleep(duration);
        break;
      }

      case 'element': {
        if (!operation.waitSelector) {
          throw new Error('等待元素操作缺少选择器');
        }
        const selector = this.substituteVariables(operation.waitSelector);
        const timeout = parseInt(operation.waitTimeout) || 10000;
        await this.waitForElement(selector, timeout);
        break;
      }

      case 'elementVisible': {
        if (!operation.waitSelector) {
          throw new Error('等待元素操作缺少选择器');
        }
        const selector = this.substituteVariables(operation.waitSelector);
        const timeout = parseInt(operation.waitTimeout) || 10000;
        await this.waitForElementVisible(selector, timeout);
        break;
      }

      case 'elementDisappear': {
        if (!operation.waitSelector) {
          throw new Error('等待元素消失操作缺少选择器');
        }
        const selector = this.substituteVariables(operation.waitSelector);
        const timeout = parseInt(operation.waitTimeout) || 10000;
        await this.waitForElementDisappear(selector, timeout);
        break;
      }

      default:
        await this.sleep(parseInt(operation.waitDuration) || 1000);
    }
  }

  // ==================== 下拉选择操作 ====================

  async executeSelect(operation) {
    const element = this.findElement(operation.selector);

    if (!element) {
      throw new Error(`未找到下拉元素: ${operation.selector}`);
    }

    if (element.tagName !== 'SELECT') {
      throw new Error(`目标元素不是 <select> 下拉框: ${element.tagName}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    const selectType = operation.selectType || 'value';
    let targetValue = this.substituteVariables(operation.selectValue || '');
    let matched = false;

    switch (selectType) {
      case 'value': {
        for (let i = 0; i < element.options.length; i++) {
          if (element.options[i].value === targetValue) {
            element.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const idx = parseInt(targetValue);
          if (!isNaN(idx) && idx >= 0 && idx < element.options.length) {
            element.selectedIndex = idx;
            matched = true;
          }
        }
        break;
      }

      case 'index': {
        const idx = parseInt(targetValue);
        if (!isNaN(idx) && idx >= 0 && idx < element.options.length) {
          element.selectedIndex = idx;
          matched = true;
        }
        break;
      }

      case 'text': {
        for (let i = 0; i < element.options.length; i++) {
          const txt = element.options[i].textContent.trim();
          if (txt === targetValue || txt.includes(targetValue)) {
            element.selectedIndex = i;
            matched = true;
            break;
          }
        }
        break;
      }
    }

    if (!matched) {
      throw new Error(`在下拉框中未找到匹配项: ${targetValue} (方式: ${selectType})`);
    }

    // 触发 change 事件
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

    this.highlightElement(element, '#FF9800');
  }

  // ==================== 脚本执行操作 ====================

  async executeScript(operation) {
    const scriptCode = operation.scriptCode || '';
    if (!scriptCode.trim()) {
      throw new Error('脚本内容为空');
    }

    // 变量替换
    const processedScript = this.substituteVariables(scriptCode);

    try {
      // 创建执行上下文
      const context = {
        loopIndex: this.loopIndex || 1,
        document: document,
        window: window,
        selector: operation.selector || '',
        findElement: (sel) => this.findElement(sel),
        sleep: (ms) => this.sleep(ms)
      };

      // 使用 Function 构造器执行脚本
      const fn = new Function('context', `
        with(context) {
          ${processedScript}
        }
      `);

      const result = fn(context);

      console.log('✅ 脚本执行完成', result !== undefined ? `结果: ${result}` : '');
      
      // 如果脚本返回值，发送到 popup
      if (result !== undefined && result !== null) {
        chrome.runtime.sendMessage({
          action: 'scriptResult',
          result: String(result),
          operationId: operation.id
        });
      }

    } catch (error) {
      throw new Error(`脚本执行错误: ${error.message}`);
    }
  }

  // ==================== 元素提取操作 ====================

  async executeExtract(operation) {
    const element = this.findElement(operation.selector);

    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    const extractType = operation.extractType || 'text';
    let extractedValue = '';

    switch (extractType) {
      case 'text':
        extractedValue = element.textContent?.trim() || '';
        break;

      case 'innerHtml':
        extractedValue = element.innerHTML || '';
        break;

      case 'outerHtml':
        extractedValue = element.outerHTML || '';
        break;

      case 'value':
        extractedValue = element.value || '';
        break;

      case 'attribute':
        const attrName = operation.extractAttribute || 'class';
        extractedValue = element.getAttribute(attrName) || '';
        break;

      case 'href':
        extractedValue = element.href || element.getAttribute('href') || '';
        break;

      case 'src':
        extractedValue = element.src || element.getAttribute('src') || '';
        break;

      default:
        extractedValue = element.textContent?.trim() || '';
    }

    // 截取前200字符
    const displayValue = extractedValue.substring(0, 200);
    console.log(`✅ 提取成功 (${extractType}): ${displayValue}`);

    // 高亮元素
    this.highlightElement(element, '#9C27B0');

    // 发送提取结果到 popup
    chrome.runtime.sendMessage({
      action: 'extractResult',
      value: extractedValue,
      extractType: extractType,
      selector: operation.selector,
      operationId: operation.id
    });
  }

  // ==================== 辅助等待方法 ====================

  checkRefreshWait() {
    try {
      const configStr = sessionStorage.getItem('__executor_wait_config__');
      if (configStr) {
        const config = JSON.parse(configStr);
        sessionStorage.removeItem('__executor_wait_config__');

        if (Date.now() - config.timestamp < config.timeout + 5000) {
          console.log(`⏳ 等待元素: ${config.selector}`);
          this.waitForElement(config.selector, config.timeout)
            .then(element => {
              console.log('✅ 等待的元素已出现');
              this.highlightElement(element, '#FF9800');
            })
            .catch(error => {
              console.warn('⚠️ 等待元素超时:', error.message);
            });
        }
      }
    } catch (error) {
      // 忽略解析错误
    }
  }

  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.shouldStop) {
          reject(new Error('用户停止执行'));
          return;
        }

        const element = this.findElement(selector);
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素超时 (${timeout}ms): ${selector}`));
          return;
        }

        setTimeout(check, 200);
      };

      check();
    });
  }

  async waitForElementVisible(selector, timeout = 10000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.shouldStop) {
          reject(new Error('用户停止执行'));
          return;
        }

        const element = this.findElement(selector);
        if (element && this.isElementVisible(element)) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素可见超时 (${timeout}ms): ${selector}`));
          return;
        }

        setTimeout(check, 200);
      };

      check();
    });
  }

  async waitForElementDisappear(selector, timeout = 10000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.shouldStop) {
          reject(new Error('用户停止执行'));
          return;
        }

        const element = this.findElement(selector);
        if (!element || !this.isElementVisible(element)) {
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素消失超时 (${timeout}ms): ${selector}`));
          return;
        }

        setTimeout(check, 200);
      };

      check();
    });
  }

  // ==================== 条件检查 ====================

  checkConditionMet(conditionType, selector) {
    if (!selector) return false;

    const element = this.findElement(selector);

    switch (conditionType) {
      case 'elementExists':
        return !!element && this.isElementVisible(element);
      case 'elementDisappears':
        return !element || !this.isElementVisible(element);
      default:
        return false;
    }
  }

  // ==================== 工具方法 ====================

  findElement(selector) {
    if (!selector) return document.body;

    try {
      let element = document.querySelector(selector);
      if (element) return element;

      const xpathResult = document.evaluate(
        selector, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
      );
      element = xpathResult.singleNodeValue;

      return element;
    } catch (error) {
      console.error('选择器错误:', error.message);
      return null;
    }
  }

  isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }

  highlightElement(element, color = '#4CAF50') {
    const origOutline = element.style.outline;
    const origBg = element.style.backgroundColor;
    const origTransition = element.style.transition;

    element.style.outline = `3px solid ${color}`;
    element.style.backgroundColor = `${color}15`;
    element.style.transition = 'all 0.3s ease';

    setTimeout(() => {
      element.style.outline = origOutline;
      element.style.backgroundColor = origBg;
      element.style.transition = origTransition;
    }, 2000);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 初始化
const executor = new OperationExecutor();

// 页面加载后检查
if (document.readyState === 'complete') {
  executor.checkRefreshWait();
} else {
  window.addEventListener('load', () => executor.checkRefreshWait());
}
