import * as Cesium from "cesium";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  baseLayerPicker: false,
  scene3DOnly: true,
  infoBox: false,
  selectionIndicator: false,
});

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
const coordinateLabel = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(0, 0),
  label: {
    text: "",
    font: "15px monospace",
    fillColor: Cesium.Color.WHITE,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    outlineWidth: 4,
    pixelOffset: new Cesium.Cartesian2(12, -12),
    show: false,
  },
  point: {
    pixelSize: 10,
    color: Cesium.Color.CYAN,
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 2,
    show: false,
  },
});

handler.setInputAction((movement) => {
  const cartesian = viewer.camera.pickEllipsoid(
    movement.position,
    viewer.scene.globe.ellipsoid,
  );
  if (!Cesium.defined(cartesian)) {
    return;
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const formatted = `${longitude.toFixed(4)}°, ${latitude.toFixed(4)}°`;
  coordinateLabel.position = cartesian;
  coordinateLabel.label.text = formatted;
  coordinateLabel.label.show = true;
  coordinateLabel.point.show = true;
  document.getElementById("coordinates").textContent = `Selected coordinate: ${formatted}`;
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(8, 25, 15000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});
