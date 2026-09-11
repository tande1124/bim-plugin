/**
 * 3D 标签配置文件
 */
export default {
    // 图层组类型（同类型标签归为一组，便于整体显隐控制）
    type: 'label',

    list: [
        {
            id: 1,
            name: '边坡',                          // 标签名称（显示在名称牌上）
            longitude: 98.348505,                   // 经度
            latitude: 29.633465,                    // 纬度
            altitude: 2711.1,                       // 高程（米）
            icon: './assets/icon/label.glb',        // GLB 图标文件路径
            opts: {
                icon: '标签_C',                     // GLB 中的模板节点名，如 标签_A / 标签_B / 标签_C / 标签_D
                color: '#88ddff',                   // 圆环/涟漪颜色，CSS 颜色值
                animation: 'bounce',                // 动画类型：bounce(弹跳) / rotate(旋转) / both(两者) / none(无)
                animEnabled: true,                  // 是否启用动画
                scale: 50,                          // 整体缩放，BIM 场景较大建议 30-80
                labelHeight: 0.3,                   // 图标离地高度
                ripple: true,                       // 是否显示底部涟漪扩散动画
                showName: true,                     // 是否显示名称牌
                nameStyle: 'bubble',                // 名称牌样式：bubble(气泡) / glow(霓虹发光)
                nameTagHeight: 1.3,                 // 名称牌距离标签顶部的高度
                nameTagSize: 0.65,                  // 名称牌大小缩放
                rotation: 0,                        // 整体 Y 轴旋转角度（度）
            }
        }
    ]
}
