import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", { terrain: Cesium.Terrain.fromWorldTerrain(), selectionIndicator: false, infoBox: false });
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 15000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 } });
const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

let handler = null;
const analysisEntities = [];
function getPickPos(wp) { const r = viewer.camera.getPickRay(wp); return r ? scene.globe.pick(r, scene) : null; }
async function analyzeSightLine(from, to) {
  const c1 = Cesium.Cartographic.fromCartesian(from);
  const c2 = Cesium.Cartographic.fromCartesian(to);
  const steps = 50;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(new Cesium.Cartographic(
      Cesium.Math.lerp(c1.longitude, c2.longitude, t),
      Cesium.Math.lerp(c1.latitude, c2.latitude, t)
    ));
  }
  const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, points);
  let blocked = false;
  let blockIdx = -1;
  for (let i = 1; i < sampled.length; i++) {
    const t = i / steps;
    const lineH = Cesium.Math.lerp(c1.height, c2.height, t);
    if (sampled[i].height > lineH) { blocked = true; blockIdx = i; break; }
  }
  const positions = [from, to];
  if (blocked) {
    const bp = Cesium.Cartesian3.fromRadians(sampled[blockIdx].longitude, sampled[blockIdx].latitude, sampled[blockIdx].height);
    analysisEntities.push(viewer.entities.add({ polyline: { positions: [from, bp], width: 3, material: Cesium.Color.GREEN, clampToGround: false } }));
    analysisEntities.push(viewer.entities.add({ polyline: { positions: [bp, to], width: 3, material: Cesium.Color.RED, clampToGround: false } }));
    showStatus("<b>通视分析:</b> 不可见<br>遮挡点位于采样 " + blockIdx + "/" + steps);
  } else {
    analysisEntities.push(viewer.entities.add({ polyline: { positions, width: 3, material: Cesium.Color.GREEN, clampToGround: false } }));
    showStatus("<b>通视分析:</b> 可见<br>采样点: " + steps);
  }
}
function startAnalysis() {
  analysisEntities.forEach(e => viewer.entities.remove(e)); analysisEntities.length = 0;
  if (handler) handler.destroy();
  let fromPos = null;
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction(function(c) {
    const p = getPickPos(c.position); if (!p) return;
    if (!fromPos) { fromPos = p; analysisEntities.push(viewer.entities.add({ position: p, point: { pixelSize: 10, color: Cesium.Color.GREEN, disableDepthTestDistance: Number.POSITIVE_INFINITY } })); showStatus("<b>通视:</b> 已选观察点,点击目标点"); }
    else { analysisEntities.push(viewer.entities.add({ position: p, point: { pixelSize: 10, color: Cesium.Color.RED, disableDepthTestDistance: Number.POSITIVE_INFINITY } })); analyzeSightLine(fromPos, p); handler.destroy(); handler = null; }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  showStatus("<b>通视分析:</b> 点击设定观察点");
}
Sandcastle.addDefaultToolbarButton("开始分析", () => startAnalysis());
Sandcastle.addToolbarButton("清除", () => { analysisEntities.forEach(e => viewer.entities.remove(e)); analysisEntities.length = 0; showStatus("<b>已清除</b>"); });
showStatus("<b>通视分析</b><br>点击开始分析");
Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll(); analysisEntities.length = 0;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};