import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", { terrain: Cesium.Terrain.fromWorldTerrain(), selectionIndicator: false, infoBox: false });
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 30000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 } });
const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

const profileCanvas = document.createElement("canvas");
profileCanvas.width = 400; profileCanvas.height = 200;
profileCanvas.style.cssText = "position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.8);border:1px solid #555;border-radius:4px;z-index:10;";
document.getElementById("cesiumContainer").appendChild(profileCanvas);
let handler = null;
const pathPoints = [];
function getPickPos(wp) { const r = viewer.camera.getPickRay(wp); return r ? scene.globe.pick(r, scene) : null; }
function drawProfile(heights, distances) {
  const ctx = profileCanvas.getContext("2d");
  ctx.clearRect(0, 0, 400, 200);
  ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0, 0, 400, 200);
  const maxH = Math.max(...heights); const minH = Math.min(...heights);
  const maxD = distances[distances.length - 1];
  ctx.strokeStyle = "#0f0"; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < heights.length; i++) {
    const x = 40 + (distances[i] / maxD) * 340;
    const y = 180 - ((heights[i] - minH) / (maxH - minH + 1)) * 160;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
  ctx.fillText(maxH.toFixed(0) + "m", 2, 20);
  ctx.fillText(minH.toFixed(0) + "m", 2, 180);
  ctx.fillText("0", 40, 195); ctx.fillText((maxD/1000).toFixed(1) + "km", 340, 195);
}
async function analyzeProfile() {
  if (pathPoints.length < 2) return;
  const samples = [];
  const steps = 100;
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const c1 = Cesium.Cartographic.fromCartesian(pathPoints[i]);
    const c2 = Cesium.Cartographic.fromCartesian(pathPoints[i+1]);
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      samples.push(new Cesium.Cartographic(Cesium.Math.lerp(c1.longitude, c2.longitude, t), Cesium.Math.lerp(c1.latitude, c2.latitude, t)));
    }
  }
  showStatus("<b>采样中...</b> " + samples.length + " 个点");
  const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, samples);
  const heights = sampled.map(s => s.height);
  const distances = [0];
  for (let i = 1; i < sampled.length; i++) {
    const geo = new Cesium.EllipsoidGeodesic(sampled[i-1], sampled[i]);
    distances.push(distances[i-1] + geo.surfaceDistance);
  }
  drawProfile(heights, distances);
  showStatus("<b>剖面分析完成</b><br>采样: " + samples.length + " 点<br>最高: " + Math.max(...heights).toFixed(0) + "m<br>最低: " + Math.min(...heights).toFixed(0) + "m<br>距离: " + (distances[distances.length-1]/1000).toFixed(2) + "km");
}
function startProfile() {
  pathPoints.length = 0; viewer.entities.removeAll();
  if (handler) handler.destroy();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction(function(c) {
    const p = getPickPos(c.position); if (!p) return;
    pathPoints.push(p);
    viewer.entities.add({ position: p, point: { pixelSize: 8, color: Cesium.Color.YELLOW, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    if (pathPoints.length > 1) viewer.entities.add({ polyline: { positions: pathPoints.slice(), width: 3, material: Cesium.Color.YELLOW, clampToGround: true } });
    showStatus("<b>剖面路径:</b> " + pathPoints.length + " 个点 | 右键完成");
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(function() { if (handler) { handler.destroy(); handler = null; } analyzeProfile(); }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  showStatus("<b>剖面分析:</b> 左键添加路径点，右键完成");
}
Sandcastle.addDefaultToolbarButton("开始剖面", () => startProfile());
Sandcastle.addToolbarButton("清除", () => { viewer.entities.removeAll(); pathPoints.length = 0; const ctx = profileCanvas.getContext("2d"); ctx.clearRect(0,0,400,200); showStatus("<b>已清除</b>"); });
showStatus("<b>剖面分析</b><br>点击开始");
Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll(); pathPoints.length = 0;
  if (profileCanvas.parentNode) profileCanvas.parentNode.removeChild(profileCanvas);
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};