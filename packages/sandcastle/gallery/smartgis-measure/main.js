import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 20000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;" +
  "max-width:280px;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let handler = null;
let measureMode = null;
const positions = [];
const measureEntities = [];

function getPickPosition(windowPos) {
  const ray = viewer.camera.getPickRay(windowPos);
  return ray ? scene.globe.pick(ray, scene) : null;
}

function formatDistance(meters) {
  return meters > 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`;
}

function calcSpaceDistance(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Cesium.Cartesian3.distance(pts[i - 1], pts[i]);
  }
  return total;
}

function calcGeodesicDistance(pts) {
  let total = 0;
  const geo = new Cesium.EllipsoidGeodesic();
  for (let i = 1; i < pts.length; i++) {
    const c1 = Cesium.Cartographic.fromCartesian(pts[i - 1]);
    const c2 = Cesium.Cartographic.fromCartesian(pts[i]);
    geo.setEndPoints(c1, c2);
    total += geo.surfaceDistance;
  }
  return total;
}

function calcArea(pts) {
  if (pts.length < 3) return 0;
  const cartos = pts.map((p) => Cesium.Cartographic.fromCartesian(p));
  const coords = cartos.map((c) => ({
    lon: Cesium.Math.toDegrees(c.longitude),
    lat: Cesium.Math.toDegrees(c.latitude),
  }));

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += Cesium.Math.toRadians(coords[j].lon - coords[i].lon) *
      (2 + Math.sin(Cesium.Math.toRadians(coords[i].lat)) + Math.sin(Cesium.Math.toRadians(coords[j].lat)));
  }
  area = Math.abs(area * 6378137 * 6378137 / 2);
  return area;
}

function formatArea(sqm) {
  if (sqm > 1e6) return `${(sqm / 1e6).toFixed(4)} km²`;
  return `${sqm.toFixed(2)} m²`;
}

function startMeasure(mode) {
  stopMeasure();
  measureMode = mode;
  positions.length = 0;

  showStatus(`<b>测量模式:</b> ${mode}<br>左键: 添加点 | 右键: 完成`);

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const pos = getPickPosition(click.position);
    if (!pos) return;
    positions.push(pos);

    const entity = viewer.entities.add({
      position: pos,
      point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    measureEntities.push(entity);

    if (mode === "距离" && positions.length >= 2) {
      const lineEntity = viewer.entities.add({
        polyline: {
          positions: positions.slice(),
          width: 3,
          material: Cesium.Color.YELLOW,
          clampToGround: true,
        },
      });
      measureEntities.push(lineEntity);

      const spaceDist = calcSpaceDistance(positions);
      const geoDist = calcGeodesicDistance(positions);

      showStatus(
        `<b>距离测量</b><br>` +
        `点数: ${positions.length}<br>` +
        `空间距离: ${formatDistance(spaceDist)}<br>` +
        `大地距离: ${formatDistance(geoDist)}`,
      );
    }

    if (mode === "面积" && positions.length >= 3) {
      const area = calcArea(positions);
      showStatus(
        `<b>面积测量</b><br>` +
        `点数: ${positions.length}<br>` +
        `面积: ${formatArea(area)}`,
      );
    }

    if (mode === "高度") {
      const carto = Cesium.Cartographic.fromCartesian(pos);
      showStatus(
        `<b>高度测量</b><br>` +
        `经: ${Cesium.Math.toDegrees(carto.longitude).toFixed(5)}°<br>` +
        `纬: ${Cesium.Math.toDegrees(carto.latitude).toFixed(5)}°<br>` +
        `高: ${carto.height.toFixed(2)}m`,
      );
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function () {
    if (measureMode === "面积" && positions.length >= 3) {
      const polyEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions.slice()),
          material: Cesium.Color.CYAN.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      measureEntities.push(polyEntity);
    }
    showStatus(statusPanel.innerHTML + "<br><b>测量完成</b>");
    if (handler) {
      handler.destroy();
      handler = null;
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function stopMeasure() {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  measureMode = null;
  positions.length = 0;
}

Sandcastle.addDefaultToolbarButton("距离测量", () => startMeasure("距离"));
Sandcastle.addToolbarButton("面积测量", () => startMeasure("面积"));
Sandcastle.addToolbarButton("高度测量", () => startMeasure("高度"));

Sandcastle.addToolbarButton("清除测量", () => {
  stopMeasure();
  for (const e of measureEntities) viewer.entities.remove(e);
  measureEntities.length = 0;
  showStatus("<b>测量已清除</b>");
});

showStatus("<b>基础测量</b><br>选择测量模式后点击地图");

Sandcastle.reset = function () {
  stopMeasure();
  viewer.entities.removeAll();
  measureEntities.length = 0;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
