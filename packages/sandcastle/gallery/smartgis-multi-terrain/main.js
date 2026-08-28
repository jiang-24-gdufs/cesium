import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }),
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;
scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 12000),
  orientation: { heading: Cesium.Math.toRadians(-20), pitch: Cesium.Math.toRadians(-15), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

Sandcastle.addDefaultToolbarButton("Cesium World Terrain", () => {
  viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true, requestWaterMask: true }));
  showStatus("<b>Cesium World Terrain</b><br>法线: 有 | 水面: 有");
});
Sandcastle.addToolbarButton("ArcGIS Terrain", () => {
  viewer.scene.setTerrain(new Cesium.Terrain(Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer")));
  showStatus("<b>ArcGIS WorldElevation3D</b>");
});
Sandcastle.addToolbarButton("无地形", () => {
  viewer.scene.setTerrain(new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()));
  showStatus("<b>EllipsoidTerrainProvider</b> (平坦)");
});
Sandcastle.addToolbarButton("夸张 x3", () => { scene.globe.terrainExaggeration = 3.0; showStatus("夸张: x3"); });
Sandcastle.addToolbarButton("夸张 x1", () => { scene.globe.terrainExaggeration = 1.0; showStatus("夸张: x1"); });
showStatus("<b>多地形管理</b><br>选择地形源");

Sandcastle.reset = function () {
  scene.globe.terrainExaggeration = 1.0;
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
