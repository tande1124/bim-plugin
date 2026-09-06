<template>
    <InsBimViewer
        ref="bimViewer"
        :tileset-urls="tilesetUrls"
        :gltf-urls="gltfUrls"
        @ready="onReady"
        @gltf-pick="onPartClick"
        @model-loaded="onModelLoaded"
        @error="onError"
    />
</template>

<script>
export default {
    data() {
        return {
            tilesetUrls: ['./data/3dtiles/tileset.json'],
            gltfUrls: ['./data/gltf/jfs-bim.glb']
        }
    },
    methods: {
        onReady() {
            console.log('[BimViewer] 场景就绪')
        },
        onPartClick(info) {
            if (info) {
                console.log('[BimViewer] 点击部件:', info.name, '| 路径:', info.path)
            }
        },
        onModelLoaded({ url }) {
            console.log('[BimViewer] 模型加载完成:', url)
        },
        onError({ type, error }) {
            console.warn('[BimViewer] 加载失败:', type, error)
        },
    },
}
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>