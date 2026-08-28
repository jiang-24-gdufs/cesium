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

showStatus("<b>雷达分析</b><br>难度: D4<br>核心: radar frustum + occlusion<br>API: FrustumGeometry + Scene.pick");


Sandcastle.addDefaultToolbarButton("创建雷达", function () {
  viewer.entities.removeAll();
  const radarCenter = Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200);
  viewer.entities.add({
    position: radarCenter,
    ellipsoid: {
      radii: new Cesium.Cartesian3(5000, 5000, 5000),
      material: Cesium.Color.GREEN.withAlpha(0.15),
      outline: true, outlineColor: Cesium.Color.GREEN.withAlpha(0.5),
      slicePartitions: 24, stackPartitions: 12,
    },
  });
  viewer.entities.add({
    position: radarCenter,
    point: { pixelSize: 10, color: Cesium.Color.RED, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  showStatus("<b>雷达分析</b><br>半径: 5000m<br>位置: 113.3°, 23.1°");
});
Sandcastle.addToolbarButton("清除", function () { viewer.entities.removeAll(); showStatus("<b>已清除</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
