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

showStatus("<b>军事标绘</b><br>难度: D4<br>核心: parameterized military symbols<br>API: Entity + CallbackProperty");


Sandcastle.addDefaultToolbarButton("添加标绘", function () {
  viewer.entities.removeAll();
  viewer.entities.add({
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray([113.25,23.05, 113.35,23.05, 113.35,23.15, 113.25,23.15]),
      material: Cesium.Color.RED.withAlpha(0.3),
      outline: true, outlineColor: Cesium.Color.RED,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  });
  viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray([113.28,23.08, 113.32,23.12, 113.30,23.10]),
      width: 3, material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.YELLOW),
      clampToGround: true,
    },
  });
  showStatus("<b>军事标绘</b><br>已添加标绘元素");
});
Sandcastle.addToolbarButton("清除", function () { viewer.entities.removeAll(); showStatus("<b>已清除</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
