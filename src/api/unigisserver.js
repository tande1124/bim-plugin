
import callWebApi from '@plugin-ins/libs/call-web-api';
import Setting from '@core/setting'

// URL转码
function encode(param) {
  return encodeURIComponent(_.trim(param))
}


/**
 * 通过场景id获取BIM场景所有节点，包括场景以及图层组节点和图层节点集合
 * @param {string}  id - 工作空间id
 */
export function GisBimSceneInfoController_BimSceneGetAllNodes(id, _extendConfig) {
  return callWebApi({
    url: `${Setting.apiBaseURL.UniGISServer.ServerService}/gis/bim-scene-info/getSceneAllNodes/${encode(id)}`,
    method: "get",
  }, _extendConfig);
}

