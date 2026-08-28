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

showStatus("<b>水质污染模型</b><br>难度: D4<br>核心: advection-diffusion<br>API: scalar field + texture");


Sandcastle.addDefaultToolbarButton("启动模拟", function () {
  viewer.entities.removeAll();
  let height = 5;
  const entity = viewer.entities.add({
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(113.28, 23.08, 113.32, 23.12),
      material: Cesium.Color.BLUE.withAlpha(0.5),
      height: new Cesium.CallbackProperty(function () { return height; }, false),
    },
  });
  setInterval(function () { height = 5 + Math.sin(Date.now() / 500) * 3; }, 50);
  showStatus("<b>水质污染模型</b><br>模拟运行中");
});
Sandcastle.addToolbarButton("停止", function () { viewer.entities.removeAll(); showStatus("<b>已停止</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
