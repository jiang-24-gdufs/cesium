import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 15000),
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

function htmlToCanvas(html, width, height) {
  return new Promise(function (resolve) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${html}</div>
      </foreignObject>
    </svg>`;

    const img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = function () {
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.fillText("渲染失败", 10, 30);
      resolve(canvas);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

const panelConfigs = [
  {
    name: "数据面板",
    lon: 113.32, lat: 23.11, height: 300,
    html: `<div style="background:rgba(0,20,60,0.9);color:#fff;padding:12px;border-radius:8px;font:12px sans-serif;border:1px solid #0af;">
      <div style="font-size:14px;font-weight:bold;color:#0af;margin-bottom:8px;">实时监控面板</div>
      <div>温度: <span style="color:#0f0">26.5°C</span></div>
      <div>湿度: <span style="color:#0af">68%</span></div>
      <div>PM2.5: <span style="color:#fa0">45</span></div>
      <div style="margin-top:6px;color:#888">更新: 2024-01-01 12:00</div>
    </div>`,
  },
  {
    name: "告警面板",
    lon: 113.34, lat: 23.10, height: 400,
    html: `<div style="background:rgba(60,0,0,0.9);color:#fff;padding:12px;border-radius:8px;font:12px sans-serif;border:1px solid #f44;">
      <div style="font-size:14px;font-weight:bold;color:#f44;margin-bottom:8px;">⚠ 告警信息</div>
      <div>设备: 传感器-A03</div>
      <div>状态: <span style="color:#f44">异常</span></div>
      <div>原因: 超温告警</div>
    </div>`,
  },
  {
    name: "统计面板",
    lon: 113.30, lat: 23.12, height: 250,
    html: `<div style="background:rgba(0,40,0,0.9);color:#fff;padding:12px;border-radius:8px;font:12px sans-serif;border:1px solid #0f0;">
      <div style="font-size:14px;font-weight:bold;color:#0f0;margin-bottom:8px;">区域统计</div>
      <div>人流量: 12,345</div>
      <div>车流量: 3,456</div>
      <div>在线设备: 89/100</div>
    </div>`,
  },
];

async function addHtmlPanels() {
  viewer.entities.removeAll();
  showStatus("<b>渲染 HTML 面板...</b>");

  for (const config of panelConfigs) {
    const canvas = await htmlToCanvas(config.html, 256, 160);
    const dataUrl = canvas.toDataURL();

    viewer.entities.add({
      name: config.name,
      position: Cesium.Cartesian3.fromDegrees(config.lon, config.lat, config.height),
      billboard: {
        image: dataUrl,
        width: 256,
        height: 160,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 50000, 0.3),
      },
      point: {
        pixelSize: 6,
        color: Cesium.Color.CYAN,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  showStatus(`<b>HTML 渲染至场景:</b> ${panelConfigs.length} 个面板<br>使用 SVG foreignObject → Canvas → Billboard`);
}

Sandcastle.addDefaultToolbarButton("添加 HTML 面板", () => addHtmlPanels());

Sandcastle.addToolbarButton("清除", () => {
  viewer.entities.removeAll();
  showStatus("<b>已清除</b>");
});

Sandcastle.addToolbarButton("飞到全部", () => {
  viewer.flyTo(viewer.entities, { duration: 1.5 });
});

showStatus(
  "<b>HTML 渲染至场景</b><br>" +
  "将 HTML 内容通过 SVG foreignObject<br>" +
  "渲染到 Canvas 再作为 Billboard 贴图",
);

Sandcastle.reset = function () {
  viewer.entities.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
