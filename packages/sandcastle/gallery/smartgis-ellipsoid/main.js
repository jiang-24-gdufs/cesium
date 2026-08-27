import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
});

const scene = viewer.scene;
scene.globe.show = false;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 20000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});

const infoPanel = document.createElement("div");
infoPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:10px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
infoPanel.textContent = "选择一个椭球体";
document.getElementById("cesiumContainer").appendChild(infoPanel);

const coordLabel = viewer.entities.add({
  label: {
    show: false,
    showBackground: true,
    font: "13px monospace",
    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(15, -15),
    backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
});

const ellipsoidConfigs = {
  WGS84: {
    radii: new Cesium.Cartesian3(6378137.0, 6378137.0, 6356752.314245),
    color: Cesium.Color.CORNFLOWERBLUE,
    flat: 1 / 298.257223563,
  },
  "正球体": {
    radii: new Cesium.Cartesian3(6371000.0, 6371000.0, 6371000.0),
    color: Cesium.Color.LIGHTGREEN,
    flat: 0,
  },
  "月球": {
    radii: new Cesium.Cartesian3(1737400.0, 1737400.0, 1737400.0),
    color: Cesium.Color.LIGHTGRAY,
    flat: 0,
  },
  "火星": {
    radii: new Cesium.Cartesian3(3396190.0, 3396190.0, 3376200.0),
    color: Cesium.Color.fromCssColorString("#c1440e"),
    flat: 1 / 169.89,
  },
};

let currentPrimitive = null;
let currentEllipsoidName = null;

function createEllipsoidPrimitive(radii, color) {
  const geometry = new Cesium.EllipsoidGeometry({
    radii: radii,
    stackPartitions: 64,
    slicePartitions: 64,
  });

  const instance = new Cesium.GeometryInstance({
    geometry: geometry,
    modelMatrix: Cesium.Matrix4.IDENTITY,
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        color.withAlpha(0.6),
      ),
    },
  });

  return new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: false }),
    asynchronous: false,
  });
}

function showEllipsoid(name) {
  const config = ellipsoidConfigs[name];
  if (!config) return;

  if (currentPrimitive) {
    scene.primitives.remove(currentPrimitive);
  }

  currentPrimitive = createEllipsoidPrimitive(config.radii, config.color);
  scene.primitives.add(currentPrimitive);
  currentEllipsoidName = name;

  const a = config.radii.x;
  const b = config.radii.y;
  const c = config.radii.z;
  infoPanel.innerHTML =
    `<b>${name}</b><br>` +
    `赤道半径 a: ${(a / 1000).toFixed(3)} km<br>` +
    `赤道半径 b: ${(b / 1000).toFixed(3)} km<br>` +
    `极半径   c: ${(c / 1000).toFixed(3)} km<br>` +
    `扁率: ${config.flat === 0 ? "0 (正球)" : "1/" + (1 / config.flat).toFixed(3)}<br>` +
    `赤道周长: ${((2 * Math.PI * a) / 1000).toFixed(1)} km`;

  const maxRadius = Math.max(a, b, c);
  scene.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      113.3,
      23.1,
      maxRadius * 3,
    ),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
    duration: 1.0,
  });
}

const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction(function (movement) {
  if (!currentEllipsoidName) return;
  const config = ellipsoidConfigs[currentEllipsoidName];
  const pickEllipsoid = new Cesium.Ellipsoid(
    config.radii.x,
    config.radii.y,
    config.radii.z,
  );

  const cartesian = viewer.camera.pickEllipsoid(
    movement.endPosition,
    pickEllipsoid,
  );
  if (cartesian) {
    const cartographic = pickEllipsoid.cartesianToCartographic(cartesian);
    const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
    const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
    const height = cartographic.height.toFixed(2);

    const normal = pickEllipsoid.geodeticSurfaceNormal(cartesian);

    coordLabel.position = cartesian;
    coordLabel.label.show = true;
    coordLabel.label.text =
      `经度: ${lon}°  纬度: ${lat}°\n高度: ${height}m` +
      `\n法线: (${normal.x.toFixed(4)}, ${normal.y.toFixed(4)}, ${normal.z.toFixed(4)})`;
  } else {
    coordLabel.label.show = false;
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

Sandcastle.addDefaultToolbarButton("WGS84 椭球", function () {
  showEllipsoid("WGS84");
});

Sandcastle.addToolbarButton("正球 (6371km)", function () {
  showEllipsoid("正球体");
});

Sandcastle.addToolbarButton("月球 (1737km)", function () {
  showEllipsoid("月球");
});

Sandcastle.addToolbarButton("火星 (3396/3376km)", function () {
  showEllipsoid("火星");
});

Sandcastle.reset = function () {
  if (currentPrimitive) {
    scene.primitives.remove(currentPrimitive);
    currentPrimitive = null;
  }
  currentEllipsoidName = null;
  viewer.entities.removeAll();
  handler.destroy();
  if (infoPanel.parentNode) {
    infoPanel.parentNode.removeChild(infoPanel);
  }
};
