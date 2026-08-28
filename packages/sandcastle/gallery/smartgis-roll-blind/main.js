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

showStatus("<b>卷帘对比</b><br>核心概念: swipe/roller blind comparison<br>核心 API: ImageryLayer.splitDirection");

Sandcastle.addDefaultToolbarButton("演示 卷帘对比", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>卷帘对比 - 运行中</b><br>核心: swipe/roller blind comparison");
  
  const layer1 = viewer.imageryLayers.get(0);
  if (layer1) layer1.splitDirection = Cesium.SplitDirection.LEFT;
  const layer2 = viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })
  );
  layer2.splitDirection = Cesium.SplitDirection.RIGHT;
  viewer.scene.splitPosition = 0.5;
  showStatus("<b>卷帘对比</b><br>左: 默认底图<br>右: OpenStreetMap");
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  viewer.scene.splitPosition = 0.5;
  showStatus("<b>卷帘对比</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
