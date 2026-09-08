import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import { GLTFExtensionsPlugin, ReorientationPlugin } from '3d-tiles-renderer/three/plugins'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { disposeObject3D } from './common/three-dispose'
import { EnvironmentManager } from './common/environment'
import { CameraManager } from './common/camera'
import { GltfModelLoader } from './GltfModelLoader'

// ========== KTX2 压缩贴图支持 ==========

/**
 * Basis Universal（KTX2）转码器资源路径。
 *
 * three 的 KTX2Loader 需要 basis_transcoder.{js,wasm}，这里从
 * node_modules/three/examples/jsm/libs/basis 拷贝到 public/libs/basis
 * 后在运行时按 URL 加载，避免打包器改写模块内相对路径。
 */
const KTX2_TRANSCODER_PATH = './libs/basis/'

/**
 * GLTF loader 插件：补齐 cesiumlab（osgb2tiles 等工具）3D Tiles 的贴图解码。
 *
 * 这类 b3dm 内嵌的 glTF 把压缩贴图写成 image/ktx2 图片并被 texture.source 直接引用，
 * 却不带 KHR_texture_basisu 扩展；three 的 GLTFLoader 默认把这类图片当作普通图片解码，
 * 解码失败后贴图为 null，模型就会退化成无贴图的“白膜”。
 *
 * 该插件在 GLTFLoader 解析 texture 依赖时被优先调用，凡是图片为 image/ktx2 的贴图
 * 一律交给 KTX2Loader 解码（与 KHR_texture_basisu 官方路径走同一入口 loadTextureImage），
 * 其余普通贴图返回 null 走 three 默认逻辑，不影响 JPEG/PNG 数据源。
 */
class RawKtx2TexturePlugin {
  constructor(parser, ktx2Loader) {
    this.parser = parser
    this.ktx2Loader = ktx2Loader
    this.name = 'RawKtx2TexturePlugin'
  }

  loadTexture(textureIndex) {
    const json = this.parser.json
    const textureDef = json.textures?.[textureIndex]
    const sourceIndex = textureDef?.source
    if (sourceIndex === undefined || sourceIndex === null) return null

    const imageDef = json.images?.[sourceIndex]
    if (!imageDef) return null

    const isKtx2 =
      imageDef.mimeType === 'image/ktx2' ||
      (typeof imageDef.uri === 'string' && /\.ktx2($|\?)/i.test(imageDef.uri))
    if (!isKtx2) return null

    return this.parser.loadTextureImage(textureIndex, sourceIndex, this.ktx2Loader)
  }
}

// ========== 控制器 ==========

/**
 * 3D Tiles 查看器控制器。
 *
 * 统一管理场景环境（天空/光照）、3D Tiles 瓦片集加载、相机/飞行/聚焦、
 * 双相机渲染循环、视口自适应和生命周期。
 */
export class TilesViewerController {
  // ---- Three.js 核心对象 ----
  scene = new THREE.Scene()
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  tilesetRoot = new THREE.Group()
  gltfModelLoader
  resizeObserver = new ResizeObserver(() => this.handleResize())

  // ---- 相机管理 ----
  cameraManager

  // ---- 环境管理 ----
  environment

  // ---- 3D Tiles 状态 ----
  tilesRenderers = []
  tilesetSource = null
  tilesetReady = false

  // ---- 双相机透视：Layer 0 外壳（3D Tiles）/ Layer 1 内部（GLB） ----
  camInner = new THREE.PerspectiveCamera(45, 1, 1, 1e7)
  rtInner = new THREE.WebGLRenderTarget(1, 1)
  sceneOverlay = new THREE.Scene()
  camOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10)

  // ---- 其他状态 ----
  container = null
  /** 场景范围（root 加载后由包围球得出），供相机聚焦与点位贴地回退 */
  sceneBounds = new THREE.Box3()
  animationFrameId = 0
  /** 是否启用双相机透视渲染（默认开启：GLB 透明叠加在 3D Tiles 外壳上） */
  dualPass = true

  /**
   * @param {Object} [callbacks={}]
   * @param {Function} [callbacks.onGltfPick] - 点击 GLB 模型部件时的回调
   */
  constructor(callbacks = {}) {
    // 环境管理器
    this.environment = new EnvironmentManager(this.scene, this.renderer)

    this.tilesetRoot.name = 'tileset-root'
    this.scene.add(this.tilesetRoot)

    // 相机管理器：统一管理相机、轨道控制、飞行、聚焦
    this.cameraManager = new CameraManager(this.renderer.domElement)

    // GLTF/GLB 模型加载器：维护独立的 gltf-root 容器组
    this.gltfModelLoader = new GltfModelLoader({
      scene: this.scene,
      renderer: this.renderer,
      getEcefToSceneTransform: () => {
        const first = this.tilesRenderers[0]
        if (!first) return null
        const group = first.group
        group.updateMatrixWorld(true)
        return group.matrixWorld.clone()
      },
      whenTerrainReady: () => this.whenTerrainReady(),
      onPick: (info, position) => {
        callbacks.onGltfPick?.(info, position)
      },
      onRequestFitCamera: () => {
        // 无 3D Tiles 时，GLB 加载完自动聚焦到模型上
        if (this.tilesetReady) return
        const box = new THREE.Box3().setFromObject(this.gltfModelLoader.root)
        if (!box.isEmpty()) {
          this.cameraManager.fitToBox(box)
        }
      },
      onFlyTo: (target, distance, duration) => {
        // 将计算好的观察距离转换为 flyTo 的 markerScale 参数
        this.cameraManager.flyTo(target, distance / 12, duration)
      },
    })

    // ---- 双相机透视基础设施 ----
    this.cameraManager.camera.layers.set(0)
    this.camInner.layers.set(1)
    this.rtInner.texture.colorSpace = THREE.SRGBColorSpace

    // 全屏面片 + 正交场景：把内部渲染纹理叠加到屏幕顶层
    const quadMat = new THREE.MeshBasicMaterial({
      map: this.rtInner.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat)
    this.sceneOverlay.add(quad)

    // 启用 GLB 部件点击拾取
    this.gltfModelLoader.enablePicking(this.cameraManager.camera, this.renderer.domElement)

    this.renderer.setPixelRatio(this.getPreferredPixelRatio())
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.autoClear = false // 双透模式手动控制清屏

    // KTX2（Basis Universal）纹理解码器：cesiumlab 等产出的 3D Tiles
    // b3dm 贴图为 image/ktx2，无解码器时贴图加载失败、模型呈白膜。
    // 共享给所有瓦片渲染器，由 clearTileset/destroy 管理生命周期。
    this.ktx2Loader = new KTX2Loader()
      .setTranscoderPath(KTX2_TRANSCODER_PATH)
      .setWorkerLimit(2)
      .detectSupport(this.renderer)

    // 画布初始透明，等环境配置就绪后淡入，避免黑屏
    this.renderer.domElement.style.opacity = '0'
    this.renderer.domElement.style.transition = 'opacity 0.6s ease'
  }

  // ========== 公共方法 ==========

  /** 挂载 canvas 到容器，构建场景环境（天空+光照），启动渲染循环 */
  async mount(container) {
    this.container = container
    this.container.innerHTML = ''
    this.container.appendChild(this.renderer.domElement)

    if (container.style.position === '') {
      container.style.position = 'relative'
    }

    this.resizeObserver.observe(container)
    this.handleResize()

    // 先构建场景环境（天空、光照），避免黑屏
    await this.applyEnvConfig()

    // 环境就绪，画布淡入
    this.renderer.domElement.style.opacity = '1'

    this.startLoop()
  }

  /** 加载 3D Tiles 场景（支持多个数据源） */
  async loadScene(sources) {
    if (!this.container) {
      throw new Error('Three.js 容器尚未挂载。')
    }

    this.sceneBounds.makeEmpty()
    this.clearTileset()

    // ---- 加载 3D Tiles 作为外壳（Layer 0）----
    const validSources = sources.filter((item) => item.url)
    if (validSources.length === 0) {
      throw new Error('未提供可加载的 3DTiles 数据源。')
    }

    this.tilesetSource = validSources[0]
    let isFirstTileSet = true
    const boundingSphere = new THREE.Sphere()

    for (const source of validSources) {
      const tilesRenderer = new TilesRenderer(source.url)
      tilesRenderer.setCamera(this.cameraManager.camera)
      tilesRenderer.setResolutionFromRenderer(this.cameraManager.camera, this.renderer)

      // 坐标 recenter
      tilesRenderer.registerPlugin(new ReorientationPlugin({ up: '+z', recenter: true }))

      // KTX2 压缩贴图解码：把带 KTX2Loader 的 GLTF loader 挂到瓦片渲染器上，
      // 并注册自定义插件解码 cesiumlab 内嵌 image/ktx2（无 basisu 扩展）的贴图
      tilesRenderer.registerPlugin(
        new GLTFExtensionsPlugin({
          metadata: false,
          rtc: false,
          ktxLoader: this.ktx2Loader,
          autoDispose: false,
          plugins: [(parser) => new RawKtx2TexturePlugin(parser, this.ktx2Loader)],
        }),
      )

      // 瓦片网格分配到 Layer 0（外壳层）
      tilesRenderer.addEventListener('load-model', ({ scene }) => {
        scene.traverse((obj) => {
          if (obj.isMesh) obj.layers.set(0)
        })
      })

      // 适配大场景 + 错误处理
      tilesRenderer.addEventListener('load-tile-set', () => {
        if (tilesRenderer.getBoundingSphere(boundingSphere)) {
          const radius = boundingSphere.radius
          const center = new THREE.Vector3(0, 0, 0)
          this.sceneBounds.setFromCenterAndSize(
            center,
            new THREE.Vector3(radius * 2, radius * 2, radius * 2),
          )

          const cam = this.cameraManager.camera
          cam.near = Math.max(radius * 0.0001, 0.01)
          cam.far = radius * 10
          cam.updateProjectionMatrix()

          this.cameraManager.controls.minDistance = radius * 0.01
          this.cameraManager.controls.maxDistance = radius * 3
          this.cameraManager.controls.update()
        }

        this.tilesetReady = true

        // 只在首次 tileset 加载完成时自动定位相机
        if (!isFirstTileSet) return
        isFirstTileSet = false

        // 优先使用配置文件中的相机参数，未配置则自动聚焦到场景包围盒
        const cameraCfg = window.BizConfig?.gltfGeoConfig?.camera
        if (cameraCfg) {
          this.applyCameraConfig(cameraCfg)
        } else if (!this.cameraManager.isViewSettled() && !this.sceneBounds.isEmpty()) {
          const box = new THREE.Box3().copy(this.sceneBounds)
          const gltfBox = new THREE.Box3().setFromObject(this.gltfModelLoader.root)
          if (!gltfBox.isEmpty()) box.union(gltfBox)
          this.cameraManager.fitToBox(box)
        }
      })

      tilesRenderer.addEventListener('load-tile-error', (e) => {
        console.warn('[TilesViewerController] 瓦片加载错误:', e)
      })

      this.tilesetRoot.add(tilesRenderer.group)
      this.tilesRenderers.push(tilesRenderer)
    }
  }

  /** 获取 GLTF 模型加载器实例 */
  getGltfModelLoader() {
    return this.gltfModelLoader
  }

  /** 清除 GLB 部件高亮 */
  clearGltfHighlight() {
    this.gltfModelLoader.clearHighlight()
  }

  // ========== 环境配置 ==========

  /** 加载 env-config.json 并应用全部环境配置 */
  async applyEnvConfig() {
    try {
      await this.environment.applyFromUrl('./config/env-config.json')
    } catch (e) {
      console.warn('[loadScene] 环境配置加载失败，使用默认参数。', e)
    }
  }

  // ========== 销毁 ==========

  /** 销毁控制器，释放所有 GPU 资源与 DOM 监听 */
  destroy() {
    cancelAnimationFrame(this.animationFrameId)
    this.resizeObserver.disconnect()
    this.gltfModelLoader.disablePicking()
    this.clearTileset()
    this.cameraManager.dispose()
    this.environment.dispose()
    this.rtInner.dispose()
    this.ktx2Loader?.dispose()
    this.ktx2Loader = null

    disposeObject3D(this.scene)
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.container?.replaceChildren()
    this.container = null
  }

  // ========== 渲染循环 ==========

  startLoop() {
    const renderFrame = () => {
      this.animationFrameId = window.requestAnimationFrame(renderFrame)

      if (this.cameraManager.tickFlyAnimation()) {
        // 飞行动画进行中，跳过 controls.update()
      } else {
        this.cameraManager.controls.update()
      }

      const cam = this.cameraManager.camera
      cam.updateMatrixWorld()
      for (const tr of this.tilesRenderers) {
        if (tr.group.visible) tr.update()
      }

      if (this.dualPass) {
        // ---- 双相机透视：三步合成 ----
        this.camInner.copy(cam)
        this.camInner.layers.set(1)

        // 临时禁用背景和雾
        const savedBackground = this.scene.background
        const savedFog = this.scene.fog
        this.scene.background = null
        this.scene.fog = null

        // 1. 渲染 GLB 到 rtInner（透明背景）
        this.renderer.setRenderTarget(this.rtInner)
        this.renderer.setClearColor(0x000000, 0)
        this.renderer.clear(true, true, false)
        this.renderer.render(this.scene, this.camInner)

        // 恢复背景和雾效
        this.scene.background = savedBackground
        this.scene.fog = savedFog

        // 2. 渲染外壳到屏幕（Layer 0 的 3D Tiles + 天空）
        this.renderer.setRenderTarget(null)
        this.renderer.clear(true, true, false)
        this.renderer.render(this.scene, cam)

        // 3. 叠加 GLB（含轮廓）：只清深度、保留外壳颜色
        this.renderer.clearDepth()
        this.renderer.render(this.sceneOverlay, this.camOrtho)
      } else {
        // ---- 单层模式：一步渲染 ----
        this.renderer.render(this.scene, cam)
      }
    }

    renderFrame()
  }

  // ========== 3D Tiles 管理 ==========

  /** 释放并移除所有瓦片渲染器 */
  clearTileset() {
    for (const tr of this.tilesRenderers) {
      tr.deleteCamera(this.cameraManager.camera)
      this.tilesetRoot.remove(tr.group)
      tr.dispose()
    }
    this.tilesRenderers = []
    this.tilesetSource = null
    this.tilesetReady = false
  }

  // ========== 地形状态 ==========

  /**
   * 等待地形瓦片集根节点就绪。
   * 每 100ms 轮询检测，默认 30s 超时。
   */
  whenTerrainReady(timeout = 30000) {
    if (this.tilesRenderers.length === 0) {
      console.warn('[loadGltf] 未加载地形瓦片集，无法进行地理配准。')
      return Promise.resolve()
    }

    const isReady = () =>
      this.tilesetReady || this.tilesRenderers.some((tr) => Boolean(tr.root))
    if (isReady()) return Promise.resolve()

    return new Promise((resolve) => {
      const timerId = window.setInterval(() => {
        if (isReady()) {
          window.clearInterval(timerId)
          resolve()
        }
      }, 100)
      window.setTimeout(() => {
        window.clearInterval(timerId)
        resolve()
      }, timeout)
    })
  }

  // ========== 视口自适应 ==========

  handleResize() {
    if (!this.container) return

    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)

    this.cameraManager.resize(width, height)
    this.renderer.setSize(width, height, false)
    this.renderer.setPixelRatio(this.getPreferredPixelRatio())

    // 窗口变化时重新同步瓦片 SSE 分辨率
    for (const tr of this.tilesRenderers) {
      tr.setResolutionFromRenderer(this.cameraManager.camera, this.renderer)
    }

    // 双透模式下同步内相机与渲染目标尺寸
    if (this.dualPass) {
      this.camInner.aspect = width / height
      this.camInner.updateProjectionMatrix()
      this.rtInner.setSize(width, height)
    }
  }

  /** 获取相机管理器实例 */
  getCameraManager() {
    return this.cameraManager
  }

  /**
   * 按配置设置相机位置和观察目标。
   * position 和 target 均为可选，缺省项保持当前值。
   * @param {Object} cfg
   * @param {{ x?: number, y?: number, z?: number }} [cfg.position]
   * @param {{ x?: number, y?: number, z?: number }} [cfg.target]
   */
  applyCameraConfig(cfg) {
    const cam = this.cameraManager.camera
    const controls = this.cameraManager.controls

    if (cfg.position) {
      cam.position.set(
        cfg.position.x ?? cam.position.x,
        cfg.position.y ?? cam.position.y,
        cfg.position.z ?? cam.position.z,
      )
    }
    if (cfg.target) {
      controls.target.set(
        cfg.target.x ?? controls.target.x,
        cfg.target.y ?? controls.target.y,
        cfg.target.z ?? controls.target.z,
      )
    }

    controls.update()
    this.cameraManager.hasSettledView = true
  }

  /** 按真实设备像素比渲染，高分屏上限 2x 保护性能 */
  getPreferredPixelRatio() {
    return THREE.MathUtils.clamp(window.devicePixelRatio || 1, 1, 2)
  }
}
