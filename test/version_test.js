/**
 * compareVersions 单元测试（使用 Node.js 原生 assert 模块）
 *
 * 通过从 background.js 源码中提取 compareVersions 函数并执行，
 * 确保测试的是实际生产代码而非副本，保证逻辑一致性。
 *
 * 运行方式: node test/version_test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

/**
 * 从源码中按括号配平提取指定函数的完整定义
 * @param {string} src - 源码内容
 * @param {string} funcName - 函数名
 * @returns {string|null} 函数定义文本，未找到返回 null
 */
function extractFunction(src, funcName) {
  const start = src.indexOf(`function ${funcName}(`);
  if (start === -1) return null;
  let depth = 0;
  let i = start;
  // 定位到函数体起始的左大括号
  while (i < src.length && src[i] !== '{') i++;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

// 读取 background.js 源码并提取 compareVersions 函数
const src = fs.readFileSync(
  path.join(__dirname, '..', 'background.js'),
  'utf8'
);
const funcCode = extractFunction(src, 'compareVersions');
assert(funcCode, '未能从 background.js 提取 compareVersions 函数');

// 在当前模块作用域执行提取出的函数定义，使其可直接调用
// eslint-disable-next-line no-eval
eval(funcCode);

let passed = 0;
let failed = 0;

/**
 * 运行单个测试用例
 * @param {string} name - 用例描述
 * @param {Function} fn - 断言逻辑
 */
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  通过: ${name}`);
  } catch (e) {
    failed++;
    console.error(`  失败: ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log('=== compareVersions 单元测试 ===\n');

console.log('[1] 基础版本号比较');
test('1.0.0 == 1.0.0 应返回 0', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
});
test('1.0.1 > 1.0.0 应返回 1', () => {
  assert.strictEqual(compareVersions('1.0.1', '1.0.0'), 1);
});
test('1.0.0 < 1.0.1 应返回 -1', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.1'), -1);
});
test('2.0.0 > 1.9.9 应返回 1', () => {
  assert.strictEqual(compareVersions('2.0.0', '1.9.9'), 1);
});
test('1.9.9 < 2.0.0 应返回 -1', () => {
  assert.strictEqual(compareVersions('1.9.9', '2.0.0'), -1);
});
test('1.2.3 > 1.2 应返回 1（缺省段视为 0）', () => {
  assert.strictEqual(compareVersions('1.2.3', '1.2'), 1);
});

console.log('\n[2] 带前缀 v 的版本号');
test('v1.0.0 == 1.0.0 应返回 0', () => {
  assert.strictEqual(compareVersions('v1.0.0', '1.0.0'), 0);
});
test('v2.0.0 > v1.0.0 应返回 1', () => {
  assert.strictEqual(compareVersions('v2.0.0', 'v1.0.0'), 1);
});

console.log('\n[3] 预发布后缀比较（正式版 > 预发布版）');
test('1.0.0 > 1.0.0-beta 应返回 1', () => {
  assert.strictEqual(compareVersions('1.0.0', '1.0.0-beta'), 1);
});
test('1.0.0-beta < 1.0.0 应返回 -1', () => {
  assert.strictEqual(compareVersions('1.0.0-beta', '1.0.0'), -1);
});
test('1.0.0-beta == 1.0.0-beta 应返回 0', () => {
  assert.strictEqual(compareVersions('1.0.0-beta', '1.0.0-beta'), 0);
});

console.log('\n[4] 预发布版本之间比较');
test('1.0.0-beta.1 > 1.0.0-beta.0 应返回 1', () => {
  assert.strictEqual(compareVersions('1.0.0-beta.1', '1.0.0-beta.0'), 1);
});
test('1.0.0-beta.0 < 1.0.0-beta.1 应返回 -1', () => {
  assert.strictEqual(compareVersions('1.0.0-beta.0', '1.0.0-beta.1'), -1);
});
test('1.0.0-beta.1 > 1.0.0-beta 应返回 1（数字段优先级高于缺失段）', () => {
  assert.strictEqual(compareVersions('1.0.0-beta.1', '1.0.0-beta'), 1);
});
test('1.0.0-beta < 1.0.0-beta.1 应返回 -1', () => {
  assert.strictEqual(compareVersions('1.0.0-beta', '1.0.0-beta.1'), -1);
});
test('1.0.0-alpha < 1.0.0-beta 应返回 -1（字典序）', () => {
  assert.strictEqual(compareVersions('1.0.0-alpha', '1.0.0-beta'), -1);
});
test('1.0.0-rc.1 > 1.0.0-beta.1 应返回 1（字典序）', () => {
  assert.strictEqual(compareVersions('1.0.0-rc.1', '1.0.0-beta.1'), 1);
});

console.log('\n[5] 复合场景');
test('2.0.0 > 1.0.0-beta.1 应返回 1', () => {
  assert.strictEqual(compareVersions('2.0.0', '1.0.0-beta.1'), 1);
});
test('v1.0.0-beta.1 < v1.0.0-rc.1 应返回 -1', () => {
  assert.strictEqual(compareVersions('v1.0.0-beta.1', 'v1.0.0-rc.1'), -1);
});
test('1.0.0-alpha.2 > 1.0.0-alpha.1 应返回 1', () => {
  assert.strictEqual(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1'), 1);
});

console.log('\n=== 测试结果 ===');
console.log(`通过: ${passed}，失败: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
