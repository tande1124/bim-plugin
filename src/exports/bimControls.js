/**
 * BIM 查看器外部操作类
 *
 * 外部项目通过该对象在 InsBimPlusViewer 组件外部直接调用查看器相关方法
 * （模型操作、材质、标注、标签、环境控制等）。
 *
 * 使用方式：
 *   import { bimControls } from '@ins/vam2-plugin-bim'
 *   bimControls.highlightPart('some-part-name')
 */

import { getViewer } from './internal/viewerRegistry'
import { MaterialConfigurator } from '../core/loaders/MaterialConfigurator'

/** 材质配置器缓存实例（避免重复构建） */
let _matCfgInstance = null
/** 当前材质配置 URL，供后续 loadGltfModels 自动应用 */
let _materialConfigUrl = ''

/**
 * BIM 查看器外部操作接口
 */
const bimControls = {
  // ========== 数据加载 ==========

  /**
   * 加载 3D Tiles 地形。
   * @param {Array<{id: string, url: string, name?: string}>} sources
   */
  async loadTilesets(sources) {
    const c = getViewer()
    if (!c || !sources?.length) return
    const mapped = sources.map((s) => ({
      id: s.id,
      name: s.name || s.id,
      kind: 'terrain',
      url: s.url,
    }))
    await c.loadScene(mapped)
  },

  /**
   * 依次加载 GLTF 模型。
   * 若之前调用过 applyMaterialConfig，会自动将材质配置应用到新加载的模型。
   * @param {Array<{id: string, url: string}>} sources
   */
  async loadGltfModels(sources) {
    const c = getViewer()
    if (!c || !sources?.length) return
    const loader = c.getGltfModelLoader()
    const geoInfo = window.BizConfig?.glbConfig?.geoInfo
    if (!geoInfo) {
      console.warn('未找到地理配准配置，跳过 geo 定位。')
    }

    for (const source of sources) {
      try {
        const model = await loader.loadGltf(source.url, { geo: geoInfo, id: source.id, name: source.name })

        // 自动应用已缓存的材质配置
        if (_materialConfigUrl && _matCfgInstance) {
          await _matCfgInstance.applyFromUrl(_materialConfigUrl, model)
        }
        console.log(`已加载模型: ${source.id} (${source.url})`)
      } catch (error) {
        console.error(`模型加载失败: ${source.url}`, error)
      }
    }
  },

  /**
   * 加载并渲染 3D 标签，完成后自动飞行到标签位置。
   * @param {Object} config - 标签配置对象（含 type、list 字段）
   */
  async renderLabels(config) {
    const loader = getViewer()?.getLabelRenderer()
    if (!loader) return
    await loader.renderFromConfig(config)
  },

  // ========== 配置管理（整体替换） ==========

  /**
   * 从 JSON 文件重新加载整套环境配置（天空/HDR/光照/曝光）。
   * @param {string} url - env-config.json 路径
   */
  async applyEnvConfig(url) {
    await getViewer()?.applyEnvConfig(url)
  },

  /**
   * 从 JSON 文件重新加载材质映射，并重新应用到所有已加载 GLB 模型。
   * 后续调用 loadGltfModels 时也会自动应用此配置。
   * @param {string} url - material-config.json 路径
   */
  async applyMaterialConfig(url) {
    const c = getViewer()
    if (!c) return
    if (!_matCfgInstance) {
      _matCfgInstance = new MaterialConfigurator(c.renderer)
    }
    _materialConfigUrl = url
    // 重新应用到所有已加载的 GLB 模型
    const root = c.getGltfModelLoader()?.root
    if (root) {
      for (const model of root.children) {
        await _matCfgInstance.applyFromUrl(url, model)
      }
    }
  },

  /**
   * 设置相机位置和观察目标。
   * @param {{ position?: {x,y,z}, target?: {x,y,z} }} cfg
   */
  applyCameraConfig(cfg) {
    getViewer()?.applyCameraConfig(cfg)
  },

  // ========== 运行时细粒度调参 ==========

  /**
   * 修改单个环境参数并立即生效。
   * key 支持点分路径，如 'envLight.exposure'、'dirLight.intensity'。
   * @param {string} key
   * @param {*} value
   */
  setEnvParam(key, value) {
    const env = getViewer()?.environment
    if (!env?.config) return
    const parts = key.split('.')
    let obj = env.config
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]]
      if (!obj) return
    }
    obj[parts.at(-1)] = value
    env.applyAllParams()
  },


  // ========== 部件操作 ==========

  /**
   * 通过来源 ID 获取模型结构树。
   * @param {string} id - 模型来源 ID（对应 gltfSources[].id）
   * @returns {Object|null} 树结构数据
   */
  getModelTreeById(id) {
    return getViewer()?.getGltfModelLoader()?.getModelTreeById(id) ?? null
  },

  /**
   * 按名称查找部件，返回结构化信息（与 gltf-pick 事件 info 格式一致）。
   * @param {string} name - 部件名称
   * @returns {Object|null} { object, name, path, worldPosition, localPosition, screenPosition, model }
   */
  findPartByName(name) {
    return getViewer()?.getGltfModelLoader()?.findPartByName(name) ?? null
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
      const c = getViewer()
      if (!_matCfgInstance && c) {
        _matCfgInstance = new MaterialConfigurator(c.renderer)
      }
      if (!_matCfgInstance) return false
      const mat = _matCfgInstance.getMaterialByKey(matKey)
      if (!mat || !mat.isMaterial) return false
      part.traverse((c) => { if (c.isMesh) c.material = mat })
      return true
    }
    part.traverse((c) => { if (c.isMesh) c.material = matKey })
    return true
  },

  /**
   * 按 name 高亮部件（半透明 + 轮廓线）并飞行聚焦。
   * @param {string} name - 部件名称
   * @returns {Object|false} 部件信息或 false
   */
  highlightPart(name) {
    const c = getViewer()
    const loader = c?.getGltfModelLoader()
    const info = this.findPartByName(name)
    if (!info || !loader) return false
    loader.highlight(info.object)
    loader.flyToObject(info.object)
    console.log(`已高亮部件 "${name}"`, info)
    return info
  },

  /** 清除当前高亮 */
  clearHighlight() {
    getViewer()?.clearGltfHighlight()
  },

  // ========== 标注管理 ==========

  /**
   * 添加 HTML 标注（位置，元素）。
   * @param {THREE.Vector3} position - 世界坐标
   * @param {HTMLElement} element - DOM 元素
   * @param {Object} [vueApp] - 关联的 Vue app 实例，清理时自动 unmount
   */
  addAnnotation(position, element, vueApp) {
    getViewer()?.addAnnotation(position, element, vueApp)
  },

  /** 清除所有标注 */
  clearAnnotations() {
    getViewer()?.clearAnnotations()
  },



  // ========== 图层控制 ==========

  /** 控制环境贴图是否启用 */
  controlEnvEnabled(enabled) {
    getViewer()?.environment.controlEnvMapEnabled(enabled)
  },

  /** 控制 3D Tiles 图层的显隐 */
  setLayerVisible(sourceId, visible) {
    getViewer()?.setLayerVisible(sourceId, visible)
  },

  /** 切换双相机透视渲染模式 */
  setDualPass(enabled) {
    getViewer()?.setDualPass(enabled)
  },

  /**
   * 切换标签图层的显隐。
   * @param {string} type - 图层组 ID（对应配置中的 type 字段）
   * @param {boolean} visible
   */
  setLabelVisible(type, visible) {
    getViewer()?.getLabelRenderer()?.setGroupVisible(type, visible)
  },

  /**
   * 根据标签 ID 飞行定位到对应 3D 标签。
   * @param {number|string} id - 标签 ID
   * @param {number} [duration=3000] - 飞行动画时长（毫秒）
   */
  flyToLabel(id, duration = 3000) {
    const c = getViewer()
    const loader = c?.getLabelRenderer()
    if (!loader || !c) return
    const target = loader.flyToLabel(id)
    if (target) {
      c.cameraManager.flyTo(target.center, target.distance / 12, duration)
    }
  },
}

export { bimControls }
