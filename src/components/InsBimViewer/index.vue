<template>
  <div class="viewer-panel">
    <div class="viewer-stage">
      <div ref="viewerRoot" class="viewer-canvas"></div>
    </div>
  </div>
</template>

<script>
import { defineComponent, markRaw } from 'vue'
import { TilesViewerController } from '@/utils/TilesViewerController'
import { MaterialConfigurator } from '@/utils/common/material'

export default defineComponent({
  name: 'ThreeTilesViewer',
  props: {
    /** 3D Tiles 数据源 URL 列表 */
    tilesetUrls: { type: Array, default: () => [] },
    /** GLTF 模型 URL 列表 */
    gltfUrls: { type: Array, default: () => [] },
  },
  data() {
    return {
      controller: null,
    }
  },
  async mounted() {
    await this.bootstrap()
  },
  beforeUnmount() {
    this.controller?.destroy()
    this.controller = null
  },
  methods: {
    /** 初始化 Three.js 场景并加载默认地形与模型 */
    async bootstrap() {
      const viewerRoot = this.$refs.viewerRoot

      if (!viewerRoot) {
        return
      }

      this.controller = markRaw(new TilesViewerController())
      await this.controller.mount(viewerRoot)

      // 加载 3D Tiles 地形（无数据源或加载失败时跳过，不影响 GLB 加载）
      if (this.tilesetUrls.length > 0) {
        try {
          await this.loadTilesets()
        } catch (error) {
          console.warn('3DTiles 场景加载失败，将仅加载 GLB 模型。', error)
        }
      }

      // 加载 GLB 模型
      if (this.gltfUrls.length > 0) {
        try {
          await this.loadGltfModels()
        } catch (error) {
          console.error('GLTF 模型加载失败。', error)
        }
      }
    },

    /** 将 tilesetUrls props 转换为 sources 并加载 3D Tiles 场景 */
    async loadTilesets() {
      if (!this.controller) return
      const sources = this.tilesetUrls.map((url, i) => ({
        id: `tileset-${i}`,
        name: `瓦片集 ${i + 1}`,
        kind: 'terrain',
        url,
      }))
      await this.controller.loadScene(sources)
    },

    /** 依次加载 gltfUrls 中的 GLTF 模型 */
    async loadGltfModels() {
      if (!this.controller) return
      const loader = this.controller.getGltfModelLoader()
      const geoConfig = window.__GLTF_GEO_CONFIG__
      if (!geoConfig) {
        console.warn('[GLTF] 未找到地理配准配置 (public/config/config.js)，跳过 geo 定位。')
      }

      for (const url of this.gltfUrls) {
        const model = await loader.loadGltf(url, { geo: geoConfig })

        // 材质配置：加载 material-config.json 并按 meshName 覆盖材质
        const matCfg = new MaterialConfigurator()
        const { hdrMeta, appliedCount } = await matCfg.applyFromUrl(
          './config/material-config.json',
          model,
          'test',
        )
        console.log(`[材质配置] ${url} 已应用 ${appliedCount} 个网格材质`, hdrMeta ? `| HDR: envInt=${hdrMeta.envInt}, bgInt=${hdrMeta.bgInt}, exposure=${hdrMeta.exposure}` : '')
      }
    },
  },
})
</script>

<style scoped>
</style>
