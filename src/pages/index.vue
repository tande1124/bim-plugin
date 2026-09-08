<template>
    <InsBimViewer ref="bimViewer" :tileset-urls="tilesetUrls" :gltf-urls="gltfUrls" @ready="onReady"
        @gltf-pick="onPartClick" @model-loaded="onModelLoaded" @error="onError" />
</template>

<script>
export default {
    data() {
        return {
            tilesetUrls: ['http://127.0.0.1:3000/data/3dtiles/rm/tileset.json'],
            gltfUrls: ['http://127.0.0.1:3000/data/gltf/rm/RM_.glb']
        }
    },
    methods: {
        // 获取底层控制器实例
        onReady(controller) {
            console.log('[BimViewer] 场景就绪', controller)
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
        handleSceneEvent() {
            if (this.$refs.bimViewer) {
                // 按 name 修改部件材质。
                // this.$refs.bimViewer.setPartMaterial(partName, matKey)

                //  按 name 高亮部件（半透明 + 轮廓线） 
                // this.$refs.bimViewer.highlightPart(partName)

                // 清除当前高亮
                // this.$refs.bimViewer.clearHighlight()
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