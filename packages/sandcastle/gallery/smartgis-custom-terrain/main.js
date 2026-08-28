import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 20000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

Sandcastle.addDefaultToolbarButton("Cesium Ion Terrain", () => {
  viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }));
  showStatus("<b>Cesium Ion Terrain</b>");
});
Sandcastle.addToolbarButton("无地形", () => {
  viewer.scene.setTerrain(new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()));
  showStatus("<b>EllipsoidTerrainProvider</b>");
});
Sandcastle.addToolbarButton("自定义接入说明", () => {
  showStatus("<b>自定义地形接入模板</b><br><br>CesiumTerrainProvider({<br>&nbsp;&nbsp;url: \"https://your-server/terrain\",<br>&nbsp;&nbsp;requestVertexNormals: true<br>})<br><br>格式: quantized-mesh / heightmap<br>四叉树 LOD 自动管理");
});

showStatus("<b>自定义地形</b><br>演示地形 Provider 的配置方式");
Sandcastle.reset = function () {
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
