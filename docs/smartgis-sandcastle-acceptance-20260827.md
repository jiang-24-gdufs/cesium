# SmartGIS Sandcastle 示例验收记录

验收时间：2026-08-27  
访问地址：`http://localhost:8080/Apps/Sandcastle2/index.html`  
验收方式：逐个打开示例，等待场景初始化，检查 Cesium 场景 iframe、工具栏、控制台 `error`/`warning`，并确认默认示例动作可执行。

## 结果汇总

| 结果 | 数量 | 说明 |
|---|---:|---|
| 场景加载通过 | 18 | 全部示例均进入 Cesium 场景并显示示例工具栏 |
| 控制台 error | 0 | 最终复测未发现控制台 error |
| 直接通过 | 16 | 可在当前环境完成初始化和默认效果验证 |
| 配置阻塞 | 2 | 天地图示例缺少真实 `TIANDITU_TOKEN`，不能确认远程 WMTS 图层出图 |

## 逐项记录

| 示例 | 场景 | 控制台 | 视觉/交互状态 | 结论 |
|---|---|---|---|---|
| `smartgis-viewer` | 已加载 | 无 error | Viewer、模式切换、深度检测、光照工具栏可见 | PASS |
| `smartgis-ellipsoid` | 已加载 | 无 error | 椭球体示例工具栏可见 | PASS |
| `smartgis-vertex-picking` | 已加载 | 无 error | 顶点拾取工具栏可见 | PASS |
| `smartgis-draw` | 已加载 | 无 error | 绘制工具栏可见 | PASS |
| `smartgis-tianditu-vec` | 已加载 | 无 error；缺 token warning | 页面可运行，但 WMTS 图层被 token 配置阻塞 | BLOCKED_TOKEN |
| `smartgis-tianditu-annotation` | 已加载 | 无 error | 注记示例可运行；远程图层效果被 token 配置阻塞 | BLOCKED_TOKEN |
| `smartgis-anti-alias` | 已加载 | 无 error | 抗锯齿工具栏可见 | PASS |
| `smartgis-heatmap` | 已加载 | 无 error | 热力图默认数据与调节工具栏可见 | PASS |
| `smartgis-fog` | 已加载 | 无 error | 雾效果工具栏可见 | PASS |
| `smartgis-rain` | 已加载 | 无 error | 雨效果工具栏可见 | PASS |
| `smartgis-snow` | 已加载 | 无 error | 雪效果工具栏可见 | PASS |
| `smartgis-html-label` | 已加载 | 无 error | HTML 标注工具栏可见 | PASS |
| `smartgis-model-picking` | 已加载 | 无 error | 模型拾取工具栏可见 | PASS |
| `smartgis-camera-rotation` | 已加载 | 无 error | 相机旋转工具栏可见 | PASS |
| `smartgis-keyboard-roaming` | 已加载 | 无 error | 键盘漫游工具栏可见 | PASS |
| `smartgis-fly-management` | 已加载 | 无 error | 飞行管理工具栏可见 | PASS |
| `smartgis-video-mp4` | 已加载 | 无 error | 视频播放、暂停、静音、尺寸控制工具栏可见 | PASS |
| `smartgis-no-basemap` | 已加载 | 无 error | 无底图场景和控制工具栏可见 | PASS |

## 已修复问题

- 热力图的 `SingleTileImageryProvider` 补充 `tileWidth`/`tileHeight`，并将无底图 Viewer 配置为 `baseLayerPicker: false`、`baseLayer: false`。
- 视频示例忽略正常的 `AbortError`，避免在 Sandcastle 重置视频元素时产生误报。
- 所有新增示例统一从构建生成的运行时配置读取 Cesium ion token。
- 天地图示例统一从 `TIANDITU_TOKEN` 读取 token，不再使用代码内占位字符串。

## 完成天地图验收

```sh
export TIANDITU_TOKEN="<your TianDiTu token>"
node scripts/generateIonConfig.js
SANDCASTLE_NO_EMBEDDINGS=1 npm run build-sandcastle -- --no-embeddings
```

然后刷新两个天地图示例，确认：

- 控制台无 token warning；
- WMTS 请求返回成功；
- 矢量/影像/地形与注记图层可见；
- 图层切换和清理后无残留。
