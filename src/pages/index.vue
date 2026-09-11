<template>
    <InsBimPlusViewer ref="bimViewer" :tileset-sources="tilesetSources" :gltf-sources="gltfSources"
        :env-config="envConfig" :material-config="materialConfig" @ready="onReady" @model-loaded="onModelLoaded"
        @error="onError" @gltf-pick="onPartClick" @label-click="onLabelClick" />
    <div class="operation-container flex">
        <el-switch v-model="envShow" active-text="环境" @change="handleSceneEvent"></el-switch>
        <el-checkbox style="margin-left: 30px" v-model="tileShow" @change="handleLayerToggle">地形</el-checkbox>
        <el-checkbox v-model="canansShow" @change="handleDualPassToggle">双透视</el-checkbox>
        <el-checkbox v-model="labelsVisible" @change="handleRenderLabels">标签</el-checkbox>
    </div>
</template>

<script>
import { createApp } from "vue";
import PartInfoLabel from "./PartInfoLabel.vue";

export default {
    data() {
        return {
            tilesetSources: [
                {
                    id: "rm-tileset",
                    url: 'http://192.168.8.77:3000/data/3dtiles/rm/tileset.json',
                },
            ],
            gltfSources: [
                {
                    id: "rm-glb",
                    url: "http://192.168.8.77:3000/data/gltf/rm/RM_.glb",
                },
            ],
            materialConfig: "./config/material-config.json",
            envConfig: "./config/env-config.json",
            controller: null, // 底层控制器实例
            envShow: true, // 环境显示
            tileShow: true, // 地形显示
            canansShow: true, // 双透视显示
            labelsVisible: true, // 标签显示

            labelConfig: {
                // 图层组类型（同类型标签归为一组，便于整体显隐控制）
                type: "label",
                list: [
                    {
                        id: 1,
                        name: "料仓场地", // 标签名称（显示在名称牌上）
                        longitude: 98.348505, // 经度
                        latitude: 29.633465, // 纬度
                        altitude: 2711.1, // 高程（米）
                        icon: "./assets/icon/label.glb", // GLB 图标文件路径
                        opts: {
                            template: "标签_C", // GLB 中的模板节点名，如 标签_A / 标签_B / 标签_C / 标签_D
                            color: "#88ddff", // 圆环/涟漪颜色，CSS 颜色值
                            animation: "bounce", // 动画类型：bounce(弹跳) / rotate(旋转) / both(两者) / none(无)
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.3, // 图标离地高度
                            ripple: true, // 是否显示底部涟漪扩散动画
                            showName: true, // 是否显示名称牌
                            nameStyle: "glow", // 名称牌样式：bubble(气泡) / glow(霓虹发光)
                            nameTagHeight: 1.3, // 名称牌距离标签顶部的高度
                            nameTagSize: 1.5, // 名称牌大小缩放
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                    {
                        id: 2,
                        name: "边坡", // 标签名称（显示在名称牌上）
                        longitude: 98.345574, // 经度
                        latitude: 29.650348, // 纬度
                        altitude: 2829.9, // 高程（米）
                        icon: "./assets/icon/label.glb", // GLB 图标文件路径
                        opts: {
                            template: "标签_D", // GLB 中的模板节点名，如 标签_A / 标签_B / 标签_C / 标签_D
                            color: "#88ddff", // 圆环/涟漪颜色，CSS 颜色值
                            animation: "bounce", // 动画类型：bounce(弹跳) / rotate(旋转) / both(两者) / none(无)
                            animEnabled: true, // 是否启用动画
                            scale: 200, // 整体缩放，BIM 场景较大建议 30-80
                            labelHeight: 0.3, // 图标离地高度
                            ripple: true, // 是否显示底部涟漪扩散动画
                            showName: true, // 是否显示名称牌
                            nameStyle: "plaque", // 名称牌样式：bubble(气泡) / glow(霓虹发光)
                            nameTagHeight: 1.3, // 名称牌距离标签顶部的高度
                            nameTagSize: 1.5, // 名称牌大小缩放
                            rotation: 0, // 整体 Y 轴旋转角度（度）
                        },
                    },
                ],
            },
        };
    },
    methods: {
        // 获取底层控制器实例
        onReady(controller) {
            this.controller = controller;
              // 渲染标签
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.renderLabels(this.labelConfig);
            }
        },
        onModelLoaded() {
          
        },
        onError({ type, error }) { },
        onPartClick(info) {
            if (!info || !this.controller) return;

            // 创建 DOM 容器，挂载 Vue 组件，添加到 3D 场景
            const el = document.createElement("div");
            const app = createApp(PartInfoLabel, {
                name: info.name,
                path: info.path,
            });
            app.mount(el);

            if (this.$refs.bimViewer) {
                // const pos = info.worldPosition.clone()
                // pos.z += 0  // 抬高值，可根据需要调整
                // pos.y += 50  // 抬高值，可根据需要调整
                this.$refs.bimViewer.addAnnotation(info.worldPosition, el);
            }
        },

        onLabelClick(info) {

        },

        handleSceneEvent() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.controlEnvEnabled(this.envShow);
            }
        },
        handleLayerToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setLayerVisible("rm-tileset", this.tileShow);
            }
        },
        handleDualPassToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setDualPass(this.canansShow);
            }
        },
        async handleRenderLabels() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.setLabelVisible("label", this.labelsVisible);
        },
    },
};
</script>

<style>
html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
}
</style>
