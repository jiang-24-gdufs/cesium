import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(0, 20, 15000000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
});

const imageryLayers = viewer.imageryLayers;

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let wmsLayer = null;

function loadWMSLayer(url, layers, name, extraParams) {
  if (wmsLayer) {
    imageryLayers.remove(wmsLayer);
    wmsLayer = null;
  }

  const params = {
    url: url,
    layers: layers,
    parameters: {
      transparent: true,
      format: "image/png",
      ...extraParams,
    },
  };

  const provider = new Cesium.WebMapServiceImageryProvider(params);
  provider.errorEvent.addEventListener((e) => {
    console.warn(`[WMS ${name}]`, e.message || e);
    showStatus(`<b style="color:#f44">WMS 加载失败:</b> ${name}<br>${e.message || "服务不可达"}`);
  });
  wmsLayer = imageryLayers.addImageryProvider(provider);
  showStatus(
    `<b>WMS 图层:</b> ${name}<br>` +
    `URL: ${url.substring(0, 50)}...<br>` +
    `Layers: ${layers}`,
  );
}

Sandcastle.addDefaultToolbarButton("NASA Blue Marble", () => {
  loadWMSLayer(
    "https://neo.gsfc.nasa.gov/wms/wms",
    "BlueMarbleNG-TB",
    "NASA Blue Marble",
  );
});

Sandcastle.addToolbarButton("NASA Sea Temp", () => {
  loadWMSLayer(
    "https://neo.gsfc.nasa.gov/wms/wms",
    "MYD28M",
    "NASA 海表温度",
  );
});

Sandcastle.addToolbarButton("NASA Vegetation", () => {
  loadWMSLayer(
    "https://neo.gsfc.nasa.gov/wms/wms",
    "MOD_NDVI_M",
    "NASA 植被指数 (NDVI)",
  );
});

Sandcastle.addToolbarButton("NASA Night Lights", () => {
  loadWMSLayer(
    "https://neo.gsfc.nasa.gov/wms/wms",
    "VIIRS_Black_Marble",
    "NASA 夜间灯光",
  );
});

Sandcastle.addToolbarButton("调整透明度", () => {
  if (wmsLayer) {
    wmsLayer.alpha = wmsLayer.alpha === 1.0 ? 0.5 : 1.0;
    showStatus(`WMS 图层透明度: ${(wmsLayer.alpha * 100).toFixed(0)}%`);
  } else {
    showStatus("请先加载 WMS 图层");
  }
});

Sandcastle.addToolbarButton("移除 WMS", () => {
  if (wmsLayer) {
    imageryLayers.remove(wmsLayer);
    wmsLayer = null;
    showStatus("<b>WMS 图层已移除</b>");
  }
});

showStatus(
  "<b>WMS 单图加载</b><br>" +
  "支持 OGC WMS 标准协议<br>" +
  "选择不同图层查看效果",
);

Sandcastle.reset = function () {
  if (wmsLayer) {
    imageryLayers.remove(wmsLayer);
    wmsLayer = null;
  }
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
