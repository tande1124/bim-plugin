/**
 * 这里是框架入口钩子, 这里可以引入其它npm包，或某些全局操作。
 */

import InsBimViewer from './components/InsBimViewer'
import { bimControls } from './exports/bimControls'
import { patchRequestFor3dTiles } from './utils/patch'


// 在 Mars3D 初始化之前拦截 fetch/XHR，为 gis 请求请求自动追加 token
patchRequestFor3dTiles()


export default {
    install(app) {
        app.component('InsBimPlusViewer', InsBimViewer)
    }
}

// 外部工具类
export { bimControls }