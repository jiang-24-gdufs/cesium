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

showStatus("<b>向量场特效</b><br>难度: D3<br>核心: vector field visualization<br>API: Particle + data texture");


const lines = [];
Sandcastle.addDefaultToolbarButton("生成数据", function () {
  viewer.entities.removeAll();
  for (let i = 0; i < 50; i++) {
    const startLon = 113.0 + Math.random() * 0.6;
    const startLat = 22.8 + Math.random() * 0.6;
    const endLon = 113.0 + Math.random() * 0.6;
    const endLat = 22.8 + Math.random() * 0.6;
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          startLon, startLat, 0, endLon, endLat, Math.random() * 5000,
        ]),
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromRandom({ alpha: 0.8 }),
        }),
      },
    });
  }
  showStatus("<b>向量场特效</b><br>生成: 50 条线");
});
Sandcastle.addToolbarButton("清除", function () {
  viewer.entities.removeAll();
  showStatus("<b>已清除</b>");
});


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
