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

showStatus("<b>HDR(类虚幻引擎)</b><br>难度: D3<br>核心: HDR/tone mapping<br>API: Scene.highDynamicRange");


Sandcastle.addDefaultToolbarButton("启用 HDR", function () {
  scene.highDynamicRange = true;
  scene.globe.enableLighting = true;
  showStatus("<b>HDR 已启用</b><br>scene.highDynamicRange = true<br>色调映射: 自动");
});
Sandcastle.addToolbarButton("关闭 HDR", function () {
  scene.highDynamicRange = false;
  showStatus("<b>HDR 已关闭</b>");
});
Sandcastle.addToolbarButton("切换光照", function () {
  scene.globe.enableLighting = !scene.globe.enableLighting;
  showStatus("光照: " + (scene.globe.enableLighting ? "开" : "关"));
});


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  scene.highDynamicRange = false; scene.globe.enableLighting = false;
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
