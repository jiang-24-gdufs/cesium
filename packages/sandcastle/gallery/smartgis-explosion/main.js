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

showStatus("<b>炸开</b><br>难度: D4<br>核心: exploded view<br>API: node translation");


Sandcastle.addDefaultToolbarButton("演示", function () {
  viewer.entities.removeAll();
  const heights = [0, 50, 100, 150, 200];
  heights.forEach(function (h, i) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(113.3 + i * 0.005, 23.1, h + 25),
      box: {
        dimensions: new Cesium.Cartesian3(80, 80, 50),
        material: Cesium.Color.fromHsl(i * 0.15, 0.7, 0.5, 0.7),
        outline: true, outlineColor: Cesium.Color.WHITE,
      },
    });
  });
  showStatus("<b>炸开</b><br>楼层分离展示: " + heights.length + " 层");
});
Sandcastle.addToolbarButton("清除", function () { viewer.entities.removeAll(); showStatus("<b>已清除</b>"); });


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
