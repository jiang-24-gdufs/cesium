import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 2000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-30),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

const videoElement = document.createElement("video");
videoElement.crossOrigin = "anonymous";
videoElement.loop = true;
videoElement.muted = true;
videoElement.style.display = "none";
document.body.appendChild(videoElement);

let videoEntity = null;

function createVideoScreen(videoUrl, position, width, height) {
  if (videoEntity) {
    viewer.entities.remove(videoEntity);
  }

  videoElement.src = videoUrl;
  videoElement.play().catch(function (err) {
    if (err.name === "AbortError") {
      return;
    }
    statusPanel.innerHTML =
      `<b style="color:#f44">视频加载失败</b><br>${err.message}<br>` +
      "请确保视频 URL 可访问且支持 CORS";
    console.error("视频加载失败:", err);
  });

  videoEntity = viewer.entities.add({
    name: "视频投屏",
    position: position,
    plane: {
      plane: new Cesium.Plane(Cesium.Cartesian3.UNIT_Z, 0),
      dimensions: new Cesium.Cartesian2(width, height),
      material: videoElement,
    },
  });

  statusPanel.innerHTML =
    `<b>视频播放中</b><br>` +
    `尺寸: ${width}×${height}m<br>` +
    `源: ${videoUrl.split("/").pop()}`;
}

const testVideoUrl =
  "https://cesium.com/public/SandcastleSampleData/big-buck-bunny_trailer.mp4";

Sandcastle.addDefaultToolbarButton("播放测试视频", function () {
  createVideoScreen(
    testVideoUrl,
    Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200),
    400,
    225,
  );
});

Sandcastle.addToolbarButton("暂停/继续", function () {
  if (!videoElement.src) {
    statusPanel.innerHTML = "<b>请先加载视频</b>";
    return;
  }
  if (videoElement.paused) {
    videoElement.play();
    statusPanel.innerHTML = "<b>视频已继续</b>";
  } else {
    videoElement.pause();
    statusPanel.innerHTML = "<b>视频已暂停</b>";
  }
});

Sandcastle.addToolbarButton("静音/取消静音", function () {
  videoElement.muted = !videoElement.muted;
  statusPanel.innerHTML = `<b>静音: ${videoElement.muted ? "开" : "关"}</b>`;
});

Sandcastle.addToolbarButton("调整大小 (大)", function () {
  if (!videoEntity) {
    statusPanel.innerHTML = "<b>请先加载视频</b>";
    return;
  }
  createVideoScreen(
    videoElement.src,
    Cesium.Cartesian3.fromDegrees(113.3, 23.1, 300),
    800,
    450,
  );
});

Sandcastle.addToolbarButton("调整大小 (小)", function () {
  if (!videoEntity) {
    statusPanel.innerHTML = "<b>请先加载视频</b>";
    return;
  }
  createVideoScreen(
    videoElement.src,
    Cesium.Cartesian3.fromDegrees(113.3, 23.1, 150),
    200,
    112,
  );
});

Sandcastle.reset = function () {
  videoElement.pause();
  videoElement.src = "";
  if (videoElement.parentNode) {
    videoElement.parentNode.removeChild(videoElement);
  }
  viewer.entities.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
