/**
 * 环境配置（天空/HDR/光照/曝光）
 *
 * 使用方式：
 *   import envConfig from './config/env-config.js'
 *   bimControls.applyEnvConfig(envConfig)
 */
export default {
  envMapEnabled: true,

  bloom: {
    enabled: false,
    strength: 0.1,
    radius: 0,
    threshold: 0,
  },

  dirLight: {
    intensity: 1.5,
    yaw: 45,
    pitch: 50,
    color: '#ffffff',
    showPosHelper: false,
    showDirHelper: false,
    shadow: {
      enabled: true,
      resolution: 4096,
      range: 62,
      offsetX: 0,
      offsetY: 0,
      bias: -0.001,
    },
  },

  envLight: {
    intensity: 1,
    bgIntensity: 1.5,
    exposure: 1.3,
  },
}
