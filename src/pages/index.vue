<template>
    <InsBimPlusViewer ref="bimViewer"  @ready="onReady" @model-loaded="onModelLoaded" @error="onError"
        @gltf-pick="onPartClick" @label-click="onLabelClick" />
    <div class="operation-container flex">
        <el-switch v-model="envShow" active-text="环境" @change="handleSceneEvent"></el-switch>
        <el-checkbox style="margin-left: 30px" v-model="tileShow" @change="handleLayerToggle">地形</el-checkbox>
        <el-checkbox v-model="canansShow" @change="handleDualPassToggle">双透视</el-checkbox>
        <el-checkbox v-model="labelsVisible" @change="handleRenderLabels">标签</el-checkbox>
        <el-button  type="primary"  style="margin:5px 30px" size="small" @click="getModelInfo">模型信息</el-button>

        <el-button  type="primary"  style="margin:5px 30px" size="small" @click="flyToTileset">地形飞行</el-button>
    </div>
    <div v-if="showModelTree" class="model-tree-panel">
        <div class="panel-header">
            <span>模型结构</span>
            <el-button type="info" link @click="showModelTree = false">关闭</el-button>
        </div>
        <div class="panel-body">
            <ModelTree :node="modelTreeData" :bimViewer="$refs.bimViewer" />
        </div>
    </div>
</template>

<script>
import { createApp } from "vue";
import PartInfoLabel from "./PartInfoLabel.vue";
import ModelTree from "./ModelTree.vue";

export default {
    components: {
        ModelTree,
    },
    data() {
        return {
            tilesetSources: [
                {
                    id: "rm-tileset",
                    name: "RM地形",
                    visible: true,
                    url: 'http://192.168.8.77:3000/data/3dtiles/rm/tileset.json',
                },
            ],
            gltfSources: [
                {
                    id: "rm-glb",
                    name: "RM模型",
                    visible: true,
                    url: "http://192.168.8.77:3000/data/gltf/rm/RM_.glb",
                }
            ],
            envConfig:window.BizConfig.envConfig,
            materialConfig:window.BizConfig.materialConfig,


            controller: null, // 底层控制器实例
            envShow: true, // 环境显示
            tileShow: true, // 地形显示
            canansShow: true, // 双透视显示
            labelsVisible: true, // 标签显示
            modelTreeData: null, // 模型树数据
            showModelTree: false, // 是否显示模型树面板

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
    components: { ModelTree },
    methods: {
        // 场景就绪后，按顺序加载环境、材质、地形、模型、标签
        async onReady(controller) {
            this.controller = controller;
            const v = this.$refs.bimViewer;
            if (!v) return;

            // 1. 环境配置
            v.applyEnvConfig(this.envConfig);

            // 2. 材质配置（先于模型加载，后续 loadGltfModels 会自动应用）
            v.applyMaterialConfig(this.materialConfig);

            // 3. 加载地形
            v.showLoading('正在加载地形…');
            await v.loadTilesets(this.tilesetSources);

            // 4. 加载模型（自动应用已设置的材质配置）
            v.showLoading('正在加载模型…');
            await v.loadGltfModels(this.gltfSources);

            // 5. 渲染标签
            await v.renderLabels(this.labelConfig);

            v.hideLoading();
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
                this.$refs.bimViewer.addAnnotation(info.worldPosition, el, app);
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
                this.$refs.bimViewer.setModelVisible("rm-tileset", this.tileShow);
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
        getModelInfo() {
            const id = this.gltfSources[0]?.id;
            if (!id || !this.$refs.bimViewer) return;
            this.modelTreeData = this.$refs.bimViewer.getModelTreeById(id);
            this.showModelTree = !!this.modelTreeData;
        },
        flyToTileset() {
            if (!this.$refs.bimViewer) return;
            this.$refs.bimViewer.flyToModel("rm-tileset");
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

.model-tree-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 300px;
    max-height: calc(100% - 80px);
    background: rgba(255, 255, 255, 0.95);
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    z-index: 100;
}

.model-tree-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #ebeef5;
    font-size: 14px;
    font-weight: 500;
}

.model-tree-panel .panel-body {
    flex: 1;
    overflow: auto;
    padding: 8px;
}
</style>
