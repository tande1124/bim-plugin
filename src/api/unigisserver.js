
import callWebApi from '@plugin-ins/libs/call-web-api';
import Setting from '@core/setting'

// URL转码
function encode(param) {
  return encodeURIComponent(_.trim(param))
}


/**
 * 通过场景编码获取BIM场景所有节点，包括场景以及图层组节点和图层节点集合
 * @param {string}  code - 场景编码
 */
export function GisBimSceneInfoController_BimSceneGetAllNodesByCode(code, _extendConfig){
    return callWebApi({
        url: `${Setting.apiBaseURL.UniGISServer.ServerService}/gis/bim-scene-info/getSceneAllNodes/by-code/${encode(code)}`,
        method: "get",
    }, _extendConfig);
}
