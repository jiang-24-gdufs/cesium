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

showStatus("<b>淹没分析(贴地)</b><br>核心概念: ground-clamped flood<br>核心 API: GroundPrimitive");

Sandcastle.addDefaultToolbarButton("演示 淹没分析(贴地)", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>淹没分析(贴地) - 运行中</b><br>核心: ground-clamped flood");
  
  let waterHeight = 0;
  const maxHeight = 500;
  const waterEntity = viewer.entities.add({
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(113.25, 23.05, 113.35, 23.15),
      material: Cesium.Color.BLUE.withAlpha(0.4),
      height: new Cesium.CallbackProperty(function () { return waterHeight; }, false),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
    },
  });
  activeEntities.push(waterEntity);
  const interval = setInterval(function () {
    waterHeight += 5;
    if (waterHeight >= maxHeight) clearInterval(interval);
    showStatus("<b>淹没分析</b><br>水面高度: " + waterHeight.toFixed(0) + "m / " + maxHeight + "m");
  }, 100);
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  
  showStatus("<b>淹没分析(贴地)</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
