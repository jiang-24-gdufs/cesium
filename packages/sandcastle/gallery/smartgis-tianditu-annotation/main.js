import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const TDT_TOKEN = window.TIANDITU_TOKEN || "";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
});

const scene = viewer.scene;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 2000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});

const imageryLayers = viewer.imageryLayers;

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

function createTiandituProvider(layerType) {
  return new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/${layerType}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerType}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${TDT_TOKEN}`,
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    maximumLevel: 18,
    credit: "天地图",
  });
}

function clearAndLoad(layers, label) {
  if (!TDT_TOKEN) {
    showStatus(
      '<b style="color:#f44">天地图 Token 未配置</b><br>' +
        "配置 TIANDITU_TOKEN 环境变量后重新构建",
    );
    return;
  }
  imageryLayers.removeAll();
  for (const l of layers) {
    const provider = createTiandituProvider(l);
    provider.errorEvent.addEventListener(function (err) {
      console.warn(`[天地图 ${l}] 瓦片加载失败:`, err.message || err);
    });
    imageryLayers.addImageryProvider(provider);
  }
  showStatus(`<b>当前:</b> ${label}`);
}

Sandcastle.addDefaultToolbarButton("矢量 + 中文注记", function () {
  clearAndLoad(["vec", "cva"], "矢量底图 + 中文注记");
});

Sandcastle.addToolbarButton("影像 + 中文注记", function () {
  clearAndLoad(["img", "cia"], "影像底图 + 中文注记");
});

Sandcastle.addToolbarButton("地形 + 中文注记", function () {
  clearAndLoad(["ter", "cta"], "地形晕渲 + 中文注记");
});

Sandcastle.addToolbarButton("仅中文注记", function () {
  clearAndLoad(["cva"], "仅中文注记 (透明底)");
});

Sandcastle.addToolbarButton("切换注记透明度", function () {
  if (imageryLayers.length < 2) {
    showStatus("需要先加载含注记的图层组合");
    return;
  }
  const annotationLayer = imageryLayers.get(imageryLayers.length - 1);
  annotationLayer.alpha = annotationLayer.alpha === 1.0 ? 0.5 : 1.0;
  showStatus(`注记透明度: ${(annotationLayer.alpha * 100).toFixed(0)}%`);
});

if (!TDT_TOKEN) {
  showStatus(
    '<b style="color:#f44">天地图 Token 未配置</b><br>' +
      "配置 TIANDITU_TOKEN 环境变量后重新构建<br>" +
      '申请: <span style="color:#4af">lbs.tianditu.gov.cn</span>',
  );
}

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
