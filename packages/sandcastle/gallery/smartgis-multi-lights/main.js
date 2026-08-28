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

showStatus("<b>多光源</b><br>核心概念: multiple point/spot lights in scene<br>核心 API: Scene lighting");

Sandcastle.addDefaultToolbarButton("演示 多光源", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>多光源 - 运行中</b><br>核心: multiple point/spot lights in scene");
  
  scene.globe.enableLighting = true;
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 500),
    ellipsoid: { radii: new Cesium.Cartesian3(50, 50, 50), material: Cesium.Color.YELLOW },
  });
  showStatus("<b>多光源</b><br>场景光照已启用<br>光源标记已添加");
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  
  showStatus("<b>多光源</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
