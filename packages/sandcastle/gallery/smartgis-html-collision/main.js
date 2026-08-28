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
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const htmlContainer = document.createElement("div");
htmlContainer.style.cssText =
  "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden;";
document.getElementById("cesiumContainer").appendChild(htmlContainer);

const poiData = [];
for (let i = 0; i < 80; i++) {
  poiData.push({
    name: `POI-${i + 1}`,
    lon: 113.2 + Math.random() * 0.2,
    lat: 23.0 + Math.random() * 0.2,
    priority: Math.random(),
  });
}

const labelElements = [];

function createLabel(poi) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;transform:translate(-50%,-100%);" +
    "background:rgba(0,0,0,0.8);color:#fff;padding:2px 6px;border-radius:3px;" +
    "font:11px sans-serif;white-space:nowrap;border:1px solid rgba(255,255,255,0.2);";
  el.textContent = poi.name;
  htmlContainer.appendChild(el);
  return el;
}

function initLabels() {
  for (const poi of poiData) {
    const el = createLabel(poi);
    labelElements.push({
      element: el,
      position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 50),
      priority: poi.priority,
      screenX: 0,
      screenY: 0,
      width: 0,
      height: 0,
      visible: false,
    });
  }
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function resolveCollisions(items) {
  items.sort((a, b) => b.priority - a.priority);

  const placed = [];
  for (const item of items) {
    if (!item.visible) {
      item.element.style.display = "none";
      continue;
    }

    const rect = {
      left: item.screenX - item.width / 2,
      right: item.screenX + item.width / 2,
      top: item.screenY - item.height,
      bottom: item.screenY,
    };

    let overlapping = false;
    for (const p of placed) {
      if (rectsOverlap(rect, p)) {
        overlapping = true;
        break;
      }
    }

    if (overlapping) {
      item.element.style.display = "none";
    } else {
      item.element.style.display = "block";
      item.element.style.left = `${item.screenX}px`;
      item.element.style.top = `${item.screenY}px`;
      placed.push(rect);
    }
  }

  return placed.length;
}

function updateLabels() {
  for (const item of labelElements) {
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, item.position);
    if (screenPos &&
        screenPos.x > -50 && screenPos.x < scene.canvas.width + 50 &&
        screenPos.y > -50 && screenPos.y < scene.canvas.height + 50) {
      item.visible = true;
      item.screenX = screenPos.x;
      item.screenY = screenPos.y;
      item.width = item.element.offsetWidth || 60;
      item.height = item.element.offsetHeight || 18;
    } else {
      item.visible = false;
    }
  }

  const shown = resolveCollisions(labelElements);
  showStatus(
    `<b>HTML 标注-碰撞检测</b><br>` +
    `总数: ${poiData.length}<br>` +
    `显示: ${shown}<br>` +
    `隐藏: ${poiData.length - shown}`,
  );
}

initLabels();
scene.postRender.addEventListener(updateLabels);

Sandcastle.addDefaultToolbarButton("刷新碰撞检测", () => updateLabels());

Sandcastle.addToolbarButton("飞到全景", () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 20000),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
    duration: 1,
  });
});

Sandcastle.addToolbarButton("飞近 (密集)", () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 3000),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
    duration: 1,
  });
});

Sandcastle.reset = function () {
  scene.postRender.removeEventListener(updateLabels);
  labelElements.length = 0;
  if (htmlContainer.parentNode) htmlContainer.parentNode.removeChild(htmlContainer);
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
