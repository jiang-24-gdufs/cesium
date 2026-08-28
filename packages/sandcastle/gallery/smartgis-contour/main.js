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

showStatus("<b>等高线分析</b><br>核心概念: contour line rendering<br>核心 API: elevation shading");

Sandcastle.addDefaultToolbarButton("演示 等高线分析", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>等高线分析 - 运行中</b><br>核心: contour line rendering");
  
  const material = Cesium.Material.fromType("ElevationContour", {
    color: Cesium.Color.YELLOW,
    spacing: 100.0,
    width: 2.0,
  });
  scene.globe.material = material;
  showStatus("<b>等高线分析</b><br>等高线间距: 100m<br>颜色: 黄色");
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  scene.globe.material = undefined;
  
  
  
  showStatus("<b>等高线分析</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  scene.globe.material = undefined;
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
