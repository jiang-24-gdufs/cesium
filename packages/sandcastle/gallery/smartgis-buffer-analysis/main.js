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

showStatus("<b>缓冲分析</b><br>核心概念: buffer zone generation<br>核心 API: ellipsoid sampling");

Sandcastle.addDefaultToolbarButton("演示 缓冲分析", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>缓冲分析 - 运行中</b><br>核心: buffer zone generation");
  
  const center = Cesium.Cartesian3.fromDegrees(113.3, 23.1, 0);
  const bufferEntity = viewer.entities.add({
    position: center,
    ellipse: {
      semiMajorAxis: 3000,
      semiMinorAxis: 3000,
      material: Cesium.Color.YELLOW.withAlpha(0.2),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    point: { pixelSize: 8, color: Cesium.Color.RED, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  activeEntities.push(bufferEntity);
  showStatus("<b>缓冲分析</b><br>中心: 113.3, 23.1<br>缓冲半径: 3000m");
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  
  showStatus("<b>缓冲分析</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
