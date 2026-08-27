import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 100000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-60),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
statusPanel.textContent = "选择飞行目标";
document.getElementById("cesiumContainer").appendChild(statusPanel);

const waypoints = [
  { name: "广州塔", lon: 113.3244, lat: 23.1063, height: 1000, heading: 30, pitch: -20 },
  { name: "北京天安门", lon: 116.3912, lat: 39.9073, height: 2000, heading: 0, pitch: -30 },
  { name: "上海外滩", lon: 121.4908, lat: 31.2396, height: 800, heading: 60, pitch: -15 },
  { name: "深圳市民中心", lon: 114.0579, lat: 22.5431, height: 1500, heading: -30, pitch: -25 },
  { name: "成都天府广场", lon: 104.0655, lat: 30.6572, height: 3000, heading: 0, pitch: -45 },
];

let flyingCancelled = false;

function flyToWaypoint(wp, duration) {
  flyingCancelled = false;
  statusPanel.innerHTML = `<b>飞行中:</b> ${wp.name}<br>时长: ${duration}s`;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.height),
    orientation: {
      heading: Cesium.Math.toRadians(wp.heading),
      pitch: Cesium.Math.toRadians(wp.pitch),
      roll: 0,
    },
    duration: duration,
    complete: function () {
      if (!flyingCancelled) {
        statusPanel.innerHTML = `<b>已到达:</b> ${wp.name}`;
      }
    },
    cancel: function () {
      statusPanel.innerHTML = `<b>飞行取消</b>`;
    },
  });
}

async function flyRoute() {
  flyingCancelled = false;
  statusPanel.innerHTML = `<b>航线飞行:</b> ${waypoints.length} 个航点`;

  for (let i = 0; i < waypoints.length; i++) {
    if (flyingCancelled) break;
    const wp = waypoints[i];
    statusPanel.innerHTML = `<b>航线飞行:</b> ${i + 1}/${waypoints.length} → ${wp.name}`;

    await new Promise(function (resolve) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.height),
        orientation: {
          heading: Cesium.Math.toRadians(wp.heading),
          pitch: Cesium.Math.toRadians(wp.pitch),
          roll: 0,
        },
        duration: 2,
        complete: resolve,
        cancel: function () {
          flyingCancelled = true;
          resolve();
        },
      });
    });

    if (!flyingCancelled && i < waypoints.length - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 1000);
      });
    }
  }

  if (!flyingCancelled) {
    statusPanel.innerHTML = `<b>航线完成:</b> ${waypoints.length} 个航点`;
  }
}

for (const wp of waypoints) {
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
    point: {
      pixelSize: 8,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: wp.name,
      font: "13px sans-serif",
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(10, -10),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

Sandcastle.addDefaultToolbarButton("飞到广州塔", function () {
  flyToWaypoint(waypoints[0], 3);
});

Sandcastle.addToolbarButton("飞到北京", function () {
  flyToWaypoint(waypoints[1], 3);
});

Sandcastle.addToolbarButton("飞到上海", function () {
  flyToWaypoint(waypoints[2], 3);
});

Sandcastle.addToolbarButton("航线飞行", function () {
  flyRoute();
});

Sandcastle.addToolbarButton("取消飞行", function () {
  flyingCancelled = true;
  scene.camera.cancelFlight();
  statusPanel.innerHTML = `<b>飞行已取消</b>`;
});

Sandcastle.addToolbarButton("飞到全部航点", function () {
  viewer.flyTo(viewer.entities, { duration: 2 });
  statusPanel.innerHTML = `<b>飞到全部航点</b>`;
});

Sandcastle.reset = function () {
  flyingCancelled = true;
  scene.camera.cancelFlight();
  viewer.entities.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
