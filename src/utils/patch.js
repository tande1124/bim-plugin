


import hub from '@core/hub'

/**
 * 全局拦截 fetch / XHR，为 GIS 资源请求通过 Authorization Header 注入 token。
 * 作为 queryParameters 的兜底方案，确保 Cesium 内部所有请求方式都携带 token。
 * 必须在 Mars3D 初始化之前调用。
 */
function patchRequestFor3dTiles() {
    const getToken = () => hub.store?.accountStore?.token || '';
    const securityStore = () => hub.store?.securityStore || {};
    // 需要附加鉴权头的接口路径前缀（快速过滤用）
    const AUTH_PATHS = [ '/dataserver/'];

    /**
     * 判断是否为 GIS 数据请求
     * 先用字符串 indexOf 快速过滤，大部分请求在此短路返回，避免昂贵的 URL 解析
     */
    const isGisDataUrl = (url) => {
        if (typeof url !== 'string') return false;
        if (!AUTH_PATHS.some(p => url.indexOf(p) !== -1)) return false;
        try {
            return new URL(url, window.location.origin).origin === window.location.origin;
        } catch (_) {
            return false;
        }
    };

    /** 向 headers 对象注入鉴权头（直接修改原对象，避免 new Headers 的复制开销） */
    const injectHeaders = (headers, url) => {
        const token = getToken();
        if (token && !('authorization' in headers)) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const secStore = securityStore();
        if (secStore?.isAccessContextEnabled && !('ins-access-context' in headers)) {
            headers['Ins-Access-Context'] = secStore.generateAccessContext(url);
        }
    };

    // ---- 拦截 fetch ----
    const originalFetch = window.fetch;
    window.fetch = function (input, init = {}) {
        try {
            const url = typeof input === 'string' ? input : (input?.url || '');
            if (isGisDataUrl(url)) {
                if (input instanceof Request) {
                    // Request 对象：需创建新实例来覆盖 headers
                    const h = new Headers(input.headers);
                    const token = getToken();
                    if (token && !h.has('Authorization')) {
                        h.set('Authorization', `Bearer ${token}`);
                    }
                    const secStore = securityStore();
                    if (secStore?.isAccessContextEnabled && !h.has('Ins-Access-Context')) {
                        h.set('Ins-Access-Context', secStore.generateAccessContext(url));
                    }
                    return originalFetch.call(this, new Request(input, { headers: h }));
                } else {
                    // 普通 url + init：确保 headers 为普通对象后直接注入
                    if (init.headers instanceof Headers || Array.isArray(init.headers)) {
                        init = { ...init, headers: Object.fromEntries(new Headers(init.headers)) };
                    } else if (!init.headers) {
                        init = { ...init, headers: {} };
                    }
                    injectHeaders(init.headers, url);
                }
            }
        } catch (_) { /* 静默 */ }
        return originalFetch.call(this, input, init);
    };

    // ---- 拦截 XHR ----
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this.__gisUrl = url;
        return originalOpen.call(this, method, url, async == undefined ? true : async, user, password);
    };

    XMLHttpRequest.prototype.send = function (body) {
        try {
            if (isGisDataUrl(this.__gisUrl) && !this.__authInjected) {
                this.__authInjected = true;
                const token = getToken();
                if (token) {
                    this.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                const secStore = securityStore();
                if (secStore?.isAccessContextEnabled) {
                    this.setRequestHeader('Ins-Access-Context', secStore.generateAccessContext(this.__gisUrl));
                }
            }
        } catch (_) { /* 静默 */ }
        return originalSend.call(this, body);
    };
}




export {
    patchRequestFor3dTiles
}
