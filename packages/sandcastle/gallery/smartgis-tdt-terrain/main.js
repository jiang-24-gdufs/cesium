import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 30000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

showStatus("<b>天地图地形</b><br>天地图地形服务需要 Token<br>此处使用 Cesium World Terrain 替代演示<br><br>接入方式:<br>CesiumTerrainProvider + 天地图地形服务 URL");

Sandcastle.addDefaultToolbarButton("Cesium Terrain (替代)", () => {
  viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }));
  showStatus("<b>Cesium World Terrain</b><br>(替代天地图地形)");
});
Sandcastle.addToolbarButton("无地形", () => {
  viewer.scene.setTerrain(new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()));
  showStatus("<b>无地形</b>");
});
Sandcastle.addToolbarButton("接入说明", () => {
  showStatus("<b>天地图地形接入</b><br><br>URL: https://t{s}.tianditu.gov.cn/...<br>Provider: CesiumTerrainProvider<br>坐标系: CGCS2000/EPSG:4490<br>Token: 需申请天地图开发者 Key");
});

Sandcastle.reset = function () {
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
