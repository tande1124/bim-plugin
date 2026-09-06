<template>
  <div class="viewer-panel">
      <div ref="viewerRoot" class="viewer-canvas"></div>
  </div>
</template>

<script>
import { defineComponent, markRaw } from 'vue'
import * as THREE from 'three'
import { TilesViewerController } from '../../utils/TilesViewerController'
import { MaterialConfigurator } from '../../utils/common/material'

export default defineComponent({
  name: 'ThreeTilesViewer',
  props: {
    /** 3D Tiles 数据源 URL 列表 */
    tilesetUrls: { type: Array, default: () => [] },
    /** GLTF 模型 URL 列表 */
    gltfUrls: { type: Array, default: () => [] },
  },
  emits: ['ready', 'gltf-pick', 'model-loaded', 'error'],
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

      this.controller = markRaw(
        new TilesViewerController({
          onGltfPick: (info) => {
            this.$emit('gltf-pick', info)
          },
        }),
      )
      await this.controller.mount(viewerRoot)
      this.$emit('ready')

      // 加载 3D Tiles 地形（无数据源或加载失败时跳过，不影响 GLB 加载）
      if (this.tilesetUrls.length > 0) {
        try {
          await this.loadTilesets()
        } catch (error) {
          console.warn('3DTiles 场景加载失败，将仅加载 GLB 模型。', error)
          this.$emit('error', { type: 'tileset', error })
        }
      }

      // 加载 GLB 模型
      if (this.gltfUrls.length > 0) {
        try {
          await this.loadGltfModels()
        } catch (error) {
          console.error('GLTF 模型加载失败。', error)
          this.$emit('error', { type: 'gltf', error })
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
        this.$emit('model-loaded', { url, model })
      }
    },

    // ========== 公共方法（外部通过 ref 调用） ==========

    /** 按 mesh name 查找部件，返回 Object3D 或 null */
    findPartByName(name) {
      const root = this.controller?.getGltfModelLoader()?.root
      if (!root) return null
      let found = null
      root.traverse((obj) => {
        if (obj.name === name && !found) found = obj
      })
      return found
    },

    /**
     * 按 name 修改部件材质。
     * @param {string} name - mesh name
     * @param {string|THREE.Material} matKey - 材质库 ID（如 'm5'）或 THREE.Material 实例
     * @returns {boolean}
     */
    setPartMaterial(name, matKey) {
      const part = this.findPartByName(name)
      if (!part) {
        console.warn(`部件 "${name}" 未找到`)
        return false
      }
      if (typeof matKey === 'string') {
        const mc = new MaterialConfigurator(this.controller?.renderer)
        const mat = mc.getMaterialByKey(matKey)
        if (!mat || !(mat instanceof THREE.Material)) return false
        part.traverse((c) => { if (c.isMesh) c.material = mat })
        return true
      }
      part.traverse((c) => { if (c.isMesh) c.material = matKey })
      return true
    },

    /** 按 name 高亮部件（半透明 + 轮廓线） */
    highlightPart(name) {
      const part = this.findPartByName(name)
      this.controller?.getGltfModelLoader()?.highlight(part ?? null)
    },

    /** 清除当前高亮 */
    clearHighlight() {
      this.controller?.clearGltfHighlight()
    },

    /** 获取底层控制器实例（高级用法） */
    getController() {
      return this.controller
    },
  },
})
</script>

<style>
.viewer-panel,
.viewer-panel .viewer-canvas {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
