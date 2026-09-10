<template>
  <div class="viewer-panel">
    <div ref="viewerRoot" class="threejs-viewer-canvas"></div>
    <!-- 相机参数弹窗 -->
    <CameraInfoDialog :controller="controller" />
  </div>
</template>

<script>
import { defineComponent, markRaw } from 'vue'
import { BimViewerController } from '../../utils/BimViewerController'
import { MaterialConfigurator } from '../../utils/common/material'
import CameraInfoDialog from '../common/CameraInfoDialog.vue'

export default defineComponent({
  name: 'ThreeTilesViewer',
  components: { CameraInfoDialog },
  props: {
    /** 3D Tiles 数据源列表 [{id, url}] */
    tilesetSources: {
      type: Array,
      default: () => [],
      validator: (v) => v.every((s) => s && typeof s.id === 'string' && typeof s.url === 'string'),
    },
    /** GLTF 数据源列表 [{id, url}] */
    gltfSources: {
      type: Array,
      default: () => [],
      validator: (v) => v.every((s) => s && typeof s.id === 'string' && typeof s.url === 'string'),
    },
    /** 环境配置文件 */
    envConfig: {
      type: String,
      default: '',
    },
    /** 材质配置文件路径 */
    materialConfig: {
      type: String,
      default: '',
    },
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
        new BimViewerController({
          onGltfPick: (info) => {
            console.log('Gltf 模型点击事件', info)
            this.$emit('gltf-pick', info)
          },
        }),
      )
      await this.controller.mount(viewerRoot, this.envConfig || undefined)
      this.$emit('ready', this.controller)

      // 加载 3D Tiles 地形（无数据源或加载失败时跳过，不影响 GLB 加载）
      if (this.tilesetSources.length > 0) {
        try {
          await this.loadTilesets()
        } catch (error) {
          this.$message.warning('3DTiles 场景加载失败', error)
          this.$emit('error', { type: 'tileset', error })
        }
      }

      // 加载 GLB 模型
      if (this.gltfSources.length > 0) {
        try {
          await this.loadGltfModels()
        } catch (error) {
          this.$message.error('GLB 模型加载失败', error)
          this.$emit('error', { type: 'gltf', error })
        }
      }

      // 兜底：若无 3D Tiles（load-tile-set 事件未触发），在此应用相机配置
      const cameraCfg = window.BizConfig?.glbConfig?.camera
      if (cameraCfg && !this.controller.cameraManager.isViewSettled()) {
        this.controller.applyCameraConfig(cameraCfg)
      }
    },

    /** 加载 tilesetSources 中的 3D Tiles 场景 */
    async loadTilesets() {
      if (!this.controller) return
      const sources = this.tilesetSources.map((s) => ({
        id: s.id,
        name: s.name || s.id,
        kind: 'terrain',
        url: s.url,
      }))
      await this.controller.loadScene(sources)
    },

    /** 依次加载 gltfSources 中的 GLTF 模型 */
    async loadGltfModels() {
      if (!this.controller) return
      const loader = this.controller.getGltfModelLoader()
      const renderer = this.controller.renderer
      const geoInfo = window.BizConfig?.glbConfig?.geoInfo
      if (!geoInfo) {
        console.warn('未找到地理配准配置，跳过 geo 定位。')
      }

      // 材质配置器复用（避免循环内重复构建 ID 映射）
      const matCfg = this.materialConfig ? new MaterialConfigurator(renderer) : null

      for (const source of this.gltfSources) {
        try {
          const model = await loader.loadGltf(source.url, { geo: geoInfo })

          if (matCfg) {
            await matCfg.applyFromUrl(
              this.materialConfig,
              model,
            )
          }
          console.log(`已加载模型: ${source.id} (${source.url})`)
          this.$emit('model-loaded', { id: source.id, url: source.url })
        } catch (error) {
          this.$message.error(`模型加载失败: ${source.url}`, error)
          this.$emit('error', { type: 'gltf', error, id: source.id, url: source.url })
        }
      }
    },

    // ========== 公共方法（外部通过 ref 调用） ==========

    /**
     * 按名称查找部件，返回结构化信息（与 gltf-pick 事件 info 格式一致）。
     * @param {string} name - 部件名称
     * @returns {Object|null} { object, name, path, worldPosition, localPosition, screenPosition, model }
     */
    findPartByName(name) {
      return this.controller?.getGltfModelLoader()?.findPartByName(name) ?? null
    },

    /**
     * 按 name 修改部件材质。
     * @param {string} name - mesh name
     * @param {string|THREE.Material} matKey - 材质库 ID（如 'm5'）或 THREE.Material 实例
     * @returns {boolean}
     */
    setPartMaterial(name, matKey) {
      const info = this.findPartByName(name)
      if (!info) {
        console.warn(`部件 "${name}" 未找到`)
        return false
      }
      const part = info.object
      if (typeof matKey === 'string') {
        const mc = new MaterialConfigurator(this.controller?.renderer)
        const mat = mc.getMaterialByKey(matKey)
        if (!mat || !mat.isMaterial) return false
        part.traverse((c) => { if (c.isMesh) c.material = mat })
        return true
      }
      part.traverse((c) => { if (c.isMesh) c.material = matKey })
      return true
    },

    /** 按 name 高亮部件（半透明 + 轮廓线）并飞行聚焦 */
    highlightPart(name) {
      const loader = this.controller?.getGltfModelLoader()
      const info = this.findPartByName(name)
      if (!info || !loader) return false
      loader.highlight(info.object)
      loader.flyToObject(info.object)
      console.log(`已高亮部件 "${name}"`, info)
      return info
    },

    /** 清除当前高亮 */
    clearHighlight() {
      this.controller?.clearGltfHighlight()
    },

    /** 控制环境贴图是否启用 */
    controlEnvEnabled(enabled) {
      this.controller?.environment.controlEnvMapEnabled(enabled)
    },
    /** 控制3dtiles图层的显隐 */
    setLayerVisible(sourceId, visible) {
      this.controller?.setLayerVisible(sourceId, visible)
    },
    /** 切换双相机透视渲染模式 */
    setDualPass(enabled) {
      this.controller?.setDualPass(enabled)
    },
  },
})
</script>

<style >
.viewer-panel,
.viewer-panel .threejs-viewer-canvas {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
