import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const TDT_TOKEN = window.TIANDITU_TOKEN || "";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 5000000),
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

function clearLayers() {
  imageryLayers.removeAll();
}

function addTiandituLayer(layerType, label) {
  if (!TDT_TOKEN) {
    showStatus(
      '<b style="color:#f44">请配置天地图 Token</b><br>' +
      '配置 TIANDITU_TOKEN 环境变量后重新构建<br>' +
        '申请地址: <span style="color:#4af">lbs.tianditu.gov.cn</span>',
    );
    console.warn("天地图 Token 未配置，请在代码中修改 TDT_TOKEN");
    return;
  }

  clearLayers();
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/${layerType}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerType}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${TDT_TOKEN}`,
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    maximumLevel: 18,
    credit: "天地图",
  });

  provider.errorEvent.addEventListener(function (err) {
    console.warn(`[天地图 ${label}] 瓦片加载失败:`, err.message || err);
  });

  imageryLayers.addImageryProvider(provider);
  showStatus(`<b>当前图层:</b> ${label}`);
}

Sandcastle.addDefaultToolbarButton("矢量底图 (vec)", function () {
  addTiandituLayer("vec", "矢量底图 (vec_w)");
});

Sandcastle.addToolbarButton("矢量注记 (cva)", function () {
  addTiandituLayer("vec", "矢量底图");
  addTiandituLayer("cva", "矢量注记 (cva_w)");
});

Sandcastle.addToolbarButton("影像底图 (img)", function () {
  addTiandituLayer("img", "影像底图 (img_w)");
});

Sandcastle.addToolbarButton("影像注记 (cia)", function () {
  addTiandituLayer("img", "影像底图");
  addTiandituLayer("cia", "影像注记 (cia_w)");
});

Sandcastle.addToolbarButton("地形晕渲 (ter)", function () {
  addTiandituLayer("ter", "地形晕渲 (ter_w)");
});

Sandcastle.addToolbarButton("无底图", function () {
  clearLayers();
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#1a1a2e");
  showStatus("<b>无底图</b>");
});

if (!TDT_TOKEN) {
  showStatus(
    '<b style="color:#f44">天地图 Token 未配置</b><br>' +
      "请配置 TIANDITU_TOKEN 环境变量后重新构建<br>" +
      '申请: <span style="color:#4af">lbs.tianditu.gov.cn</span>',
  );
}

Sandcastle.reset = function () {
  clearLayers();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
