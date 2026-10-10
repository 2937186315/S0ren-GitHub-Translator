const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const { webcrypto } = require('node:crypto');

function loadTestApi(overrides = {}) {
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'S0ren_GitHub_Translator.user.js'),
        'utf8',
    );
    const window = {
        __GHC_TEST_MODE__: true,
        location: {
            href: 'https://github.com/acme/rocket',
            pathname: '/acme/rocket',
        },
        setTimeout(callback) { return setTimeout(callback, 0); },
        clearTimeout,
    };
    const context = vm.createContext({
        console,
        crypto: webcrypto,
        document: {
            body: { classList: { contains() { return false; } } },
            head: { querySelector() { return null; } },
            querySelectorAll() { return []; },
        },
        GM_addStyle() {},
        GM_getValue(key, fallback) { return fallback; },
        GM_notification() {},
        GM_registerMenuCommand() { return 1; },
        GM_setValue() {},
        GM_unregisterMenuCommand() {},
        GM_xmlhttpRequest() { return { abort() {} }; },
        Map,
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
        Set,
        TextEncoder,
        URL,
        URLSearchParams,
        WeakMap,
        WeakSet,
        window,
        ...overrides,
    });
    context.globalThis = context;
    vm.runInContext(source, context, { filename: 'S0ren_GitHub_Translator.user.js' });
    return context.window.__GHC_TEST_API__;
}

function mockApi(responses) {
    const calls = [];
    const api = loadTestApi({
        GM_xmlhttpRequest(options) {
            calls.push(options);
            const response = responses[Math.min(calls.length - 1, responses.length - 1)];
            queueMicrotask(() => {
                if (response === 'timeout') options.ontimeout();
                else if (response === 'network') options.onerror({});
                else options.onload(response);
            });
            return { abort() { options.onabort(); } };
        },
    });
    return { ...api, calls };
}

const config = { provider: 'local', endpoint: 'https://example.test/v1/chat/completions', model: 'test' };
const newRun = () => ({ cancelled: false, requests: new Set(), navigationVersion: 0, done: 0, failed: 0 });
const success = { status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"translations":[{"id":"a","text":"你好"}]}' } }] }) };

test('repository detection works without metadata and excludes settings', () => {
    const api = loadTestApi();
    assert.equal(api.detectPageType(), 'repository');
    const settingsApi = loadTestApi({ window: { __GHC_TEST_MODE__: true, location: { href: 'https://github.com/settings/profile', pathname: '/settings/profile' } } });
    assert.notEqual(settingsApi.detectPageType(), 'repository');
    const container = { closest() { return null; } };
    const markdownApi = loadTestApi({ document: {
        body: { classList: { contains() { return false; } } },
        head: { querySelector() { return null; } },
        querySelectorAll(selector) { return selector === '.markdown-body, #wiki-body' ? [container] : []; },
    } });
    markdownApi.State.pageConfig = { currentPageType: markdownApi.detectPageType() };
    assert.equal(markdownApi.MarkdownTranslator.__test.findMarkdownContainers()[0], container);
});

test('cache separates endpoints but treats trailing slashes equally', () => {
    const { buildCacheKeySource } = loadTestApi().MarkdownTranslator.__test;
    const key = buildCacheKeySource('Hello', config);
    assert.notEqual(key, buildCacheKeySource('Hello', { ...config, endpoint: 'https://other.test/v1/chat/completions' }));
    assert.equal(key, buildCacheKeySource('Hello', { ...config, endpoint: config.endpoint + '/' }));
});

test('missing-document messages distinguish page detection from missing content', () => {
    const api = loadTestApi();
    const { getMarkdownUnavailableMessage } = api.MarkdownTranslator.__test;
    assert.match(getMarkdownUnavailableMessage(), /未识别当前页面类型/);
    api.State.pageConfig = { currentPageType: 'repository' };
    assert.match(getMarkdownUnavailableMessage(), /未找到 Markdown 正文/);
    api.State.pageConfig.currentPageType = 'settings/profile';
    assert.match(getMarkdownUnavailableMessage(), /不支持文档翻译/);
    api.State.pageConfig.currentPageType = 'repository/blob';
    assert.match(getMarkdownUnavailableMessage(), /不是 Markdown 文件/);
});

test('JSON-mode compatibility fallback still works', async () => {
    const api = mockApi([{ status: 400 }, success]);
    const result = await api.MarkdownTranslator.__test.requestWithRetry([{ id: 'a' }], config, newRun());
    assert.equal(result.get('a'), '你好');
    assert.equal(api.calls.length, 2);
    assert.equal(JSON.parse(api.calls[0].data).response_format.type, 'json_object');
    assert.equal(JSON.parse(api.calls[1].data).response_format, undefined);
});

test('invalid response goes straight to splitting without whole-batch retries', async () => {
    const api = mockApi([{ status: 200, responseText: 'invalid json' }]);
    const run = newRun();
    const session = {};
    await api.MarkdownTranslator.__test.processBatch(session, [{ id: 'a' }, { id: 'b' }], config, run);
    assert.equal(api.calls.length, 3); // One batch, then its two individual items.
    assert.equal(run.failed, 2);
});

test('authentication failures cancel outstanding requests and prevent later batches', async () => {
    for (const status of [401, 403]) {
        const api = mockApi([{ status }]);
        const run = newRun();
        let aborted = false;
        run.requests.add({ abort() { aborted = true; } });
        const session = { running: true };
        await api.MarkdownTranslator.__test.processBatch(session, [{ id: 'a' }], config, run);
        await api.MarkdownTranslator.__test.processBatch(session, [{ id: 'b' }], config, run);
        assert.equal(api.calls.length, 1);
        assert.equal(run.cancelled, true);
        assert.equal(aborted, true);
        assert.equal(session.running, false);
        assert.match(session.statusMessage, /密钥|权限/);
    }
});

test('transient failures still retry and recover', async () => {
    for (const failure of [{ status: 429 }, { status: 503 }, 'network', 'timeout']) {
        const api = mockApi([failure, success]);
        const result = await api.MarkdownTranslator.__test.requestWithRetry([{ id: 'a' }], config, newRun());
        assert.equal(result.get('a'), '你好');
        assert.equal(api.calls.length, 2);
    }
});

test('HTTP and timeout messages explain the next action', async () => {
    for (const [response, message] of [[{ status: 401 }, /密钥/], [{ status: 403 }, /权限/], [{ status: 429 }, /频繁/], ['timeout', /接口响应超时/]]) {
        const api = mockApi([response]);
        await assert.rejects(api.MarkdownTranslator.__test.requestProvider([{ id: 'a' }], config, newRun()), message);
    }
});

test('successful translation assembles every part and updates the document', () => {
    const { applyItemTranslation } = loadTestApi().MarkdownTranslator.__test;
    const node = { data: 'Hello world', isConnected: true };
    const segment = {
        node,
        original: 'Hello world',
        translated: null,
        translatedParts: new Array(2),
    };
    const session = {
        hasTranslation: false,
        mode: 'translated',
        segments: [segment],
    };

    applyItemTranslation(session, {
        segment,
        partIndex: 0,
        prefix: ' ',
        suffix: '',
    }, '你好');

    assert.equal(session.hasTranslation, false);
    assert.equal(node.data, 'Hello world');

    applyItemTranslation(session, {
        segment,
        partIndex: 1,
        prefix: '',
        suffix: ' ',
    }, '世界');

    assert.equal(segment.translated, ' 你好世界 ');
    assert.equal(node.data, ' 你好世界 ');
    assert.equal(session.hasTranslation, true);
});

test('translated content can switch back to the byte-identical original', () => {
    const { applyItemTranslation, setSessionMode } = loadTestApi().MarkdownTranslator.__test;
    const node = { data: 'Original', isConnected: true };
    const segment = {
        node,
        original: 'Original',
        translated: null,
        translatedParts: new Array(1),
    };
    const session = {
        hasTranslation: false,
        mode: 'original',
        segments: [segment],
    };

    applyItemTranslation(session, {
        segment,
        partIndex: 0,
        prefix: '',
        suffix: '',
    }, '译文');
    assert.equal(node.data, 'Original');

    setSessionMode(session, 'translated');
    assert.equal(node.data, '译文');

    setSessionMode(session, 'original');
    assert.equal(node.data, 'Original');
});
