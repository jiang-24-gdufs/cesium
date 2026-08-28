import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

let handler = null;
let activeEntities = [];

showStatus("<b>面裁剪</b><br>核心概念: clipping planes<br>核心 API: scene.globe.clippingPlanes");

Sandcastle.addDefaultToolbarButton("演示 面裁剪", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>面裁剪 - 运行中</b><br>核心: clipping planes");
  
  const e = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 100),
    point: { pixelSize: 12, color: Cesium.Color.CYAN, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: { text: "面裁剪", font: "14px sans-serif", showBackground: true, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  activeEntities.push(e);
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  
  showStatus("<b>面裁剪</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
