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
import { getDefaultSceneConfig } from '@/utils/common/tileset'
import { MaterialConfigurator } from '@/utils/common/material'

export default defineComponent({
  name: 'ThreeTilesViewer',
  data() {
    return {
      controller: null,
      defaultSceneConfig: getDefaultSceneConfig(),
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
      const hasTiles = this.defaultSceneConfig.sources.some((s) => s.url)
      if (hasTiles) {
        try {
          await this.loadDefaultScene()
        } catch (error) {
          console.warn('默认 3DTiles 场景加载失败，将仅加载 GLB 模型。', error)
        }
      }

      // 加载 GLB 模型（无 3D Tiles 时自动飞行聚焦到模型上）
      try {
        await this.loadDefaultGltf()
      } catch (error) {
        console.error('GLTF 模型加载失败。', error)
      }
    },

    async loadDefaultScene() {
      if (!this.controller) return
      await this.controller.loadScene(this.defaultSceneConfig.sources)
    },

    /** 直接加载默认 GLTF 模型到场景，并按地理配准参数自动定位 */
    async loadDefaultGltf() {
      if (!this.controller) return
      const loader = this.controller.getGltfModelLoader()
      const geoConfig = window.__GLTF_GEO_CONFIG__
      if (!geoConfig) {
        console.warn('[GLTF] 未找到地理配准配置 (public/config/config.js)，跳过 geo 定位。')
      }
      const model = await loader.loadGltf('./data/gltf/jfs-bim.glb', {
        geo: geoConfig,
      })

      // 材质配置：加载 material-state.json 并按 meshName 覆盖材质
      const matCfg = new MaterialConfigurator()
      const { hdrMeta, appliedCount } = await matCfg.applyFromUrl(
        './config/material-config.json',
        model,
        'test',
      )
      console.log(`[材质配置] 已应用 ${appliedCount} 个网格材质`, hdrMeta ? `| HDR: envInt=${hdrMeta.envInt}, bgInt=${hdrMeta.bgInt}, exposure=${hdrMeta.exposure}` : '')
    },
  },
})
</script>

<style scoped>
</style>
