# SmartGIS SDK 与本地 Cesium D4 示例双页对比（第 1 轮）

测试日期：2026-08-28  
SDK 目录：[SouthSmart Cesium 示例](https://southsmart.com/developer-center/#/Web?system=Cesium&menu=example)  
本地地址：`http://localhost:8080/Apps/Sandcastle2/index.html?id=<example-id>`

## 测试方法

每组同时创建两个临时页面：

1. SDK 示例：`products/Web/SDK/examples/editor.html#<sdk-id>`。
2. 本地开源 Cesium 示例：Sandcastle `smartgis-<id>`。

两个页面分别等待场景初始化，检查可见控件、代码中可观察到的核心数据/算法和 console error；记录完成后立即关闭该组两个标签，避免浏览器内存累积。SDK 页面只作为外观、流程和公开可见行为的参照，不复制 SmartGIS SDK 类、变量或私有实现。

## 汇总

| D4 示例 | SDK 场景 | 本地场景 | Console error | 功能等价性 | 判定 |
|---|---|---|---|---|---|
| 播放 FLV 视频流 | 已加载，真实 BIM 3D Tiles 场景 | 已加载，Cesium canvas ×2 | 双方 0 | 本地仅灰色平面，无 FLV 解码/视频纹理 | PARTIAL |
| 流体模拟 | 已加载，参数、可视化、注入流体控制完整 | 已加载，Cesium canvas ×2 | 双方 0 | 本地仅回调高度驱动半透明矩形 | PARTIAL |
| 雷达分析 | 已加载，可添加、更新、隐藏、删除，带扫描速率 | 已加载，Cesium canvas ×2 | 双方 0 | 本地仅固定半透明椭球和点位 | PARTIAL |
| 实心剖切 | 已加载，地质 3D Tiles、X/Y/Z 滑杆剖切 | 已加载，Cesium canvas ×2 | 双方 0 | 本地仅多个分层 Box，不存在真实模型实心剖切 | PARTIAL |

结论：这四个本地示例不存在当前运行时报错，但均未达到 SDK 原示例的功能深度。它们应保留为可运行的概念演示，不能标注为“已复刻完成”。

## 逐项证据与整改目标

### 1. 播放 FLV 视频流

SDK 页面加载 BIM 3D Tiles，并提供视频场景入口；本地 `smartgis-flv-video` 仅创建一个 `Cesium.Plane` + `Color.DARKGRAY` 平面，工具栏为“加载视频/清除”。没有 FLV 解码器、`HTMLVideoElement`、视频纹理或播放状态管理。

整改：在明确数据授权后接入可公开访问的 FLV/HLS 流；用开源解码器完成 FLV → `HTMLVideoElement`，再通过 Cesium 材质的视频纹理或动态纹理更新映射到几何体。无可访问流时必须显示 `BLOCKED`，不可用占位面冒充播放。

### 2. 流体模拟

SDK 页面具备时间步、总时长、地面高度暂停、流体着色类型、速度/深度/法线调试纹理、流体注入体积/半径/速度等控制。当地示例只有“启动模拟/停止”，实现为矩形 Entity 的高度回调。

整改：实现网格化高度场或浅水方程近似；至少提供时间步进、速度场、边界条件、颜色映射和注入源。可先用公开规则格网/DEM，而非 SmartGIS 私有数据。

### 3. 雷达分析

SDK 使用 `RadarManager`，公开页面可见扫描速率，并提供新增、更新、可见性和删除操作。本地只绘制一个固定椭球和中心点，既没有锥体、方位/俯仰角，也没有扫描动画、遮挡或目标检测。

整改：开源 Cesium 方案应自研雷达状态机：`FrustumGeometry`/自定义 Primitive 显示波束，`Clock` 或 `preUpdate` 更新扫描角，射线或深度拾取计算可视域，并提供参数修改/销毁生命周期。

### 4. 实心剖切

SDK 加载真实地质 3D Tiles，并以 X/Y/Z 滑杆驱动实心剖切和按要素着色。本地 `smartgis-solid-clipping` 仅生成 5 个高度不同的 Box；代码中没有 `Cesium3DTileset`、`ClippingPlaneCollection` 或模型/要素属性处理。

整改：使用允许再分发的公开 glTF/3D Tiles 数据；通过 `ClippingPlaneCollection` 或自研 shader/Primitive 裁剪实现三正交平面，再提供滑杆实时更新和剖面颜色/封口策略。注意 SDK 中的 `solidClippingOptions` 是私有能力，不能调用或复用。

## 下一轮 D4 优先顺序

1. 视频流投影、视锥视频投放、视频投放-自定义。
2. 船闸通航、大坝泄水、水质污染模型。
3. 拉伸、炸开、OBJ 模型编辑。
4. 三个 KHR 材质扩展与军事标绘/态势推演。

## 验收口径

- `PASS`：有真实数据/几何，核心算法或原生 Cesium API 已执行，默认操作能观察到目标效果。
- `PARTIAL`：场景可运行但仅为标记、占位面或简化实体，未复现关键行为。
- `FAIL`：解析错误、运行时 error、场景无法初始化。
- `BLOCKED`：缺公开可用数据、token、许可或外部流，无法真实验证。

