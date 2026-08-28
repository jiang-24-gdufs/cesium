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
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const sampleEntities = [];
for (let i = 0; i < 30; i++) {
  const lon = 113.25 + Math.random() * 0.1;
  const lat = 23.05 + Math.random() * 0.1;
  const entity = viewer.entities.add({
    name: `Building-${i + 1}`,
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    point: {
      pixelSize: 10,
      color: Cesium.Color.DODGERBLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  entity._lon = lon;
  entity._lat = lat;
  sampleEntities.push(entity);
}

let handler = null;
let queryEntity = null;
const queryPositions = [];

function getPickPosition(windowPos) {
  const ray = viewer.camera.getPickRay(windowPos);
  return ray ? scene.globe.pick(ray, scene) : null;
}

function pointInPolygon(testLon, testLat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon, yi = polygon[i].lat;
    const xj = polygon[j].lon, yj = polygon[j].lat;
    const intersect = ((yi > testLat) !== (yj > testLat)) &&
      (testLon < (xj - xi) * (testLat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function startPolygonQuery() {
  resetQuery();
  if (handler) handler.destroy();
  queryPositions.length = 0;

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const pos = getPickPosition(click.position);
    if (!pos) return;
    queryPositions.push(pos);
    showStatus(`<b>几何拾取:</b> 绘制查询区域<br>点数: ${queryPositions.length} | 右键完成`);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function () {
    if (queryPositions.length < 3) {
      showStatus("<b>至少需要 3 个点</b>");
      return;
    }

    handler.destroy();
    handler = null;

    queryEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(queryPositions.slice()),
        material: Cesium.Color.YELLOW.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.YELLOW,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    const polygon = queryPositions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return { lon: Cesium.Math.toDegrees(c.longitude), lat: Cesium.Math.toDegrees(c.latitude) };
    });

    let selectedCount = 0;
    for (const e of sampleEntities) {
      if (pointInPolygon(e._lon, e._lat, polygon)) {
        e.point.color = Cesium.Color.RED;
        e.point.pixelSize = 14;
        selectedCount++;
      }
    }

    showStatus(
      `<b>几何拾取结果</b><br>` +
      `查询区域: ${queryPositions.length} 个顶点<br>` +
      `选中: ${selectedCount} / ${sampleEntities.length}`,
    );
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  showStatus("<b>几何拾取:</b> 左键绘制查询多边形，右键完成");
}

function resetQuery() {
  for (const e of sampleEntities) {
    e.point.color = Cesium.Color.DODGERBLUE;
    e.point.pixelSize = 10;
  }
  if (queryEntity) {
    viewer.entities.remove(queryEntity);
    queryEntity = null;
  }
  queryPositions.length = 0;
}

Sandcastle.addDefaultToolbarButton("多边形查询", () => startPolygonQuery());

Sandcastle.addToolbarButton("圆形查询", () => {
  resetQuery();
  if (handler) handler.destroy();

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  showStatus("<b>圆形查询:</b> 点击设定圆心");

  handler.setInputAction(function (click) {
    const center = getPickPosition(click.position);
    if (!center) return;
    handler.destroy();
    handler = null;

    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const centerLon = Cesium.Math.toDegrees(centerCarto.longitude);
    const centerLat = Cesium.Math.toDegrees(centerCarto.latitude);
    const radius = 0.03;

    queryEntity = viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius * 111000,
        semiMinorAxis: radius * 111000,
        material: Cesium.Color.YELLOW.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.YELLOW,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    let count = 0;
    for (const e of sampleEntities) {
      const dx = e._lon - centerLon;
      const dy = e._lat - centerLat;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        e.point.color = Cesium.Color.RED;
        e.point.pixelSize = 14;
        count++;
      }
    }

    showStatus(`<b>圆形查询结果</b><br>半径: ~${(radius * 111).toFixed(1)}km<br>选中: ${count}`);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
});

Sandcastle.addToolbarButton("重置", () => {
  if (handler) { handler.destroy(); handler = null; }
  resetQuery();
  showStatus(`<b>已重置</b><br>样本: ${sampleEntities.length} 个`);
});

showStatus(`<b>几何拾取</b><br>${sampleEntities.length} 个样本点<br>选择查询方式`);

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  sampleEntities.length = 0;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
