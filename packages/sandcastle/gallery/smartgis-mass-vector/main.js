import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", { terrain: Cesium.Terrain.fromWorldTerrain() });
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 50000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 } });
const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

let primitiveCollection = null;
function generateMassPoints(count) {
  if (primitiveCollection) scene.primitives.remove(primitiveCollection);
  primitiveCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
  for (let i = 0; i < count; i++) {
    primitiveCollection.add({
      position: Cesium.Cartesian3.fromDegrees(113.1+Math.random()*0.4, 23.0+Math.random()*0.2, 0),
      pixelSize: 4,
      color: Cesium.Color.fromRandom({alpha:0.8}),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
  showStatus("<b>海量矢量:</b> " + count + " 个点<br>渲染方式: PointPrimitiveCollection");
}
Sandcastle.addDefaultToolbarButton("10,000 个点", () => generateMassPoints(10000));
Sandcastle.addToolbarButton("50,000 个点", () => generateMassPoints(50000));
Sandcastle.addToolbarButton("100,000 个点", () => generateMassPoints(100000));
Sandcastle.addToolbarButton("清除", () => { if (primitiveCollection) { scene.primitives.remove(primitiveCollection); primitiveCollection = null; } showStatus("<b>已清除</b>"); });
showStatus("<b>新海量矢量</b><br>选择数据量");
Sandcastle.reset = function () {
  if (primitiveCollection) scene.primitives.remove(primitiveCollection);
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};