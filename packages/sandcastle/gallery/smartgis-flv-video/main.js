import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;max-width:300px;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

showStatus("<b>播放 FLV 视频流</b><br>难度: D4<br>核心: FLV decoding + texture<br>API: flv.js + HTMLVideoElement");


Sandcastle.addDefaultToolbarButton("加载视频", function () {
  viewer.entities.removeAll();
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200),
    plane: {
      plane: new Cesium.Plane(Cesium.Cartesian3.UNIT_Z, 0),
      dimensions: new Cesium.Cartesian2(400, 225),
      material: Cesium.Color.DARKGRAY,
    },
  });
  showStatus("<b>播放 FLV 视频流</b><br>视频占位面已创建<br>实际视频需配置视频源 URL");
});
Sandcastle.addToolbarButton("清除", function () { viewer.entities.removeAll(); showStatus("<b>已清除</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
