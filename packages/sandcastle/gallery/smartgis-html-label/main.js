import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 50000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-45),
    roll: 0,
  },
});

const htmlContainer = document.createElement("div");
htmlContainer.id = "smartgis-html-labels";
htmlContainer.style.cssText =
  "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden;";
document.getElementById("cesiumContainer").appendChild(htmlContainer);

const poiData = [
  { name: "广州塔", lon: 113.3244, lat: 23.1063, icon: "🏗️", desc: "高度600m" },
  { name: "白云山", lon: 113.2985, lat: 23.1837, icon: "⛰️", desc: "海拔382m" },
  { name: "珠江新城", lon: 113.321, lat: 23.119, icon: "🏙️", desc: "CBD核心" },
  { name: "天河体育中心", lon: 113.3166, lat: 23.1377, icon: "🏟️", desc: "大型场馆" },
  { name: "中山纪念堂", lon: 113.2652, lat: 23.1355, icon: "🏛️", desc: "历史建筑" },
  { name: "花城广场", lon: 113.3218, lat: 23.1189, icon: "🌸", desc: "城市客厅" },
];

const labelElements = [];
const labelEntities = [];

function createHtmlLabel(poi) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;" +
    "transition:transform 0.15s;";
  el.innerHTML =
    `<div style="background:rgba(0,0,0,0.8);color:#fff;padding:4px 10px;border-radius:6px;` +
    `font:13px sans-serif;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);">` +
    `<span style="font-size:16px">${poi.icon}</span> <b>${poi.name}</b>` +
    `<div style="font-size:11px;color:#aaa">${poi.desc}</div></div>` +
    `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;` +
    `border-top:8px solid rgba(0,0,0,0.8);margin:0 auto;"></div>`;

  el.addEventListener("click", function () {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 2000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    });
  });

  htmlContainer.appendChild(el);
  return el;
}

function initLabels() {
  for (const poi of poiData) {
    const el = createHtmlLabel(poi);
    labelElements.push({
      element: el,
      position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 50),
    });

    const entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(poi.lon, poi.lat, 0),
      point: {
        pixelSize: 6,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    labelEntities.push(entity);
  }
}

function updateLabelPositions() {
  for (const item of labelElements) {
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
      scene,
      item.position,
    );
    if (screenPos) {
      const behindGlobe =
        scene.globe.depthTestAgainstTerrain &&
        Cesium.Cartesian3.distance(scene.camera.positionWC, item.position) >
          scene.camera.positionCartographic.height * 2;

      if (
        !behindGlobe &&
        screenPos.x > -100 &&
        screenPos.x < scene.canvas.width + 100 &&
        screenPos.y > -100 &&
        screenPos.y < scene.canvas.height + 100
      ) {
        item.element.style.display = "block";
        item.element.style.left = `${screenPos.x}px`;
        item.element.style.top = `${screenPos.y}px`;
      } else {
        item.element.style.display = "none";
      }
    } else {
      item.element.style.display = "none";
    }
  }
}

initLabels();
scene.postRender.addEventListener(updateLabelPositions);

Sandcastle.addDefaultToolbarButton("显示全部标注", function () {
  for (const item of labelElements) {
    item.element.style.display = "block";
  }
});

Sandcastle.addToolbarButton("隐藏标注", function () {
  for (const item of labelElements) {
    item.element.style.display = "none";
  }
});

Sandcastle.addToolbarButton("切换标注样式", function () {
  const styles = [
    "rgba(0,0,0,0.8)",
    "rgba(0,80,160,0.85)",
    "rgba(160,40,0,0.85)",
    "rgba(0,120,60,0.85)",
  ];
  const current = labelElements[0]?.element.querySelector("div")?.style
    .background;
  const idx = styles.indexOf(current);
  const next = styles[(idx + 1) % styles.length];
  for (const item of labelElements) {
    const mainDiv = item.element.querySelector("div");
    if (mainDiv) mainDiv.style.background = next;
  }
});

Sandcastle.addToolbarButton("飞到全景", function () {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 50000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
  });
});

Sandcastle.reset = function () {
  scene.postRender.removeEventListener(updateLabelPositions);
  viewer.entities.removeAll();
  labelElements.length = 0;
  labelEntities.length = 0;
  if (htmlContainer.parentNode) {
    htmlContainer.parentNode.removeChild(htmlContainer);
  }
};
