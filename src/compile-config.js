// 这里放运行时配置
const path = require('path')


module.exports = {
    account: {
        sysCode: 'UNIGIS',
        appCode: 'UNIGISSERVER3',
        appName: 'UniGISServer3',
        moduleCode: 'UNIGISSERVER3',
        moduleName: 'UNIGISSERVER3',
    },
    rootDir: path.join(__dirname, '..'),
    // 主题配置
    theme: {
        theme: 'river',
        colorSchema: '雅蓝',
    },

    html: {
        title: {
            text: 'bimViewer',
        }
    },
    resolve: {
        alias: {
            '@plugin-bim': __dirname
        },
    },
}
