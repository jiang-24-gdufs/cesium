import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const defaultBaseColor = Cesium.Color.fromCssColorString("#1a1a2e");
scene.globe.baseColor = defaultBaseColor.clone();

const defaultCamera = {
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 3000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
};
scene.camera.setView(defaultCamera);

const imageryLayers = viewer.imageryLayers;

const statusOverlay = document.createElement("div");
statusOverlay.style.cssText =
  "position:absolute;bottom:40px;left:50%;transform:translateX(-50%);" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 16px;border-radius:4px;" +
  "font:14px monospace;pointer-events:none;z-index:10;display:none;";
document.getElementById("cesiumContainer").appendChild(statusOverlay);

function showStatus(text, duration) {
  statusOverlay.textContent = text;
  statusOverlay.style.display = "block";
  if (duration) {
    setTimeout(function () {
      statusOverlay.style.display = "none";
    }, duration);
  }
}

function hideStatus() {
  statusOverlay.style.display = "none";
}

function removeAllImagery() {
  imageryLayers.removeAll();
  scene.globe.baseColor = defaultBaseColor.clone();
}

function addLayerWithErrorHandling(provider, name) {
  removeAllImagery();
  const layer = imageryLayers.addImageryProvider(provider);
  showStatus(`正在加载: ${name}...`);

  let loaded = false;
  const checkReady = function () {
    if (loaded) return;
    loaded = true;
    showStatus(`已加载: ${name}`, 2000);
  };

  provider.readyPromise
    ? provider.readyPromise.then(checkReady).catch(function (err) {
        showStatus(`加载失败: ${name} - ${err.message}`, 5000);
        console.error(`[${name}] 加载失败:`, err);
        imageryLayers.remove(layer);
      })
    : checkReady();

  layer.imageryProvider.errorEvent.addEventListener(function (err) {
    console.warn(`[${name}] 瓦片加载警告:`, err.message || err);
  });

  return layer;
}

Sandcastle.addDefaultToolbarButton("无底图", function () {
  removeAllImagery();
  showStatus("无底图模式", 2000);
});

Sandcastle.addToolbarButton("OpenStreetMap", function () {
  addLayerWithErrorHandling(
    new Cesium.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/",
    }),
    "OpenStreetMap",
  );
});

Sandcastle.addToolbarButton("单色底图", function () {
  addLayerWithErrorHandling(
    new Cesium.SingleTileImageryProvider({
      url: Cesium.buildModuleUrl(
        "Assets/Textures/NaturalEarthII/0/0/0.jpg",
      ),
      rectangle: Cesium.Rectangle.MAX_VALUE,
    }),
    "单色底图",
  );
});

Sandcastle.addToolbarButton("自然地球 (内置)", function () {
  addLayerWithErrorHandling(
    new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    }),
    "自然地球",
  );
});

Sandcastle.addToolbarButton("调整球体底色", function () {
  const colors = ["#1a1a2e", "#0f3460", "#16213e", "#533483", "#2b2d42"];
  const current = scene.globe.baseColor.toCssHexString();
  const idx = colors.indexOf(current);
  const next = colors[(idx + 1) % colors.length];
  scene.globe.baseColor = Cesium.Color.fromCssColorString(next);
  showStatus(`球体底色: ${next}`, 2000);
});

Sandcastle.addToolbarButton("图层透明度 50%", function () {
  if (imageryLayers.length === 0) {
    showStatus("当前无影像图层", 2000);
    return;
  }
  const layer = imageryLayers.get(imageryLayers.length - 1);
  layer.alpha = layer.alpha === 1.0 ? 0.5 : 1.0;
  showStatus(`图层透明度: ${(layer.alpha * 100).toFixed(0)}%`, 2000);
});

Sandcastle.reset = function () {
  removeAllImagery();
  hideStatus();
  if (statusOverlay.parentNode) {
    statusOverlay.parentNode.removeChild(statusOverlay);
  }
};
