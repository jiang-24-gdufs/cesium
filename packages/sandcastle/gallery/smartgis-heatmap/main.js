import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayerPicker: false,
  baseLayer: false,
});

const scene = viewer.scene;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 80000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function generateRandomPoints(center, count, spread) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const lon = center.lon + (Math.random() - 0.5) * spread;
    const lat = center.lat + (Math.random() - 0.5) * spread;
    const value = Math.random();
    points.push({ lon, lat, value });
  }
  return points;
}

function createHeatmapCanvas(points, bounds, width, height, radius, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  for (const point of points) {
    const x =
      ((point.lon - bounds.west) / (bounds.east - bounds.west)) * width;
    const y =
      ((bounds.north - point.lat) / (bounds.north - bounds.south)) * height;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,0,0,${point.value * opacity})`);
    gradient.addColorStop(0.4, `rgba(255,255,0,${point.value * opacity * 0.6})`);
    gradient.addColorStop(0.7, `rgba(0,255,0,${point.value * opacity * 0.3})`);
    gradient.addColorStop(1, "rgba(0,0,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  return canvas;
}

let heatmapLayer = null;
let currentPoints = [];
const bounds = {
  west: 112.8,
  south: 22.6,
  east: 113.8,
  north: 23.6,
};

function renderHeatmap(pointCount, radius, opacity) {
  if (heatmapLayer) {
    viewer.imageryLayers.remove(heatmapLayer);
    heatmapLayer = null;
  }

  currentPoints = generateRandomPoints(
    { lon: 113.3, lat: 23.1 },
    pointCount,
    0.8,
  );

  const canvas = createHeatmapCanvas(
    currentPoints,
    bounds,
    512,
    512,
    radius,
    opacity,
  );

  const provider = new Cesium.SingleTileImageryProvider({
    url: canvas.toDataURL(),
    tileWidth: 512,
    tileHeight: 512,
    rectangle: Cesium.Rectangle.fromDegrees(
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ),
  });

  heatmapLayer = viewer.imageryLayers.addImageryProvider(provider);
  heatmapLayer.alpha = 0.7;

  statusPanel.innerHTML =
    `<b>热力图</b><br>` +
    `数据点: ${pointCount}<br>` +
    `半径: ${radius}px<br>` +
    `透明度: ${(opacity * 100).toFixed(0)}%`;
}

Sandcastle.addDefaultToolbarButton("500 个点", function () {
  renderHeatmap(500, 30, 0.8);
});

Sandcastle.addToolbarButton("1000 个点", function () {
  renderHeatmap(1000, 25, 0.8);
});

Sandcastle.addToolbarButton("2000 个点", function () {
  renderHeatmap(2000, 20, 0.7);
});

Sandcastle.addToolbarButton("大半径", function () {
  renderHeatmap(currentPoints.length || 500, 50, 0.8);
});

Sandcastle.addToolbarButton("小半径", function () {
  renderHeatmap(currentPoints.length || 500, 15, 0.8);
});

Sandcastle.addToolbarButton("切换透明度", function () {
  if (heatmapLayer) {
    heatmapLayer.alpha = heatmapLayer.alpha === 0.7 ? 0.4 : 0.7;
    statusPanel.innerHTML += `<br>图层透明度: ${(heatmapLayer.alpha * 100).toFixed(0)}%`;
  }
});

Sandcastle.addToolbarButton("清除", function () {
  if (heatmapLayer) {
    viewer.imageryLayers.remove(heatmapLayer);
    heatmapLayer = null;
  }
  currentPoints = [];
  statusPanel.innerHTML = "<b>热力图已清除</b>";
});

Sandcastle.reset = function () {
  if (heatmapLayer) {
    viewer.imageryLayers.remove(heatmapLayer);
    heatmapLayer = null;
  }
  currentPoints = [];
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
