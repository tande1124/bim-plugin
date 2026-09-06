// 这里放置路由，同时会自动生成对应菜单

module.exports = [
    {
        path: '/index',
        component: () => import('@biz/pages/index'),
        meta: {
            title: 'BIM',
        }
    },
]