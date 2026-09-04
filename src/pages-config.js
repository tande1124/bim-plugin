// 这里放置路由，同时会自动生成对应菜单

module.exports = [
    {
        path: '/hello-world',
        component: () => import('@biz/pages/hello-world'),
        meta: {
            title: '你好世界',
        }
    },
]