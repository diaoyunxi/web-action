/**
 * 网页操作执行器 - 内容脚本 v2.2.0
 * 在目标页面中执行实际操作
 * 支持: 输入、点击、滑动、刷新、等待、选择、脚本、提取、键盘、截屏、剪贴板、
 *       HTTP请求、标签页、通知、Cookie、悬停、双击、右键点击、聚焦、清空、
 *       滚动到元素、拖拽、鼠标滚轮、条件判断、文件上传、变量设置、元素属性、
 *       本地存储、页面导航、媒体控制、打印日志、隐藏元素、JSON提取、
 *       切换iframe、元素计数、文件下载、页面信息、元素样式、触发事件、
 *       正则提取、元素位置、数组操作、滚动到边缘、文本转语音、网络状态
 */

// 用于条件判断操作：抛出该错误将跳过当前循环迭代的剩余操作
class SkipIterationError extends Error {
  constructor(message = '条件不满足，跳过当前迭代') {
    super(message);
    this.name = 'SkipIterationError';
  }
}

class OperationExecutor {
  constructor() {
    this.shouldStop = false;
    this.repeatConfig = null;
    this.loopIndex = 0;
    this.pickerMode = false;
    this.pickerCallback = null;
    this.variables = {}; // 自定义变量存储（由 setVariable 操作维护）
    this.currentDocument = document; // 当前查找元素的文档上下文（由 switchIframe 操作维护）
    this.initMessageListener();
    this.checkRefreshWait();
    this.loadStoredVariables();
  }

  // 加载后台存储的自定义变量
  async loadStoredVariables() {
    try {
      const result = await chrome.storage.local.get(['storedData']);
      if (result.storedData && typeof result.storedData === 'object') {
        this.variables = { ...result.storedData };
      }
    } catch (error) {
      console.warn('加载存储变量失败:', error);
    }
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
        // 条件判断操作抛出跳过信号：结束当前迭代但不算失败
        if (error instanceof SkipIterationError) {
          console.log(`⏭ 跳过当前迭代: ${error.message}`);
          return { skipped: true, reason: error.message };
        }
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
      case 'keyboard': await this.executeKeyboard(operation); break;
      case 'screenshot': await this.executeScreenshot(operation); break;
      case 'clipboard': await this.executeClipboard(operation); break;
      case 'httpRequest': await this.executeHttpRequest(operation); break;
      case 'tab': await this.executeTab(operation); break;
      case 'notification': await this.executeNotification(operation); break;
      case 'cookie': await this.executeCookie(operation); break;
      case 'hover': await this.executeHover(operation); break;
      case 'doubleClick': await this.executeDoubleClick(operation); break;
      case 'if': await this.executeIf(operation); break;
      case 'fileUpload': await this.executeFileUpload(operation); break;
      case 'setVariable': await this.executeSetVariable(operation); break;
      case 'setAttribute': await this.executeSetAttribute(operation); break;
      case 'storage': await this.executeStorage(operation); break;
      case 'navigate': await this.executeNavigate(operation); break;
      case 'mediaControl': await this.executeMediaControl(operation); break;
      case 'rightClick': await this.executeRightClick(operation); break;
      case 'focus': await this.executeFocus(operation); break;
      case 'clear': await this.executeClear(operation); break;
      case 'scrollToElement': await this.executeScrollToElement(operation); break;
      case 'drag': await this.executeDrag(operation); break;
      case 'mouseWheel': await this.executeMouseWheel(operation); break;
      case 'log': await this.executeLog(operation); break;
      case 'hideElement': await this.executeHideElement(operation); break;
      case 'jsonExtract': await this.executeJsonExtract(operation); break;
      case 'switchIframe': await this.executeSwitchIframe(operation); break;
      case 'elementCount': await this.executeElementCount(operation); break;
      case 'fileDownload': await this.executeFileDownload(operation); break;
      case 'pageInfo': await this.executePageInfo(operation); break;
      case 'elementStyle': await this.executeElementStyle(operation); break;
      case 'triggerEvent': await this.executeTriggerEvent(operation); break;
      case 'regexExtract': await this.executeRegexExtract(operation); break;
      case 'elementPosition': await this.executeElementPosition(operation); break;
      case 'arrayOperation': await this.executeArrayOperation(operation); break;
      case 'scrollToEdge': await this.executeScrollToEdge(operation); break;
      case 'textToSpeech': await this.executeTextToSpeech(operation); break;
      case 'networkStatus': await this.executeNetworkStatus(operation); break;
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

    // {{var:name}} - 自定义变量 (由 setVariable 操作设置)
    input = input.replace(/\{\{var:([a-zA-Z_][\w]*)\}\}/g, (match, name) => {
      const val = this.variables ? this.variables[name] : undefined;
      return val === undefined || val === null ? match : String(val);
    });

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

      case 'scheduledTime': {
        // 等待到指定时刻（HH:MM:SS），如已过则等待到次日同时刻
        const rawTime = this.substituteVariables(operation.waitScheduledTime || '').trim();
        if (!rawTime) {
          throw new Error('定时等待缺少目标时间（格式 HH:MM:SS 或 HH:MM:SS.mmm）');
        }
        const targetMs = this.parseScheduledTimeToDelay(rawTime);
        if (targetMs <= 0) {
          // 已过该时刻，按规则等待到明天同时刻
          console.warn(`⏳ 当前已过 ${rawTime}，将等待到次日同时刻`);
        }
        console.log(`⏳ 定时等待 ${rawTime}，将等待 ${Math.max(0, targetMs)} ms`);
        await this.sleepWithStopCheck(targetMs);
        break;
      }

      case 'randomDelay': {
        const minMs = parseInt(operation.waitMinDelay) || 0;
        const maxMs = parseInt(operation.waitMaxDelay) || 0;
        if (maxMs < minMs) {
          throw new Error(`随机等待范围无效: min(${minMs}) > max(${maxMs})`);
        }
        const delta = maxMs - minMs;
        const duration = delta > 0 ? minMs + Math.floor(Math.random() * (delta + 1)) : minMs;
        console.log(`⏳ 随机等待 ${duration} ms (范围 ${minMs}-${maxMs})`);
        await this.sleepWithStopCheck(duration);
        break;
      }

      case 'elementText': {
        if (!operation.waitSelector) {
          throw new Error('等待元素文本操作缺少选择器');
        }
        const selector = this.substituteVariables(operation.waitSelector);
        const expectedText = this.substituteVariables(operation.waitExpectedText || '');
        const matchMode = operation.waitTextMatchMode || 'contains';
        const timeout = parseInt(operation.waitTimeout) || 10000;
        await this.waitForElementText(selector, expectedText, matchMode, timeout);
        break;
      }

      default:
        await this.sleep(parseInt(operation.waitDuration) || 1000);
    }
  }

  // 将 HH:MM:SS[.mmm] 格式的时刻转换为距离当前时刻的毫秒数
  // 若该时刻今天已过，则计算到明天同时刻的毫秒数
  parseScheduledTimeToDelay(timeStr) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    if (!match) {
      throw new Error(`定时时间格式无效: ${timeStr}，正确格式为 HH:MM:SS 或 HH:MM:SS.mmm`);
    }
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const ms = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;

    if (hours > 23 || minutes > 59 || seconds > 59) {
      throw new Error(`定时时间数值越界: ${timeStr}`);
    }

    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, seconds, ms);

    let diff = target.getTime() - now.getTime();
    if (diff < 0) {
      // 已过该时刻，目标改为明天同时刻
      target.setDate(target.getDate() + 1);
      diff = target.getTime() - now.getTime();
    }
    return diff;
  }

  // 支持停止检查的长时间 sleep
  async sleepWithStopCheck(ms) {
    if (ms <= 0) return;
    const step = 200;
    let remaining = ms;
    while (remaining > 0) {
      if (this.shouldStop) {
        throw new Error('用户停止执行');
      }
      const wait = Math.min(step, remaining);
      await this.sleep(wait);
      remaining -= wait;
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

  // ==================== 键盘操作 ====================

  async executeKeyboard(operation) {
    const keyType = operation.keyType || 'key';
    const keyValue = this.substituteVariables(operation.keyValue || 'Enter');
    const modifierKeys = operation.modifierKeys || [];

    if (keyType === 'sequence') {
      const keys = keyValue.split(/\s+/).filter(k => k);
      for (const key of keys) {
        if (this.shouldStop) throw new Error('用户停止执行');
        await this.pressKey(key, modifierKeys);
        await this.sleep(50);
      }
    } else {
      await this.pressKey(keyValue, modifierKeys);
    }
  }

  async pressKey(keyValue, modifierKeys = []) {
    const key = this.normalizeKey(keyValue);
    const modifiers = [];
    if (modifierKeys.includes('ctrl')) modifiers.push('ctrlKey');
    if (modifierKeys.includes('shift')) modifiers.push('shiftKey');
    if (modifierKeys.includes('alt')) modifiers.push('altKey');

    const options = { key, code: this.getEventCode(key), bubbles: true, cancelable: true };
    if (modifiers.length > 0) options.modifiers = modifiers;

    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', options));
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { ...options }));
    console.log(`⌨️ 按键: ${key}`);
  }

  normalizeKey(key) {
    const map = { 'enter':'Enter','tab':'Tab','escape':'Escape','esc':'Escape','backspace':'Backspace','delete':'Delete','arrowup':'ArrowUp','arrowdown':'ArrowDown','arrowleft':'ArrowLeft','arrowright':'ArrowRight','home':'Home','end':'End','pageup':'PageUp','pagedown':'PageDown',' ':'Space' };
    return map[key.toLowerCase()] || key;
  }

  getEventCode(key) {
    const map = { 'Enter':'Enter','Tab':'Tab','Escape':'Escape','Backspace':'Backspace','Delete':'Delete','ArrowUp':'ArrowUp','ArrowDown':'ArrowDown','ArrowLeft':'ArrowLeft','ArrowRight':'ArrowRight','Home':'Home','End':'End','PageUp':'PageUp','PageDown':'PageDown',' ':'Space' };
    if (map[key]) return map[key];
    if (key.length === 1) return `Key${key.toUpperCase()}`;
    return key;
  }

  // ==================== 截屏操作 ====================

  async executeScreenshot(operation) {
    const screenshotType = operation.screenshotType || 'page';

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
        if (response && response.success) {
          chrome.runtime.sendMessage({ action: 'screenshotResult', dataUrl: response.dataUrl, type: screenshotType });
          console.log(`📷 截屏完成 (${screenshotType})`);
          resolve();
        } else {
          reject(new Error(response?.error || '截屏失败'));
        }
      });
    });
  }

  // ==================== 剪贴板操作 ====================

  async executeClipboard(operation) {
    const action = operation.clipboardAction || 'write';

    if (action === 'write') {
      const value = this.substituteVariables(operation.clipboardValue || '');
      await navigator.clipboard.writeText(value);
      if (operation.clipboardVariable) {
        chrome.runtime.sendMessage({ action: 'storeData', key: operation.clipboardVariable, value });
      }
      console.log(`📋 已写入剪贴板: ${value.substring(0, 30)}...`);
    } else {
      const text = await navigator.clipboard.readText();
      const varName = operation.clipboardVariable || 'clipboardContent';
      chrome.runtime.sendMessage({ action: 'storeData', key: varName, value: text });
      console.log(`📋 已读取剪贴板: ${text.substring(0, 30)}...`);
    }
  }

  // ==================== HTTP请求操作 ====================

  async executeHttpRequest(operation) {
    const method = (operation.httpMethod || 'GET').toUpperCase();
    const url = this.substituteVariables(operation.httpUrl || '');
    if (!url) throw new Error('HTTP请求URL为空');

    const headers = {};
    if (operation.httpHeaders) {
      try {
        const lines = operation.httpHeaders.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const idx = line.indexOf(':');
          if (idx > 0) {
            headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
          }
        }
      } catch (e) { /* ignore */ }
    }

    const fetchOptions = { method, headers };
    if (operation.httpBody && method !== 'GET') {
      fetchOptions.body = this.substituteVariables(operation.httpBody);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();
      const preview = text.substring(0, 200);
      console.log(`🌐 HTTP ${method} ${url} -> ${response.status} (${preview}...)`);

      chrome.runtime.sendMessage({
        action: 'httpRequestResult',
        url,
        status: response.status,
        preview
      });

      if (operation.httpSaveVariable) {
        chrome.runtime.sendMessage({
          action: 'storeData',
          key: operation.httpSaveVariable,
          value: text
        });
      }

      this.highlightElement(document.body, '#00BCD4');
    } catch (error) {
      throw new Error(`HTTP请求失败: ${error.message}`);
    }
  }

  // ==================== 标签页操作 ====================

  async executeTab(operation) {
    const tabAction = operation.tabAction || 'open';

    switch (tabAction) {
      case 'open': {
        const url = this.substituteVariables(operation.tabUrl || '');
        if (!url) throw new Error('标签页URL为空');
        chrome.runtime.sendMessage({ action: 'openTab', url });
        console.log(`🗂 打开新标签页: ${url}`);
        break;
      }
      case 'close':
        chrome.runtime.sendMessage({ action: 'closeCurrentTab' });
        console.log('🗂 关闭当前标签页');
        break;
      case 'reload':
        window.location.reload();
        console.log('🗂 重载标签页');
        break;
      case 'focus':
        window.focus();
        console.log('🗂 聚焦标签页');
        break;
      default:
        throw new Error(`未知标签页操作: ${tabAction}`);
    }
  }

  // ==================== 通知操作 ====================

  async executeNotification(operation) {
    const title = this.substituteVariables(operation.notifTitle || '网页操作执行器');
    const body = this.substituteVariables(operation.notifBody || '');
    const duration = parseInt(operation.notifDuration) || 3000;

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const notif = new Notification(title, { body, icon: chrome.runtime.getURL('icons/icon128.png') });
        setTimeout(() => notif.close(), duration);
        console.log(`🔔 通知: ${title} - ${body}`);
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const notif = new Notification(title, { body });
          setTimeout(() => notif.close(), duration);
          console.log(`🔔 通知: ${title} - ${body}`);
        } else {
          throw new Error('通知权限被拒绝');
        }
      } else {
        // 降级为页面内提示
        this.showInPageNotification(title, body, duration);
      }
    } else {
      this.showInPageNotification(title, body, duration);
    }
  }

  showInPageNotification(title, body, duration) {
    const notif = document.createElement('div');
    notif.className = '__executor_notif__';
    notif.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background: #333; color: white; padding: 12px 20px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: -apple-system, sans-serif;
      max-width: 300px; animation: __executor_slide_in__ 0.3s ease;
    `;
    notif.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${title}</div><div style="font-size:13px;opacity:0.9">${body}</div>`;
    document.body.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transition = 'opacity 0.3s';
      setTimeout(() => notif.remove(), 300);
    }, duration);
  }

  // ==================== Cookie操作 ====================

  async executeCookie(operation) {
    const cookieAction = operation.cookieAction || 'get';

    switch (cookieAction) {
      case 'set': {
        const name = this.substituteVariables(operation.cookieName || '');
        const value = this.substituteVariables(operation.cookieValue || '');
        if (!name) throw new Error('Cookie名称为空');
        let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        if (operation.cookieDomain) cookieStr += `; domain=${operation.cookieDomain}`;
        if (operation.cookiePath) cookieStr += `; path=${operation.cookiePath}`;
        if (operation.cookieMaxAge) cookieStr += `; max-age=${operation.cookieMaxAge}`;
        document.cookie = cookieStr;
        console.log(`🍪 设置Cookie: ${name}=${value}`);
        break;
      }
      case 'get': {
        const name = this.substituteVariables(operation.cookieName || '');
        if (!name) throw new Error('Cookie名称为空');
        const cookies = document.cookie.split(';').reduce((acc, c) => {
          const [k, v] = c.trim().split('=');
          acc[decodeURIComponent(k)] = decodeURIComponent(v || '');
          return acc;
        }, {});
        const value = cookies[name] || '';
        console.log(`🍪 获取Cookie: ${name}=${value}`);
        if (operation.cookieVariable) {
          chrome.runtime.sendMessage({ action: 'storeData', key: operation.cookieVariable, value });
        }
        break;
      }
      case 'delete': {
        const name = this.substituteVariables(operation.cookieName || '');
        if (!name) throw new Error('Cookie名称为空');
        document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        console.log(`🍪 删除Cookie: ${name}`);
        break;
      }
    }
  }

  // ==================== 悬停操作 ====================

  async executeHover(operation) {
    const element = this.findElement(operation.selector);
    if (!element) throw new Error(`未找到元素: ${operation.selector}`);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    element.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY
    }));
    element.dispatchEvent(new MouseEvent('mouseenter', {
      bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY
    }));

    const hoverDuration = parseInt(operation.hoverDuration) || 1000;
    await this.sleep(hoverDuration);

    element.dispatchEvent(new MouseEvent('mouseout', {
      bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY
    }));
    element.dispatchEvent(new MouseEvent('mouseleave', {
      bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY
    }));

    this.highlightElement(element, '#FF5722');
    console.log(`🖱 悬停: ${operation.selector} (${hoverDuration}ms)`);
  }

  // ==================== 双击操作 ====================

  async executeDoubleClick(operation) {
    const element = this.findElement(operation.selector);
    if (!element) throw new Error(`未找到元素: ${operation.selector}`);

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: centerX, clientY: centerY, detail: 2
    };

    element.dispatchEvent(new MouseEvent('mouseover', { ...opts, detail: 1 }));
    element.dispatchEvent(new MouseEvent('mousedown', { ...opts, detail: 1 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...opts, detail: 1 }));
    element.dispatchEvent(new MouseEvent('click', { ...opts, detail: 1 }));
    element.dispatchEvent(new MouseEvent('mousedown', { ...opts, detail: 2 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...opts, detail: 2 }));
    element.dispatchEvent(new MouseEvent('click', { ...opts, detail: 2 }));
    element.dispatchEvent(new MouseEvent('dblclick', opts));

    this.highlightElement(element, '#E91E63');
    console.log(`🖱 双击: ${operation.selector}`);
  }

  // ==================== 条件判断操作 ====================

  async executeIf(operation) {
    const conditionType = operation.ifConditionType || 'elementExists';
    const selector = this.substituteVariables(operation.ifSelector || '');
    const ifMode = operation.ifMode || 'skip';

    let conditionMet = false;

    switch (conditionType) {
      case 'elementExists': {
        conditionMet = !!this.findElement(selector);
        break;
      }
      case 'elementNotExists': {
        conditionMet = !this.findElement(selector);
        break;
      }
      case 'elementVisible': {
        const el = this.findElement(selector);
        conditionMet = !!el && this.isElementVisible(el);
        break;
      }
      case 'elementNotVisible': {
        const el = this.findElement(selector);
        conditionMet = !el || !this.isElementVisible(el);
        break;
      }
      case 'variableEquals': {
        const varName = operation.ifVariableName || '';
        const expected = this.substituteVariables(operation.ifVariableValue || '');
        const actual = this.variables ? String(this.variables[varName] ?? '') : '';
        conditionMet = actual === expected;
        break;
      }
      case 'variableNotEmpty': {
        const varName = operation.ifVariableName || '';
        const val = this.variables ? this.variables[varName] : undefined;
        conditionMet = val !== undefined && val !== null && String(val).trim() !== '';
        break;
      }
      default:
        throw new Error(`未知条件类型: ${conditionType}`);
    }

    console.log(`🔀 条件判断 [${conditionType}]: ${conditionMet ? '满足' : '不满足'}`);

    // skip 模式: 条件不满足时跳过当前迭代剩余操作
    // pass 模式: 条件满足时跳过当前迭代剩余操作 (反向)
    if (ifMode === 'skip' && !conditionMet) {
      throw new SkipIterationError(`条件 [${conditionType}] 不满足，跳过当前迭代`);
    }
    if (ifMode === 'pass' && conditionMet) {
      throw new SkipIterationError(`条件 [${conditionType}] 已满足，跳过当前迭代`);
    }
  }

  // ==================== 文件上传操作 ====================

  async executeFileUpload(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到文件输入元素: ${operation.selector}`);
    }

    if (element.tagName !== 'INPUT' || element.type !== 'file') {
      throw new Error(`目标元素不是文件输入框: <${element.tagName.toLowerCase()} type="${element.type || ''}">`);
    }

    const fileUrl = this.substituteVariables(operation.fileUrl || '');
    const fileName = this.substituteVariables(operation.fileName || 'uploaded-file');

    if (!fileUrl) {
      throw new Error('文件URL为空');
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`获取文件失败 HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      element.files = dataTransfer.files;

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      this.highlightElement(element, '#00ACC1');
      console.log(`📁 文件上传完成: ${fileName} (${blob.size} bytes)`);
    } catch (error) {
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  // ==================== 变量设置操作 ====================

  async executeSetVariable(operation) {
    const varName = operation.varName || '';
    if (!varName) {
      throw new Error('变量名为空');
    }

    const action = operation.varAction || 'set';
    const rawValue = operation.varValue || '';

    switch (action) {
      case 'set': {
        const value = this.substituteVariables(rawValue);
        this.variables[varName] = value;
        console.log(`📦 设置变量: ${varName} = ${String(value).substring(0, 50)}`);
        break;
      }
      case 'clear': {
        delete this.variables[varName];
        console.log(`📦 清除变量: ${varName}`);
        break;
      }
      case 'increment': {
        const current = parseFloat(this.variables[varName]) || 0;
        const step = parseFloat(this.substituteVariables(rawValue || '1')) || 1;
        this.variables[varName] = String(current + step);
        console.log(`📦 自增变量: ${varName} = ${this.variables[varName]}`);
        break;
      }
      case 'append': {
        const current = this.variables[varName] !== undefined ? String(this.variables[varName]) : '';
        const value = this.substituteVariables(rawValue);
        this.variables[varName] = current + value;
        console.log(`📦 追加变量: ${varName} = ${String(this.variables[varName]).substring(0, 50)}`);
        break;
      }
      default:
        throw new Error(`未知变量操作: ${action}`);
    }

    // 持久化到 chrome.storage，供 popup 或下次执行使用
    chrome.runtime.sendMessage({
      action: 'storeData',
      key: varName,
      value: this.variables[varName]
    });
  }

  // ==================== 元素属性操作 ====================

  async executeSetAttribute(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    const attrAction = operation.attrAction || 'set';
    const attrName = this.substituteVariables(operation.attrName || '');
    if (!attrName) {
      throw new Error('属性名为空');
    }

    switch (attrAction) {
      case 'set': {
        const attrValue = this.substituteVariables(operation.attrValue || '');
        element.setAttribute(attrName, attrValue);
        console.log(`🏷 设置属性: ${attrName}="${attrValue}"`);
        break;
      }
      case 'remove': {
        element.removeAttribute(attrName);
        console.log(`🏷 移除属性: ${attrName}`);
        break;
      }
      case 'toggle': {
        if (element.hasAttribute(attrName)) {
          element.removeAttribute(attrName);
          console.log(`🏷 切换属性(移除): ${attrName}`);
        } else {
          const attrValue = this.substituteVariables(operation.attrValue || '');
          element.setAttribute(attrName, attrValue);
          console.log(`🏷 切换属性(设置): ${attrName}="${attrValue}"`);
        }
        break;
      }
      default:
        throw new Error(`未知属性操作: ${attrAction}`);
    }

    // 触发 change 事件以通知框架
    element.dispatchEvent(new Event('change', { bubbles: true }));
    this.highlightElement(element, '#5C6BC0');
  }

  // ==================== 本地存储操作 ====================

  async executeStorage(operation) {
    const storageType = operation.storageType || 'localStorage';
    const storageAction = operation.storageAction || 'get';
    const key = this.substituteVariables(operation.storageKey || '');

    let storageObj;
    try {
      if (storageType === 'localStorage') {
        storageObj = window.localStorage;
      } else if (storageType === 'sessionStorage') {
        storageObj = window.sessionStorage;
      } else {
        throw new Error(`未知存储类型: ${storageType}`);
      }
    } catch (error) {
      throw new Error(`无法访问 ${storageType}: ${error.message}`);
    }

    switch (storageAction) {
      case 'get': {
        if (!key) throw new Error('存储键名为空');
        const value = storageObj.getItem(key) || '';
        console.log(`🗄 读取 ${storageType}[${key}]: ${value.substring(0, 50)}`);
        if (operation.storageVariable) {
          this.variables[operation.storageVariable] = value;
          chrome.runtime.sendMessage({
            action: 'storeData',
            key: operation.storageVariable,
            value
          });
        }
        break;
      }
      case 'set': {
        if (!key) throw new Error('存储键名为空');
        const value = this.substituteVariables(operation.storageValue || '');
        storageObj.setItem(key, value);
        console.log(`🗄 写入 ${storageType}[${key}]: ${value.substring(0, 50)}`);
        break;
      }
      case 'remove': {
        if (!key) throw new Error('存储键名为空');
        storageObj.removeItem(key);
        console.log(`🗄 删除 ${storageType}[${key}]`);
        break;
      }
      case 'clear': {
        storageObj.clear();
        console.log(`🗄 清空 ${storageType}`);
        break;
      }
      default:
        throw new Error(`未知存储操作: ${storageAction}`);
    }
  }

  // ==================== 页面导航操作 ====================

  async executeNavigate(operation) {
    const navigateAction = operation.navigateAction || 'url';
    const url = this.substituteVariables(operation.navigateUrl || '');
    const waitLoad = operation.navigateWaitLoad !== false;

    switch (navigateAction) {
      case 'url': {
        if (!url) throw new Error('导航URL为空');
        // 相对路径处理
        let target = url;
        if (!/^https?:\/\//i.test(target) && !target.startsWith('//')) {
          target = new URL(target, window.location.href).href;
        }
        console.log(`🧭 导航到: ${target}`);
        if (waitLoad) {
          window.location.href = target;
        } else {
          window.location.replace(target);
        }
        break;
      }
      case 'back': {
        history.back();
        console.log('🧭 后退');
        break;
      }
      case 'forward': {
        history.forward();
        console.log('🧭 前进');
        break;
      }
      case 'reload': {
        window.location.reload();
        console.log('🧭 重新加载');
        break;
      }
      default:
        throw new Error(`未知导航操作: ${navigateAction}`);
    }
  }

  // ==================== 媒体控制操作 ====================

  async executeMediaControl(operation) {
    const mediaAction = operation.mediaAction || 'play';

    // 查找目标媒体元素
    let mediaElement = null;
    if (operation.selector) {
      const el = this.findElement(operation.selector);
      if (!el) {
        throw new Error(`未找到媒体元素: ${operation.selector}`);
      }
      mediaElement = el;
    } else {
      // 未指定选择器时，自动取页面中第一个 audio/video 元素
      mediaElement = document.querySelector('video, audio');
      if (!mediaElement) {
        throw new Error('未指定选择器且页面中未找到 <video>/<audio> 元素');
      }
    }

    if (!mediaElement || typeof mediaElement.play !== 'function') {
      throw new Error(`目标元素不是媒体元素: <${mediaElement?.tagName?.toLowerCase() || 'unknown'}>`);
    }

    mediaElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(150);

    switch (mediaAction) {
      case 'play':
        try {
          await mediaElement.play();
          console.log('🎬 播放媒体');
        } catch (e) {
          throw new Error(`播放失败: ${e.message}`);
        }
        break;
      case 'pause':
        mediaElement.pause();
        console.log('⏸ 暂停媒体');
        break;
      case 'toggle':
        if (mediaElement.paused) {
          try {
            await mediaElement.play();
            console.log('🎬 切换为播放');
          } catch (e) {
            throw new Error(`播放失败: ${e.message}`);
          }
        } else {
          mediaElement.pause();
          console.log('⏸ 切换为暂停');
        }
        break;
      case 'mute':
        mediaElement.muted = true;
        console.log('🔇 静音');
        break;
      case 'unmute':
        mediaElement.muted = false;
        console.log('🔊 取消静音');
        break;
      case 'setVolume': {
        const volume = parseFloat(operation.mediaVolume);
        if (isNaN(volume) || volume < 0 || volume > 1) {
          throw new Error(`音量值无效 (0-1): ${operation.mediaVolume}`);
        }
        mediaElement.volume = volume;
        console.log(`🔊 设置音量: ${volume}`);
        break;
      }
      case 'seek': {
        const seekTime = parseFloat(operation.mediaSeekTime);
        if (isNaN(seekTime) || seekTime < 0) {
          throw new Error(`跳转时间无效: ${operation.mediaSeekTime}`);
        }
        try {
          mediaElement.currentTime = seekTime;
          console.log(`⏩ 跳转到 ${seekTime} 秒`);
        } catch (e) {
          throw new Error(`跳转失败: ${e.message}`);
        }
        break;
      }
      case 'playbackRate': {
        const rate = parseFloat(operation.mediaPlaybackRate);
        if (isNaN(rate) || rate <= 0) {
          throw new Error(`播放速率无效 (>0): ${operation.mediaPlaybackRate}`);
        }
        mediaElement.playbackRate = rate;
        console.log(`⏩ 设置播放速率: ${rate}x`);
        break;
      }
      case 'fullscreen':
        if (mediaElement.requestFullscreen) {
          try {
            await mediaElement.requestFullscreen();
            console.log('🖥 进入全屏');
          } catch (e) {
            throw new Error(`进入全屏失败: ${e.message}`);
          }
        } else {
          throw new Error('当前浏览器不支持全屏 API');
        }
        break;
      default:
        throw new Error(`未知媒体操作: ${mediaAction}`);
    }

    // 触发 input 事件以便框架感知
    mediaElement.dispatchEvent(new Event('input', { bubbles: true }));
    mediaElement.dispatchEvent(new Event('change', { bubbles: true }));
    this.highlightElement(mediaElement, '#7C4DFF');
  }

  // ==================== 右键点击操作 ====================

  async executeRightClick(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
      screenX: centerX + window.screenX,
      screenY: centerY + window.screenY,
      button: 2
    };

    element.dispatchEvent(new MouseEvent('mouseover', { ...opts, button: 0 }));
    element.dispatchEvent(new MouseEvent('mousedown', opts));
    element.dispatchEvent(new MouseEvent('mouseup', opts));
    element.dispatchEvent(new MouseEvent('contextmenu', opts));

    // 尝试触发元素的 oncontextmenu 处理器
    if (typeof element.oncontextmenu === 'function') {
      try { element.oncontextmenu(new MouseEvent('contextmenu', opts)); } catch (e) { /* ignore */ }
    }

    this.highlightElement(element, '#D32F2F');
    console.log(`🖱 右键点击: ${operation.selector}`);
  }

  // ==================== 元素聚焦操作 ====================

  async executeFocus(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    try {
      element.focus({ preventScroll: true });
    } catch (e) {
      element.focus();
    }

    element.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('focusin', { bubbles: true, cancelable: true }));

    this.highlightElement(element, '#1976D2');
    console.log(`🎯 元素聚焦: ${operation.selector}`);
  }

  // ==================== 清空输入操作 ====================

  async executeClear(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    element.focus();

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(element, '');
      } else {
        element.value = '';
      }
    } else if (element.isContentEditable) {
      element.textContent = '';
    } else {
      element.value = '';
    }

    ['input', 'change'].forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });

    this.highlightElement(element, '#00BCD4');
    console.log(`🧹 清空输入: ${operation.selector}`);
  }

  // ==================== 滚动到元素操作 ====================

  async executeScrollToElement(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    const block = operation.scrollBlock || 'center';
    const behavior = operation.scrollBehavior || 'smooth';

    try {
      element.scrollIntoView({ behavior, block });
    } catch (e) {
      element.scrollIntoView();
    }

    await this.sleep(behavior === 'smooth' ? 500 : 150);
    this.highlightElement(element, '#00ACC1');
    console.log(`📍 滚动到元素: ${operation.selector} (block=${block})`);
  }

  // ==================== 拖拽操作 ====================

  async executeDrag(operation) {
    const sourceSelector = this.substituteVariables(operation.dragSourceSelector || '');
    const targetSelector = this.substituteVariables(operation.dragTargetSelector || '');
    if (!sourceSelector) throw new Error('拖拽源元素选择器为空');
    if (!targetSelector) throw new Error('拖拽目标元素选择器为空');

    const sourceEl = this.findElement(sourceSelector);
    if (!sourceEl) throw new Error(`未找到源元素: ${sourceSelector}`);

    const targetEl = this.findElement(targetSelector);
    if (!targetEl) throw new Error(`未找到目标元素: ${targetSelector}`);

    sourceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    const mkOpts = (x, y, btn = 0) => ({
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
      button: btn,
      buttons: btn === 0 ? 0 : 1
    });

    // 1. 在源元素上按下鼠标
    sourceEl.dispatchEvent(new MouseEvent('mouseover', mkOpts(sourceX, sourceY)));
    sourceEl.dispatchEvent(new MouseEvent('mousedown', mkOpts(sourceX, sourceY, 0)));
    sourceEl.dispatchEvent(new MouseEvent('mousedown', mkOpts(sourceX, sourceY, 1)));

    // 2. 移动到目标元素（drag 事件）
    const dragInit = new DragEvent('dragstart', {
      bubbles: true, cancelable: true, view: window,
      clientX: sourceX, clientY: sourceY, button: 0
    });
    try { sourceEl.dispatchEvent(dragInit); } catch (e) { /* ignore */ }

    // 模拟拖动过程中的几次 mousemove
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = sourceX + (targetX - sourceX) * (i / steps);
      const y = sourceY + (targetY - sourceY) * (i / steps);
      document.dispatchEvent(new MouseEvent('mousemove', mkOpts(x, y, 1)));
      try {
        const dragEv = new DragEvent('drag', {
          bubbles: true, cancelable: true, view: window,
          clientX: x, clientY: y
        });
        sourceEl.dispatchEvent(dragEv);
      } catch (e) { /* ignore */ }
      await this.sleep(40);
    }

    // 3. 在目标元素上释放鼠标
    targetEl.dispatchEvent(new MouseEvent('mousemove', mkOpts(targetX, targetY, 1)));
    try {
      const dragEnter = new DragEvent('dragenter', {
        bubbles: true, cancelable: true, view: window,
        clientX: targetX, clientY: targetY
      });
      targetEl.dispatchEvent(dragEnter);
      const dragOver = new DragEvent('dragover', {
        bubbles: true, cancelable: true, view: window,
        clientX: targetX, clientY: targetY
      });
      targetEl.dispatchEvent(dragOver);
      const drop = new DragEvent('drop', {
        bubbles: true, cancelable: true, view: window,
        clientX: targetX, clientY: targetY
      });
      targetEl.dispatchEvent(drop);
    } catch (e) { /* ignore */ }

    targetEl.dispatchEvent(new MouseEvent('mouseup', mkOpts(targetX, targetY, 1)));
    targetEl.dispatchEvent(new MouseEvent('click', mkOpts(targetX, targetY, 0)));

    try {
      const dragEnd = new DragEvent('dragend', {
        bubbles: true, cancelable: true, view: window,
        clientX: targetX, clientY: targetY
      });
      sourceEl.dispatchEvent(dragEnd);
    } catch (e) { /* ignore */ }

    this.highlightElement(sourceEl, '#7B1FA2');
    this.highlightElement(targetEl, '#388E3C');
    console.log(`🤚 拖拽: ${sourceSelector} → ${targetSelector}`);
  }

  // ==================== 鼠标滚轮操作 ====================

  async executeMouseWheel(operation) {
    let element = null;
    if (operation.selector) {
      element = this.findElement(operation.selector);
      if (!element) {
        throw new Error(`未找到元素: ${operation.selector}`);
      }
    } else {
      element = document.scrollingElement || document.documentElement;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    const deltaX = parseInt(operation.wheelDeltaX) || 0;
    const deltaY = parseInt(operation.wheelDeltaY) || 0;
    if (deltaX === 0 && deltaY === 0) {
      throw new Error('滚轮增量不能同时为 0');
    }

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
      deltaX,
      deltaY,
      deltaMode: 0 // WheelEvent.DOM_DELTA_PIXEL
    });

    element.dispatchEvent(wheelEvent);

    // 给浏览器一点时间处理滚动
    await this.sleep(300);
    this.highlightElement(element, '#F57C00');
    console.log(`🎰 鼠标滚轮: deltaX=${deltaX}, deltaY=${deltaY} on ${operation.selector || 'window'}`);
  }

  // ==================== 打印日志操作 ====================

  async executeLog(operation) {
    const level = operation.logLevel || 'info';
    const message = this.substituteVariables(operation.logMessage || '');

    switch (level) {
      case 'info':
        console.log(`📜 [用户日志] ${message}`);
        break;
      case 'warn':
        console.warn(`📜 [用户日志] ${message}`);
        break;
      case 'error':
        console.error(`📜 [用户日志] ${message}`);
        break;
      case 'debug':
        console.debug(`📜 [用户日志] ${message}`);
        break;
      default:
        console.log(`📜 [用户日志] ${message}`);
    }

    // 同时发送到 popup 显示
    chrome.runtime.sendMessage({
      action: 'logMessage',
      level,
      message
    });
  }

  // ==================== 隐藏/显示元素操作 ====================

  async executeHideElement(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    const hideAction = operation.hideAction || 'hide';

    // 记录原始样式以便恢复
    if (!element.__executorOriginalStyle__) {
      element.__executorOriginalStyle__ = {
        display: element.style.display,
        visibility: element.style.visibility,
        opacity: element.style.opacity
      };
    }

    switch (hideAction) {
      case 'hide':
        element.style.setProperty('display', 'none', 'important');
        console.log(`🙈 隐藏元素: ${operation.selector}`);
        break;
      case 'show':
        // 恢复原始样式
        const orig = element.__executorOriginalStyle__;
        if (orig) {
          element.style.display = orig.display;
          element.style.visibility = orig.visibility;
          element.style.opacity = orig.opacity;
        } else {
          element.style.removeProperty('display');
        }
        console.log(`👀 显示元素: ${operation.selector}`);
        break;
      case 'toggle':
        if (element.style.display === 'none') {
          const orig = element.__executorOriginalStyle__;
          if (orig) {
            element.style.display = orig.display;
          } else {
            element.style.removeProperty('display');
          }
          console.log(`👀 切换显示元素: ${operation.selector}`);
        } else {
          element.style.setProperty('display', 'none', 'important');
          console.log(`🙈 切换隐藏元素: ${operation.selector}`);
        }
        break;
      default:
        throw new Error(`未知隐藏操作: ${hideAction}`);
    }

    this.highlightElement(element, '#5C6BC0');
  }

  // ==================== JSON 提取操作 ====================

  async executeJsonExtract(operation) {
    const jsonSource = operation.jsonSource || 'variable';
    const jsonPath = this.substituteVariables(operation.jsonPath || '');
    const saveVariable = operation.jsonSaveVariable || '';

    if (!jsonPath) {
      throw new Error('JSON 路径为空');
    }

    let jsonStr = '';
    switch (jsonSource) {
      case 'variable': {
        const varName = operation.jsonVariableName || '';
        if (!varName) throw new Error('变量名为空');
        jsonStr = this.variables ? String(this.variables[varName] ?? '') : '';
        if (!jsonStr) throw new Error(`变量 ${varName} 不存在或为空`);
        break;
      }
      case 'text': {
        jsonStr = this.substituteVariables(operation.jsonText || '');
        if (!jsonStr) throw new Error('JSON 文本为空');
        break;
      }
      default:
        throw new Error(`未知 JSON 来源: ${jsonSource}`);
    }

    let jsonObj;
    try {
      jsonObj = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`JSON 解析失败: ${e.message}`);
    }

    // 支持简单路径语法: a.b.c 或 a[0].b 或 a/b/c
    const normalizedPath = jsonPath.replace(/\//g, '.').replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.').filter(p => p !== '');

    let current = jsonObj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        throw new Error(`路径 ${jsonPath} 在 ${part} 处遇到 null/undefined`);
      }
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }

    const resultStr = current === undefined || current === null
      ? ''
      : (typeof current === 'object' ? JSON.stringify(current) : String(current));

    console.log(`🔧 JSON 提取: ${jsonPath} = ${resultStr.substring(0, 80)}`);

    if (saveVariable) {
      this.variables[saveVariable] = resultStr;
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: saveVariable,
        value: resultStr
      });
    }

    chrome.runtime.sendMessage({
      action: 'jsonExtractResult',
      path: jsonPath,
      value: resultStr,
      variable: saveVariable
    });
  }

  // ==================== 切换 iframe 操作 ====================

  async executeSwitchIframe(operation) {
    const iframeAction = operation.iframeAction || 'enter';

    switch (iframeAction) {
      case 'enter': {
        const selector = this.substituteVariables(operation.selector || '');
        if (!selector) {
          throw new Error('进入 iframe 缺少选择器');
        }
        // 在当前文档上下文中查找 iframe 元素
        const doc = this.currentDocument || document;
        const iframe = doc.querySelector(selector);
        if (!iframe) {
          throw new Error(`未找到 iframe 元素: ${selector}`);
        }
        if (iframe.tagName !== 'IFRAME') {
          throw new Error(`目标元素不是 iframe: <${iframe.tagName.toLowerCase()}>`);
        }
        let iframeDoc = null;
        try {
          iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        } catch (e) {
          throw new Error(`无法访问 iframe 文档（可能是跨域限制）: ${e.message}`);
        }
        if (!iframeDoc) {
          throw new Error('无法访问 iframe 文档（可能是跨域限制或 iframe 尚未加载）');
        }
        this.currentDocument = iframeDoc;
        console.log(`🖼 进入 iframe: ${selector}`);
        break;
      }
      case 'exit': {
        // 退出到父级文档
        try {
          if (window.parent && window.parent.document && window.parent.document !== this.currentDocument) {
            this.currentDocument = window.parent.document;
            console.log('🖼 退出到父级文档');
          } else {
            this.currentDocument = document;
            console.log('🖼 已在主文档，无需退出');
          }
        } catch (e) {
          this.currentDocument = document;
          console.log('🖼 跨域无法访问父文档，回到主文档');
        }
        break;
      }
      case 'main': {
        this.currentDocument = document;
        console.log('🖼 回到主文档');
        break;
      }
      default:
        throw new Error(`未知 iframe 操作: ${iframeAction}`);
    }
  }

  // ==================== 元素计数操作 ====================

  async executeElementCount(operation) {
    const doc = this.currentDocument || document;
    const selector = this.substituteVariables(operation.selector || '');
    if (!selector) {
      throw new Error('元素计数操作缺少选择器');
    }

    let count = 0;
    try {
      count = doc.querySelectorAll(selector).length;
    } catch (error) {
      // 可能是 XPath
      try {
        const xpathResult = doc.evaluate(
          selector, doc, null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );
        count = xpathResult.snapshotLength;
      } catch (e) {
        throw new Error(`选择器无效: ${error.message}`);
      }
    }

    const varName = operation.countVariable || '';
    console.log(`🔢 元素计数: ${selector} = ${count}`);

    if (varName) {
      this.variables[varName] = String(count);
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: varName,
        value: String(count)
      });
    }

    chrome.runtime.sendMessage({
      action: 'elementCountResult',
      selector,
      count,
      variable: varName
    });
  }

  // ==================== 文件下载操作 ====================

  async executeFileDownload(operation) {
    const url = this.substituteVariables(operation.downloadUrl || '');
    const filename = this.substituteVariables(operation.downloadFilename || '') || '';
    if (!url) {
      throw new Error('文件下载URL为空');
    }

    try {
      const a = document.createElement('a');
      a.href = url;
      if (filename) {
        a.download = filename;
      } else {
        // 不设置 download 属性，让浏览器使用默认行为
        a.removeAttribute('download');
      }
      // 防止 download 属性被忽略 (跨域时浏览器可能直接导航)
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // 给浏览器一点时间发起下载
      await this.sleep(300);
      document.body.removeChild(a);

      console.log(`⬇ 触发文件下载: ${url}${filename ? ` → ${filename}` : ''}`);
    } catch (error) {
      throw new Error(`文件下载失败: ${error.message}`);
    }
  }

  // ==================== 页面信息操作 ====================

  async executePageInfo(operation) {
    const infoType = operation.infoType || 'url';
    const varName = operation.infoVariable || '';
    if (!varName) {
      throw new Error('页面信息操作缺少保存变量名');
    }

    let value = '';
    switch (infoType) {
      case 'url':
        value = window.location.href || '';
        break;
      case 'title':
        value = document.title || '';
        break;
      case 'referrer':
        value = document.referrer || '';
        break;
      case 'domain':
        value = document.domain || window.location.hostname || '';
        break;
      case 'hostname':
        value = window.location.hostname || '';
        break;
      case 'pathname':
        value = window.location.pathname || '';
        break;
      case 'search':
        value = window.location.search || '';
        break;
      case 'hash':
        value = window.location.hash || '';
        break;
      case 'userAgent':
        value = navigator.userAgent || '';
        break;
      case 'language':
        value = navigator.language || '';
        break;
      default:
        throw new Error(`未知页面信息类型: ${infoType}`);
    }

    console.log(`📄 页面信息 [${infoType}]: ${value.substring(0, 80)}`);

    this.variables[varName] = value;
    chrome.runtime.sendMessage({
      action: 'storeData',
      key: varName,
      value
    });

    chrome.runtime.sendMessage({
      action: 'pageInfoResult',
      infoType,
      value,
      variable: varName
    });
  }

  // ==================== 元素样式操作 ====================

  async executeElementStyle(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(150);

    const styleAction = operation.styleAction || 'set';
    const propName = this.substituteVariables(operation.stylePropertyName || '');
    if (!propName) {
      throw new Error('CSS属性名为空');
    }

    switch (styleAction) {
      case 'set': {
        const propValue = this.substituteVariables(operation.stylePropertyValue || '');
        element.style.setProperty(propName, propValue);
        console.log(`🎨 设置样式: ${propName}="${propValue}"`);
        break;
      }
      case 'get': {
        const computed = window.getComputedStyle(element).getPropertyValue(propName) || '';
        console.log(`🎨 获取样式: ${propName}="${computed}"`);
        const varName = operation.styleVariable || '';
        if (varName) {
          this.variables[varName] = computed;
          chrome.runtime.sendMessage({
            action: 'storeData',
            key: varName,
            value: computed
          });
        }
        chrome.runtime.sendMessage({
          action: 'elementStyleResult',
          propertyName: propName,
          value: computed,
          variable: varName
        });
        break;
      }
      case 'remove': {
        element.style.removeProperty(propName);
        console.log(`🎨 移除样式: ${propName}`);
        break;
      }
      default:
        throw new Error(`未知样式操作: ${styleAction}`);
    }

    this.highlightElement(element, '#00838F');
  }

  // ==================== 触发事件操作 ====================

  async executeTriggerEvent(operation) {
    const element = operation.selector ? this.findElement(operation.selector) : document;
    if (operation.selector && !element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    const eventType = this.substituteVariables(operation.eventType || '');
    if (!eventType) {
      throw new Error('事件类型为空');
    }

    const bubbles = operation.eventBubbles !== false;
    const cancelable = operation.eventCancelable !== false;

    // 解析事件初始化参数 (JSON 字符串)
    let eventInit = { bubbles, cancelable };
    if (operation.eventInit) {
      try {
        const parsed = JSON.parse(this.substituteVariables(operation.eventInit));
        eventInit = { ...eventInit, ...parsed };
      } catch (e) {
        throw new Error(`事件初始化参数 JSON 解析失败: ${e.message}`);
      }
    }

    let event;
    const lowerType = eventType.toLowerCase();

    // 根据事件类型构造合适的事件对象
    if (['click', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'dblclick', 'mousemove', 'contextmenu'].includes(lowerType)) {
      event = new MouseEvent(eventType, eventInit);
    } else if (['keydown', 'keyup', 'keypress'].includes(lowerType)) {
      event = new KeyboardEvent(eventType, eventInit);
    } else if (['input', 'change', 'submit', 'reset', 'focus', 'blur', 'load', 'error', 'scroll', 'resize'].includes(lowerType)) {
      event = new Event(eventType, eventInit);
    } else if (lowerType.startsWith('wheel')) {
      event = new WheelEvent(eventType, eventInit);
    } else if (lowerType === 'dragstart' || lowerType === 'drag' || lowerType === 'dragend' ||
               lowerType === 'dragenter' || lowerType === 'dragover' || lowerType === 'dragleave' || lowerType === 'drop') {
      try {
        event = new DragEvent(eventType, eventInit);
      } catch (e) {
        event = new Event(eventType, eventInit);
      }
    } else {
      // 自定义事件或未知事件类型，使用 CustomEvent
      try {
        event = new CustomEvent(eventType, eventInit);
      } catch (e) {
        event = new Event(eventType, eventInit);
      }
    }

    const target = element || document;
    target.dispatchEvent(event);

    if (operation.selector) {
      this.highlightElement(element, '#AD1457');
    }
    console.log(`🎉 触发事件: ${eventType} on ${operation.selector || 'document'}`);
  }

  // ==================== 正则提取操作 ====================

  async executeRegexExtract(operation) {
    const regexSource = operation.regexSource || 'variable';
    const pattern = this.substituteVariables(operation.regexPattern || '');
    if (!pattern) {
      throw new Error('正则表达式为空');
    }

    let text = '';
    switch (regexSource) {
      case 'variable': {
        const varName = operation.regexVariableName || '';
        if (!varName) throw new Error('变量名为空');
        text = this.variables ? String(this.variables[varName] ?? '') : '';
        if (!text) throw new Error(`变量 ${varName} 不存在或为空`);
        break;
      }
      case 'text': {
        text = this.substituteVariables(operation.regexText || '');
        if (!text) throw new Error('待匹配文本为空');
        break;
      }
      default:
        throw new Error(`未知正则来源: ${regexSource}`);
    }

    let regex;
    try {
      regex = new RegExp(pattern, operation.regexFlags || '');
    } catch (e) {
      throw new Error(`正则表达式无效: ${e.message}`);
    }

    const groupIndex = parseInt(operation.regexGroupIndex || '0', 10) || 0;
    if (groupIndex < 0) {
      throw new Error('捕获组索引不能为负数');
    }

    const match = regex.exec(text);
    let value = '';
    let matchIndex = groupIndex;

    if (match) {
      if (groupIndex === 0) {
        value = match[0] || '';
      } else if (groupIndex < match.length) {
        value = match[groupIndex] || '';
      } else {
        throw new Error(`捕获组索引 ${groupIndex} 超出范围 (该匹配共有 ${match.length - 1} 个捕获组)`);
      }
    } else {
      console.warn(`🔬 正则未匹配到内容: ${pattern}`);
    }

    console.log(`🔬 正则提取: ${pattern} → "${value.substring(0, 80)}"`);

    const saveVar = operation.regexSaveVariable || '';
    if (saveVar) {
      this.variables[saveVar] = value;
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: saveVar,
        value
      });
    }

    chrome.runtime.sendMessage({
      action: 'regexExtractResult',
      pattern,
      value,
      matchIndex,
      variable: saveVar
    });
  }

  // ==================== 元素位置操作 ====================

  async executeElementPosition(operation) {
    const element = this.findElement(operation.selector);
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    element.scrollIntoView({ behavior: 'auto', block: 'center' });
    await this.sleep(100);

    const rect = element.getBoundingClientRect();
    const infoType = operation.positionInfoType || 'all';
    const prefix = operation.positionSavePrefix || 'pos';

    const allFields = {
      x: String(Math.round(rect.x)),
      y: String(Math.round(rect.y)),
      width: String(Math.round(rect.width)),
      height: String(Math.round(rect.height)),
      top: String(Math.round(rect.top)),
      bottom: String(Math.round(rect.bottom)),
      left: String(Math.round(rect.left)),
      right: String(Math.round(rect.right))
    };

    const storeVar = (name, value) => {
      this.variables[name] = value;
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: name,
        value
      });
    };

    if (infoType === 'all') {
      // 同时保存所有字段，变量名为 前缀_字段名
      for (const [field, val] of Object.entries(allFields)) {
        storeVar(`${prefix}_${field}`, val);
      }
      console.log(`📐 元素位置 [all]: 已保存 ${Object.keys(allFields).length} 个变量 (${prefix}_x/y/width/...)`);
    } else {
      const val = allFields[infoType];
      if (val === undefined) {
        throw new Error(`未知位置信息类型: ${infoType}`);
      }
      storeVar(prefix, val);
      console.log(`📐 元素位置 [${infoType}]: ${prefix}=${val}`);
    }

    this.highlightElement(element, '#00897B');

    chrome.runtime.sendMessage({
      action: 'elementPositionResult',
      x: allFields.x,
      y: allFields.y,
      width: allFields.width,
      height: allFields.height,
      infoType,
      prefix
    });
  }

  // ==================== 数组操作 ====================

  async executeArrayOperation(operation) {
    const arrayName = operation.arrayName || '';
    if (!arrayName) {
      throw new Error('数组变量名为空');
    }

    const action = operation.arrayAction || 'push';
    const saveVar = operation.arraySaveVariable || '';

    // 读取现有数组 (以 JSON 字符串形式存储)
    let arr = [];
    const existing = this.variables ? this.variables[arrayName] : undefined;
    if (existing !== undefined && existing !== null && existing !== '') {
      if (Array.isArray(existing)) {
        arr = [...existing];
      } else if (typeof existing === 'string') {
        let parsed;
        try {
          parsed = JSON.parse(existing);
        } catch (e) {
          throw new Error(`变量 ${arrayName} 不是有效的 JSON 数组: ${e.message}`);
        }
        if (Array.isArray(parsed)) {
          arr = parsed;
        } else {
          throw new Error(`变量 ${arrayName} 不是数组 (实际类型: ${typeof parsed})`);
        }
      } else {
        throw new Error(`变量 ${arrayName} 不是数组`);
      }
    }

    const persistArray = () => {
      this.variables[arrayName] = JSON.stringify(arr);
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: arrayName,
        value: this.variables[arrayName]
      });
    };

    const saveResult = (value) => {
      if (saveVar) {
        this.variables[saveVar] = String(value);
        chrome.runtime.sendMessage({
          action: 'storeData',
          key: saveVar,
          value: String(value)
        });
      }
    };

    let result = '';
    let resultLength = arr.length;

    switch (action) {
      case 'push': {
        const rawValue = this.substituteVariables(operation.arrayValue || '');
        const items = this.parseArrayValue(rawValue);
        arr.push(...items);
        resultLength = arr.length;
        persistArray();
        console.log(`📚 数组 push: ${arrayName} 长度=${arr.length}`);
        break;
      }
      case 'unshift': {
        const rawValue = this.substituteVariables(operation.arrayValue || '');
        const items = this.parseArrayValue(rawValue);
        arr.unshift(...items);
        resultLength = arr.length;
        persistArray();
        console.log(`📚 数组 unshift: ${arrayName} 长度=${arr.length}`);
        break;
      }
      case 'pop': {
        if (arr.length === 0) {
          throw new Error(`数组 ${arrayName} 为空，无法 pop`);
        }
        result = arr.pop();
        resultLength = arr.length;
        persistArray();
        saveResult(result);
        console.log(`📚 数组 pop: ${arrayName} → "${String(result).substring(0, 50)}"`);
        break;
      }
      case 'shift': {
        if (arr.length === 0) {
          throw new Error(`数组 ${arrayName} 为空，无法 shift`);
        }
        result = arr.shift();
        resultLength = arr.length;
        persistArray();
        saveResult(result);
        console.log(`📚 数组 shift: ${arrayName} → "${String(result).substring(0, 50)}"`);
        break;
      }
      case 'length': {
        result = String(arr.length);
        resultLength = arr.length;
        saveResult(result);
        console.log(`📚 数组 length: ${arrayName} = ${arr.length}`);
        break;
      }
      case 'join': {
        const separator = this.substituteVariables(operation.arrayValue || ',');
        result = arr.join(separator);
        resultLength = arr.length;
        saveResult(result);
        console.log(`📚 数组 join: ${arrayName} → "${result.substring(0, 80)}"`);
        break;
      }
      case 'indexOf': {
        const searchValue = this.substituteVariables(operation.arrayValue || '');
        const idx = arr.indexOf(searchValue);
        result = String(idx);
        resultLength = arr.length;
        saveResult(result);
        console.log(`📚 数组 indexOf: ${arrayName} 查找 "${searchValue}" → ${idx}`);
        break;
      }
      case 'slice': {
        const startIdx = parseInt(this.substituteVariables(operation.arrayValue || '0')) || 0;
        const endIdxStr = this.substituteVariables(operation.arrayIndex || '');
        const endIdx = endIdxStr ? parseInt(endIdxStr) : undefined;
        const sliced = arr.slice(startIdx, endIdx);
        result = JSON.stringify(sliced);
        resultLength = sliced.length;
        saveResult(result);
        console.log(`📚 数组 slice: ${arrayName}(${startIdx}, ${endIdx}) → 长度 ${sliced.length}`);
        break;
      }
      case 'clear': {
        arr = [];
        resultLength = 0;
        persistArray();
        console.log(`📚 数组 clear: ${arrayName}`);
        break;
      }
      default:
        throw new Error(`未知数组操作: ${action}`);
    }

    chrome.runtime.sendMessage({
      action: 'arrayOperationResult',
      arrayName,
      arrayAction: action,
      length: resultLength,
      result: String(result),
      variable: saveVar
    });
  }

  // 解析数组操作值：如果是 JSON 数组字符串则展开为多项，否则视为单个值
  parseArrayValue(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return [];
    }
    const trimmed = String(rawValue).trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item)));
        }
      } catch (e) {
        // 不是有效 JSON 数组，按单值处理
      }
    }
    return [String(rawValue)];
  }

  // ==================== 滚动到边缘操作 ====================

  async executeScrollToEdge(operation) {
    const direction = operation.edgeDirection || 'bottom';
    const behavior = operation.edgeBehavior || 'smooth';

    let scrollTarget;
    if (operation.selector) {
      const element = this.findElement(operation.selector);
      if (!element) {
        throw new Error(`未找到元素: ${operation.selector}`);
      }
      scrollTarget = element;
    } else {
      scrollTarget = document.scrollingElement || document.documentElement || document.body;
    }

    // 对于普通元素需要滚动其内部；对于页面则使用 window.scrollTo
    const isWindow = !operation.selector;

    if (isWindow) {
      const scrollOpts = { behavior };
      switch (direction) {
        case 'top':
          scrollOpts.top = 0;
          scrollOpts.left = 0;
          break;
        case 'bottom':
          scrollOpts.top = document.documentElement.scrollHeight || document.body.scrollHeight;
          scrollOpts.left = 0;
          break;
        case 'left':
          scrollOpts.left = 0;
          scrollOpts.top = window.scrollY;
          break;
        case 'right':
          scrollOpts.left = document.documentElement.scrollWidth || document.body.scrollWidth;
          scrollOpts.top = window.scrollY;
          break;
        default:
          throw new Error(`未知滚动方向: ${direction}`);
      }
      window.scrollTo(scrollOpts);
    } else {
      switch (direction) {
        case 'top':
          scrollTarget.scrollTop = 0;
          break;
        case 'bottom':
          scrollTarget.scrollTop = scrollTarget.scrollHeight;
          break;
        case 'left':
          scrollTarget.scrollLeft = 0;
          break;
        case 'right':
          scrollTarget.scrollLeft = scrollTarget.scrollWidth;
          break;
        default:
          throw new Error(`未知滚动方向: ${direction}`);
      }
    }

    await this.sleep(behavior === 'smooth' ? 500 : 100);

    if (!isWindow) {
      this.highlightElement(scrollTarget, '#1565C0');
    }
    console.log(`⏫ 滚动到边缘: ${direction} on ${operation.selector || 'window'}`);
  }

  // ==================== 文本转语音操作 ====================

  async executeTextToSpeech(operation) {
    const text = this.substituteVariables(operation.ttsText || '');
    if (!text) {
      throw new Error('朗读文本为空');
    }

    if (!('speechSynthesis' in window)) {
      throw new Error('当前浏览器不支持 Web Speech API (speechSynthesis)');
    }

    const sendResult = (success, error = '') => {
      chrome.runtime.sendMessage({
        action: 'textToSpeechResult',
        success,
        error,
        text
      });
    };

    // 取消可能正在进行的朗读
    try {
      window.speechSynthesis.cancel();
    } catch (e) { /* ignore */ }

    const utterance = new SpeechSynthesisUtterance(text);

    const lang = this.substituteVariables(operation.ttsLang || '');
    if (lang) {
      utterance.lang = lang;
    }
    const rate = parseFloat(operation.ttsRate);
    if (!isNaN(rate)) {
      utterance.rate = Math.max(0.1, Math.min(10, rate));
    }
    const pitch = parseFloat(operation.ttsPitch);
    if (!isNaN(pitch)) {
      utterance.pitch = Math.max(0, Math.min(2, pitch));
    }
    const volume = parseFloat(operation.ttsVolume);
    if (!isNaN(volume)) {
      utterance.volume = Math.max(0, Math.min(1, volume));
    }

    // 指定语音名称
    const voiceName = this.substituteVariables(operation.ttsVoice || '');
    if (voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find(v => v.name && v.name.includes(voiceName));
      if (matched) {
        utterance.voice = matched;
      } else {
        console.warn(`🔊 未找到语音 "${voiceName}"，将使用默认语音`);
      }
    }

    // 等待朗读完成的 Promise
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeoutMs = Math.max(10000, text.length * 200); // 至少 10s，每字 200ms
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        sendResult(false, `朗读超时 (${timeoutMs}ms)`);
        reject(new Error(`朗读超时 (${timeoutMs}ms)`));
      }, timeoutMs);

      utterance.onend = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.log(`🔊 朗读完成: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        sendResult(true);
        resolve();
      };

      utterance.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const errMsg = e.error || '朗读失败';
        console.error('🔊 朗读错误:', errMsg);
        sendResult(false, errMsg);
        reject(new Error(`朗读失败: ${errMsg}`));
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sendResult(false, e.message);
        reject(new Error(`朗读启动失败: ${e.message}`));
      }
    });
  }

  // ==================== 网络状态操作 ====================

  async executeNetworkStatus(operation) {
    const infoType = operation.networkInfoType || 'all';
    const prefix = operation.networkSavePrefix || 'net';

    // Network Information API 在部分浏览器可用
    const conn = (navigator.connection || navigator.mozConnection || navigator.webkitConnection);

    const allFields = {
      online: navigator.onLine ? 'true' : 'false',
      effectiveType: conn && conn.effectiveType ? String(conn.effectiveType) : '',
      downlink: conn && typeof conn.downlink === 'number' ? String(conn.downlink) : '',
      rtt: conn && typeof conn.rtt === 'number' ? String(conn.rtt) : '',
      saveData: conn && conn.saveData ? 'true' : 'false'
    };

    const storeVar = (name, value) => {
      this.variables[name] = value;
      chrome.runtime.sendMessage({
        action: 'storeData',
        key: name,
        value
      });
    };

    if (infoType === 'all') {
      for (const [field, val] of Object.entries(allFields)) {
        storeVar(`${prefix}_${field}`, val);
      }
      console.log(`📡 网络状态 [all]: 已保存 ${Object.keys(allFields).length} 个变量 (${prefix}_online/effectiveType/...)`);
    } else {
      const val = allFields[infoType];
      if (val === undefined) {
        throw new Error(`未知网络信息类型: ${infoType}`);
      }
      storeVar(prefix, val);
      console.log(`📡 网络状态 [${infoType}]: ${prefix}=${val}`);
    }

    chrome.runtime.sendMessage({
      action: 'networkStatusResult',
      online: allFields.online === 'true',
      effectiveType: allFields.effectiveType,
      downlink: allFields.downlink !== '' ? parseFloat(allFields.downlink) : undefined,
      rtt: allFields.rtt !== '' ? parseInt(allFields.rtt) : undefined,
      saveData: allFields.saveData === 'true',
      infoType,
      prefix
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

  // 等待元素文本符合指定条件
  // matchMode: contains(包含) / equals(完全等于) / startsWith / endsWith / notContains(不包含)
  async waitForElementText(selector, expectedText, matchMode = 'contains', timeout = 10000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.shouldStop) {
          reject(new Error('用户停止执行'));
          return;
        }

        const element = this.findElement(selector);
        const actualText = element ? (element.textContent || '').trim() : '';

        let matched = false;
        if (element) {
          switch (matchMode) {
            case 'contains':
              matched = actualText.includes(expectedText);
              break;
            case 'equals':
              matched = actualText === expectedText;
              break;
            case 'startsWith':
              matched = actualText.startsWith(expectedText);
              break;
            case 'endsWith':
              matched = actualText.endsWith(expectedText);
              break;
            case 'notContains':
              matched = !actualText.includes(expectedText);
              break;
            default:
              matched = actualText.includes(expectedText);
          }
        }

        if (matched) {
          this.highlightElement(element, '#FF9800');
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素文本超时 (${timeout}ms): ${selector} (期望 ${matchMode} "${expectedText}")`));
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
    const doc = this.currentDocument || document;

    if (!selector) return doc.body;

    try {
      let element = doc.querySelector(selector);
      if (element) return element;

      const xpathResult = doc.evaluate(
        selector, doc, null,
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
