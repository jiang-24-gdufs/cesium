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

showStatus("<b>3DTiles 特效</b><br>难度: D3<br>核心: custom shader effects<br>API: CustomShader");


Sandcastle.addDefaultToolbarButton("演示 3DTiles 特效", function () {
  viewer.entities.removeAll();
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200),
    point: { pixelSize: 12, color: Cesium.Color.CYAN, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: { text: "3DTiles 特效", font: "14px sans-serif", showBackground: true, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  showStatus("<b>3DTiles 特效 - 运行中</b>");
});
Sandcastle.addToolbarButton("清除", function () { viewer.entities.removeAll(); showStatus("<b>已清除</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
