/**
 * 网页操作执行器 - 内容脚本
 * 在目标页面中执行实际操作
 */

class OperationExecutor {
  constructor() {
    this.shouldStop = false;
    this.repeatConfig = null;
    this.initMessageListener();
    this.checkRefreshWait();
  }

  // ==================== 消息监听 ====================

  initMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'executeOperations':
          this.shouldStop = false;
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
      }
    });
  }

  // ==================== 操作执行引擎 ====================

  async executeOperations(operations, repeatInfo) {
    if (repeatInfo) {
      const totalStr = repeatInfo.total > 0 ? repeatInfo.total : '∞';
      console.log(`🔄 第 ${repeatInfo.current}/${totalStr} 次执行`);
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
        throw new Error(`步骤 ${i + 1} 失败: ${error.message}`);
      }
    }
  }

  async executeOperation(operation) {
    // 延迟
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
      default: throw new Error(`未知操作类型: ${operation.type}`);
    }
  }

  // ==================== 输入操作 ====================

  async executeInput(operation) {
    const element = this.findElement(operation.selector);
    
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    // 滚动到可见
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(200);

    // 聚焦
    element.focus();

    // 清空
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = '';
    } else if (element.isContentEditable) {
      element.textContent = '';
    }

    // 设置值
    const value = operation.value || '';
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = value;
    } else if (element.isContentEditable) {
      element.textContent = value;
    }

    // 触发事件
    this.dispatchInputEvents(element, value);
    
    // 高亮
    this.highlightElement(element, '#2196F3');
  }

  dispatchInputEvents(element, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    ['input', 'change'].forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });
  }

  // ==================== 点击操作 ====================

  async executeClick(operation) {
    const element = this.findElement(operation.selector);
    
    if (!element) {
      throw new Error(`未找到元素: ${operation.selector}`);
    }

    // 检查是否可点击
    if (element.disabled) {
      console.warn('元素已禁用，尝试强制点击');
    }

    // 滚动到可见
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);

    // 获取位置
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 模拟鼠标事件
    this.dispatchClickEvents(element, centerX, centerY);
    
    // 高亮
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

    // 完整事件序列
    const events = [
      new MouseEvent('mouseover', options),
      new MouseEvent('mousedown', options),
      new MouseEvent('focus', { bubbles: false }),
      new MouseEvent('mouseup', options),
      new MouseEvent('click', options)
    ];

    events.forEach(event => element.dispatchEvent(event));

    // 原生点击
    if (typeof element.click === 'function') {
      element.click();
    }
  }

  // ==================== 滚动操作 ====================

  async executeScroll(operation) {
    const position = operation.position || 0;
    const behavior = operation.behavior || 'smooth';

    // 滚动到指定位置
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
        window.location.reload();
        break;
        
      case 'waitElement':
        if (operation.waitSelector) {
          // 保存等待配置到sessionStorage
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

  checkRefreshWait() {
    try {
      const configStr = sessionStorage.getItem('__executor_wait_config__');
      if (configStr) {
        const config = JSON.parse(configStr);
        sessionStorage.removeItem('__executor_wait_config__');
        
        // 检查是否过期
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
        
        if (element && this.isElementVisible(element)) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待元素超时: ${selector}`));
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
      // CSS选择器
      let element = document.querySelector(selector);
      if (element) return element;

      // XPath
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
