<template>
    <InsBimPlusViewer ref="bimViewer" :tileset-sources="tilesetSources" :gltf-sources="gltfSources" 
        :env-config="envConfig"
        :material-config="materialConfig" 
        @ready="onReady"
        @gltf-pick="onPartClick" @model-loaded="onModelLoaded" @error="onError" />
      <div class="operation-container flex">
          <el-switch v-model="envShow" active-text="环境" @change="handleSceneEvent"></el-switch>
          <el-checkbox style="margin-left: 30px;" v-model="tileShow" @change="handleLayerToggle">地形</el-checkbox>
          <el-checkbox v-model="canansShow" @change="handleDualPassToggle">双透视</el-checkbox>
      </div>

</template>

<script>
import { createApp } from 'vue'
import PartInfoLabel from './PartInfoLabel.vue'

export default {
    data() {
        return {
            tilesetSources: [{
                id: 'rm-tileset',
                url: 'http://127.0.0.1:3000/data/3dtiles/rm/tileset.json',
            }],
            gltfSources: [{
                id: 'rm-glb',
                url: 'http://127.0.0.1:3000/data/gltf/rm/RM_.glb',
            }],
            materialConfig: './config/material-config.json',
            envConfig: './config/env-config.json',
            controller: null,
            envShow: true,

            tileShow: true,
            canansShow: true,
        }
    },
    methods: {
        // 获取底层控制器实例
        onReady(controller) {
            this.controller = controller
        },
        onPartClick(info) {
            if (!info || !this.controller) return

            // 创建 DOM 容器，挂载 Vue 组件，添加到 3D 场景
            const el = document.createElement('div')
            const app = createApp(PartInfoLabel, { name: info.name, path: info.path })
            app.mount(el)

            if( this.$refs.bimViewer) {
                this.$refs.bimViewer.addAnnotation(info.worldPosition, el)
            }
        },
        onModelLoaded({ url }) {
        },
        onError({ type, error }) {
        },
        handleSceneEvent() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.controlEnvEnabled(this.envShow)
            }
        },
        handleLayerToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setLayerVisible('rm-tileset', this.tileShow)
            }
        },
        handleDualPassToggle() {
            if (this.$refs.bimViewer) {
                this.$refs.bimViewer.setDualPass(this.canansShow)
            }
        },
    },
}
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