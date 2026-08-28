import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
});

const scene = viewer.scene;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(116.4, 39.9, 5000000),
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

function loadBaiduMapLayer(style) {
  imageryLayers.removeAll();

  const provider = new Cesium.UrlTemplateImageryProvider({
    url: `https://maponline{s}.bdimg.com/starpic/?qt=satepc&u=x={x};y={y};z={z};v=009;type=sate&fm=46&app=webearth2&v=009`,
    subdomains: ["0", "1", "2", "3"],
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18,
    credit: "百度地图",
  });

  provider.errorEvent.addEventListener((e) => {
    console.warn("[百度底图] 瓦片加载失败:", e.message || e);
  });

  imageryLayers.addImageryProvider(provider);
  showStatus(
    `<b>百度底图:</b> ${style}<br>` +
    '<span style="color:#fa0">注意: 百度地图使用 BD09 坐标系</span><br>' +
    "与 WGS84 存在坐标偏移，此处仅演示加载能力",
  );
}

showStatus(
  "<b>百度底图演示</b><br>" +
  '<span style="color:#fa0">百度地图使用 BD09 坐标系</span><br>' +
  "与 WGS84 存在系统性偏移<br>" +
  "生产环境需实现坐标纠偏",
);

Sandcastle.addDefaultToolbarButton("百度卫星图", () => loadBaiduMapLayer("卫星图"));

Sandcastle.addToolbarButton("OSM 替代", () => {
  imageryLayers.removeAll();
  imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
  );
  showStatus("<b>OpenStreetMap</b> (WGS84 对齐替代方案)");
});

Sandcastle.addToolbarButton("高德卫星 (参考)", () => {
  imageryLayers.removeAll();
  imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
      subdomains: ["1", "2", "3", "4"],
      maximumLevel: 18,
      credit: "高德地图",
    }),
  );
  showStatus("<b>高德卫星图</b> (GCJ-02 坐标系，中国范围有偏移)");
});

Sandcastle.addToolbarButton("坐标偏移说明", () => {
  showStatus(
    "<b>国内地图坐标偏移说明</b><br><br>" +
    "WGS84: GPS 原始坐标<br>" +
    "GCJ-02: 国测局加密 (高德/腾讯)<br>" +
    "BD09: 百度二次加密<br><br>" +
    "Cesium 使用 WGS84，需要纠偏才能对齐<br>" +
    "生产环境需要服务端或客户端坐标转换",
  );
});

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
