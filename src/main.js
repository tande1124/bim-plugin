/**
 * 这里是框架入口钩子, 这里可以引入其它npm包，或某些全局操作。
 */

import InsBimViewer from './components/InsBimViewer'
export default {
    install(app) {
        app.component('InsBimViewer', InsBimViewer)
    }
}