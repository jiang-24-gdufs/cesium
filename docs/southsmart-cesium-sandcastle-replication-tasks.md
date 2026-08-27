# SmartGIS SDK for Cesium：Sandcastle 复刻 Task List

> 来源： [SouthSmart Cesium Developer Center 示例页](https://southsmart.com/developer-center/#/Web?system=Cesium&menu=example)  
> 目标：以 Cesium Sandcastle 为承载，按示例模块逐项复刻 SmartGIS SDK 的可见功能与交互。

> **实现边界（必须遵守）**：仅允许使用开源 Cesium 及项目自研代码；禁止使用南方数码公司的 SDK、内置变量、私有类、私有服务接口或从其示例代码直接复制实现。功能应优先采用自研算法完成，只有在确认属于开源 Cesium 公共 API 时才允许直接调用。

## 1. 范围与拆分规则

- 本版以**难度优先**作为主排序，难度由“低 → 高”执行；原来的 P0/P1/P2 保留在模块索引中，作为业务优先级参考。
- **开源与自研约束**：复刻实现只能依赖开源 Cesium 公共 API 和项目自研代码；不得引入 SmartGIS SDK、南方数码 SDK、其内置变量/私有类/私有服务接口或反编译代码。涉及分析、标绘、特效和数据适配时，优先设计并实现自研算法。
- **D0**：纯 Cesium 原生 API、无外部数据、交互简单，适合先验证 Sandcastle 壳和编码规范。
- **D1**：单一数据源或单一交互闭环，存在少量服务配置、坐标转换或生命周期管理。
- **D2**：组合多个 Cesium 能力，包含绘制/拾取/编辑、动态材质或基础空间计算。
- **D3**：依赖复杂渲染管线、地形/3D Tiles、异步分析、性能调优或多视图联动。
- **D4**：行业专项、外部视频/流体/服务、复杂 shader/算法、数据和授权依赖明显。
- 每个 task 的完成标准：Sandcastle 中有独立示例入口、可重复初始化/清理、必要参数可调整、异常或无数据时有明确提示，并在目标浏览器中验证。
- `editor.html#...` 仅作为功能需求和验收参考，不作为代码来源；外部底图、地形、视频和 SmartGIS 服务需要在复刻时替换为开源、公开或自建测试数据源，不把线上服务地址硬编码进公共示例。

## 2. 按难度优先的执行顺序

1. **D0**：Viewer、底图切换、基础 Entity/Primitive、相机和简单效果。
2. **D1**：常规服务图层、基础绘制、标注、模型加载与单点分析。
3. **D2**：可编辑图形、空间查询、基础分析、动态展示与缓存。
4. **D3**：地形分析、3D Tiles shader、复杂后处理、多视图和高级交互。
5. **D4**：视频投放、流体/水质、地质模型、高级材质、军事标绘和态势推演。

## 3. 主任务清单（按难度排序）

> 每项都对应原站示例锚点；模块标签用于回查下方的功能模块索引。完成一项后再进入下一难度层级。

### D0：低难度 / 建立可运行基线

- [ ] 创建视图（基础功能） — `#viewer`
- [ ] 无底图（在线底图） — `#noneBaseMap`
- [ ] 参考椭球体（基础功能） — `#ellipsoid`
- [ ] 顶点拾取（基础功能） — `#vertexPicking`
- [ ] 天地图矢量底图（在线底图） — `#tiandituvecBaseMap`
- [ ] 天地图注记（在线底图） — `#tiandituzjBaseMap`
- [ ] 抗锯齿（后期处理） — `#anti-alias`
- [ ] HTML 标注（基础标绘） — `#htmlPoint`
- [ ] 模型拾取（模型操作） — `#pick`
- [ ] 绕中心旋转（相机控制） — `#cameraRotationTool`
- [ ] 键盘漫游（相机控制） — `#roam`
- [ ] 飞行管理（相机控制） — `#fly`
- [ ] 播放 MP4 视频文件（视频相关） — `#videoPlayMP4`
- [ ] 雨（环境模拟） — `#rainEffect`
- [ ] 雪（环境模拟） — `#snowEffect`
- [ ] 雾（环境模拟） — `#fogEffect`
- [ ] 热力图（热力图） — `#heatmap`
- [ ] 绘制几何（在线绘制与量测） — `#draw`

### D1：中低难度 / 单数据源与单交互闭环

- [ ] 天地图底图（在线底图） — `#tiandituBaseMap`
- [ ] esri 底图（在线底图） — `#esriBaseMap`
- [ ] 百度底图（在线底图） — `#baiduBaseMap`
- [ ] 深色底图（可配）（在线底图） — `#darkImageryLayer`
- [ ] 天地图地名标注（三维）（在线底图） — `#tdtPlaceName`
- [ ] SmartImagery 影像（影像栅格） — `#layerInfoImageryMap`
- [ ] ArcGIS MapServer 4490 影像（影像栅格） — `#arcgis-4490`
- [ ] WMS 单图加载（影像栅格） — `#wms-single`
- [ ] 公网地形（地形） — `#terrain`
- [ ] ArcGIS 地形（地形） — `#esriterrain`
- [ ] 二维矢量瓦片底图（矢量） — `#vector2`
- [ ] PBF 矢量样式数据（矢量） — `#pbf`
- [ ] 基础测量（在线绘制与量测） — `#measure`
- [ ] 绘制可编辑平面（在线绘制与量测） — `#drawEditablePlane`
- [ ] 绘制可编辑立方体（在线绘制与量测） — `#drawEditableCube`
- [ ] 框选（空间查询） — `#drawRect`
- [ ] 几何拾取（空间查询） — `#pickObjectsGeometrically`
- [ ] 位置编辑（模型操作） — `#editing`
- [ ] HTML 渲染至场景（基础标绘） — `#html2scene`
- [ ] HTML 标注-碰撞（基础标绘） — `#htmlPointCollection`
- [ ] 近地天空盒（特色功能） — `#nearGroundSkyBox`
- [ ] 粒子特效（环境模拟） — `#particleEffect`
- [ ] 水面效果（环境模拟） — `#waterPrimitive`
- [ ] 水面效果 2（环境模拟） — `#water`

### D2：中等难度 / 组合交互与基础计算

- [ ] 多地形管理（地形） — `#multiTerrain`
- [ ] 天地图地形（地形） — `#tdtTerrainProvider`
- [ ] 自定义地形（地形） — `#customterrain`
- [ ] 新海量矢量（矢量） — `#serviceLayer`
- [ ] 通视分析（空间分析） — `#sightLine`
- [ ] 剖面分析（空间分析） — `#profile`
- [ ] 面裁剪（原剖切分析）（空间分析） — `#clipping`
- [ ] 可视域分析（空间分析） — `#viewShed3d`
- [ ] 缓冲分析（空间分析） — `#bufferAnalysis`
- [ ] 淹没分析（空间分析） — `#flood`
- [ ] 淹没分析（贴地）（空间分析） — `#clampFlood`
- [ ] entity 淹没（空间分析） — `#floodEntity`
- [ ] 地形开挖（地形分析） — `#terrainClip`
- [ ] 地形抬升（地形分析） — `#topographicUplift`
- [ ] 等高线分析（地形分析） — `#elevationAnalysis`
- [ ] 坡度坡向分析（地形分析） — `#slopeAspect`
- [ ] 填挖方分析（地形分析） — `#cutOrFill`
- [ ] 模型展开（模型操作） — `#featureTranslation`
- [ ] 离线数据（IndexedDB）（内存缓存） — `#offlineDatabase`
- [ ] 视点漫游（相机控制） — `#viewRoaming`
- [ ] 鹰眼地图（相机控制） — `#hawkeye`
- [ ] 二三维联动（相机控制） — `#linkage23D`
- [ ] 卷帘对比（显示设置） — `#rollblind`
- [ ] 分屏对比（显示设置） — `#multiViewport`
- [ ] 倾斜压平（显示设置） — `#flatting`
- [ ] 地下模式（显示设置） — `#underground`
- [ ] 动态材质（场景展示） — `#dynamicMaterial`
- [ ] 环形特效（场景展示） — `#circlePrimitives`
- [ ] 多光源（场景展示） — `#multiLights`
- [ ] 景深特效（后期处理） — `#depthofField`
- [ ] 后处理颜色特效（后期处理） — `#postprocessColor`

### D3：中高难度 / 渲染、地形和多组件协同

- [ ] HDR（类虚幻引擎）（特色功能） — `#hdr`
- [ ] 体积云（特色功能） — `#volumeClouds`
- [ ] 体积光（特色功能） — `#volumetricLight`
- [ ] 稳定的级联阴影贴图（特色功能） — `#scsm`
- [ ] 六边形网格（影像栅格） — `#hexagonalGridImageryProvider`
- [ ] 立方体截图（空间分析） — `#cubeScreenShot`
- [ ] 天际线分析（空间分析） — `#skyLine`
- [ ] 控高分析（空间分析） — `#heightLimite`
- [ ] 日照分析（空间分析） — `#sunShineAnalysis`
- [ ] 建筑颜色渐变（场景展示） — `#customShaderTilesetColorGradient`
- [ ] 3DTiles 特效（场景展示） — `#customShaderTilesetEffect`
- [ ] OD 动态线（场景展示） — `#odLines`
- [ ] 向量场特效（场景展示） — `#windy`
- [ ] GTAO（后期处理） — `#gtao`
- [ ] 立体分屏（显示设置） — `#StereoMultiScreen`
- [ ] 水体效果（环境模拟） — `#waterVolume`

### D4：高难度 / 专项行业能力与外部依赖

- [ ] 播放 FLV 视频流（视频相关） — `#videoPlayFLV`
- [ ] 视频流投影（视频相关） — `#videoShadow`
- [ ] 视锥视频投放（视频相关） — `#videoPut`
- [ ] 视频投放-自定义（视频相关） — `#videoPut-custom`
- [ ] 流体模拟（环境模拟） — `#fluidPrimitive`
- [ ] 船闸通航（环境模拟） — `#fluidPrimitive2`
- [ ] 大坝泄水（环境模拟） — `#fluidPrimitive3`
- [ ] 水质污染模型（环境模拟） — `#hydroPrimitive`
- [ ] 雷达分析（空间分析） — `#radarManager`
- [ ] 拉伸（地质模型） — `#scaling`
- [ ] 实心剖切（地质模型） — `#solidClipping`
- [ ] 炸开（地质模型） — `#explosion`
- [ ] 模型编辑（OBJ 模型）（模型操作） — `#objLoader`
- [ ] `KHR_materials_specular`（高级模型材质） — `#materialsSpecular`
- [ ] `KHR_materials_emissive_strength`（高级模型材质） — `#materialsBloom`
- [ ] `KHR_materials_variants`（高级模型材质） — `#materialsVariants`
- [ ] 军事标绘（军事标绘） — `#plotEdit`
- [ ] 态势推演（军事标绘） — `#plotAnimations`

## 4. 实现原理与 Cesium 核心 API

> 本节是复刻时的技术说明模板。API 仅限选定开源 Cesium 版本的公共 API；示例名称来自原站，下面的实现均按“开源 Cesium + 自研算法”重新设计，不调用原 SDK 的类名、变量或内部实现。

### 4.1 D0：Viewer、坐标、实体和基础交互

| 功能 | 实现原理 | Cesium 核心 API | 需要掌握的底层知识 |
|---|---|---|---|
| 创建视图、无底图、参考椭球体 | 初始化渲染场景；控制 imagery/terrain 图层；用椭球模型进行经纬高与笛卡尔坐标转换 | `Viewer`、`Globe`、`Ellipsoid`、`Scene`、`Cartesian3`、`Cartographic`、`CesiumMath` | WebGL 渲染循环、WGS84 椭球、经纬高/地心地固坐标、深度测试 |
| 顶点拾取、模型拾取 | 屏幕坐标生成射线，先做实体/图元拾取，再通过深度缓冲获取地形位置 | `Scene.pick`、`Scene.drillPick`、`Scene.pickPosition`、`Camera.getPickRay`、`Globe.pick` | 射线-三角形、深度缓冲、GPU picking、模型矩阵与局部坐标 |
| 天地图注记、HTML 标注 | 地理坐标挂接 Entity 或 DOM；相机变化时同步屏幕投影和可见性 | `Entity`、`LabelGraphics`、`BillboardGraphics`、`SceneTransforms.wgs84ToWindowCoordinates` | 地理坐标到屏幕坐标、遮挡判断、视锥裁剪、DOM 与 WebGL 两套渲染层 |
| 绕中心旋转、键盘漫游、飞行管理 | 维护相机状态和控制器；用 heading/pitch/range 或位置-方向插值生成连续相机轨迹 | `Camera.lookAt`、`Camera.setView`、`Camera.flyTo`、`Camera.flyToBoundingSphere`、`ScreenSpaceCameraController`、`KeyboardEventHandler` | 相机局部坐标、四元数/航向俯仰滚转、插值和时间步进 |
| 雨、雪、雾、MP4、水面基础效果 | 粒子系统模拟降水；雾通过场景大气参数或自研屏幕后处理；视频纹理/材质贴到几何体 | `ParticleSystem`、`ParticleBasicMaterial`、`Fog`、`VideoTexture`、`Material`、`Primitive` | 粒子生命周期、纹理采样、透明混合、深度写入、GPU/CPU 分工 |
| 抗锯齿、基础热力图 | 使用 Cesium 的场景抗锯齿能力；热力图先把点聚合为栅格，再生成纹理覆盖到地表 | `Scene.msaa`、`GlobeSurfaceTileProvider`（仅公共 API 范围内）、`SingleTileImageryProvider`、`ImageryLayer` | MSAA 与后处理抗锯齿、屏幕空间栅格化、颜色插值、纹理坐标 |

### 4.2 D1：Provider、绘制、量测与单一数据源

| 功能 | 实现原理 | Cesium 核心 API | 自研重点 |
|---|---|---|---|
| 天地图、Esri、百度、SmartImagery 影像 | 将服务瓦片地址映射为 ImageryProvider，并统一图层顺序、透明度和错误处理 | `UrlTemplateImageryProvider`、`WebMapServiceImageryProvider`、`ArcGisMapServerImageryProvider`、`ImageryLayerCollection` | URL 模板、TMS/XYZ 与 WMTS 行列号、不同坐标系/偏移适配、重试与缓存 |
| 公网/ArcGIS/自定义地形 | TerrainProvider 异步请求高度瓦片并在 Globe 上进行地形网格细分 | `CesiumTerrainProvider`、`ArcGISTiledElevationTerrainProvider`、`EllipsoidTerrainProvider`、`sampleTerrainMostDetailed` | 地形瓦片层级、四叉树、裙边、法线、LOD、异步高度采样 |
| 二维矢量瓦片、PBF | 下载 PBF/GeoJSON 后按样式规则解析，生成 `Primitive`/`GroundPrimitive` 或 Entity | `Resource`、`GeoJsonDataSource`、`Primitive`、`GroundPrimitive`、`GeometryInstance` | PBF 解码、符号化规则、线面三角化、批处理、地理坐标投影 |
| 绘制几何、可编辑平面/立方体 | `ScreenSpaceEventHandler` 驱动绘制状态机；鼠标点转地理坐标，实时更新 Geometry；编辑句柄反向修改参数 | `ScreenSpaceEventHandler`、`ScreenSpaceEventType`、`CallbackProperty`、`PolygonHierarchy`、`PolylineGraphics`、`BoxGeometry`、`Plane` | 事件状态机、拖拽约束、面法线、局部坐标系、Entity 与 Primitive 生命周期 |
| 基础测量、位置编辑 | 对拾取点做笛卡尔距离、椭球面距离、高差和面积计算；编辑时实时重算 | `Cartesian3.distance`、`EllipsoidGeodesic`、`PolygonGeometry`、`HeightReference`、`CallbackProperty` | 大地线与空间直线区别、球面/椭球面积、误差与单位转换 |
| 框选、几何拾取 | 将屏幕矩形/多边形转换为选择区域，对候选对象做粗筛，再进行精确相交判断 | `Camera.computeViewRectangle`、`Scene.drillPick`、`CullingVolume` | 屏幕空间选择、包围球粗筛、射线/包围盒/三角形相交 |

### 4.3 D2：分析、动态材质、缓存和多视图

| 功能 | 实现原理 | Cesium 核心 API | 自研重点 |
|---|---|---|---|
| 通视分析 | 从观察点向目标点发射射线，沿线采样地形/模型高度，比较射线高度与障碍高度 | `Globe.getHeight`、`Globe.pick`、`Scene.pickFromRay`（若目标版本公开可用） | 采样步长、自适应采样、遮挡分类、地形与模型混合、结果分段 |
| 剖面分析 | 沿折线插值采样高度，计算距离-高程序列并绘制剖面图 | `EllipsoidGeodesic`、`sampleTerrainMostDetailed`、`PolylineGeometry` | 线性/大地线插值、异步采样合并、剖面统计、异常点处理 |
| 面裁剪、地形开挖、地形抬升 | 对 Tileset 或 Globe 设置裁剪平面/裁剪多边形；开挖区域重建边界墙或替换局部高度 | `ClippingPlane`、`ClippingPlaneCollection`、`ClippingPolygon`、`ClippingPolygonCollection`、`ClassificationPrimitive` | 平面半空间、裁剪平面方向、局部 ENU 坐标、边界封口、地形修改近似 |
| 可视域、天际线、控高、日照 | 从相机视锥或观察点构造采样/投影区域，结合深度和太阳方向计算可见性 | `PerspectiveFrustum`、`OrthographicFrustum`、`Scene.postProcessStages`、`Sun`、`ShadowMap` | 视锥体、深度比较、阴影映射、时间与太阳位置、GPU 读回代价 |
| 淹没、缓冲、等高线、坡度坡向、填挖方 | 以采样栅格/三角网为基础，计算高度阈值、距离场、梯度和体积差 | `sampleTerrainMostDetailed`、`Rectangle`、`Cartographic`、`Primitive`、`ColorGeometryInstanceAttribute` | DEM 栅格化、邻域梯度、等高线追踪、体积积分、空间索引 |
| 离线 IndexedDB | 拦截资源请求，将瓦片/结果按 URL 和版本写入浏览器数据库，离线时回退读取 | `Resource`、`RequestScheduler`（只使用公开接口）、浏览器 `IndexedDB` | 缓存键、LRU/TTL、版本迁移、并发写入、离线一致性 |
| 卷帘、分屏、二三维联动、鹰眼 | 多个视口或两个 Viewer 共享相机、图层和时间状态；卷帘通过裁剪区域控制绘制范围 | `Scene`、`Camera`、`ImageryLayer.splitDirection`、`SceneMode`、`SceneTransforms` | 多视口同步、事件防抖、渲染资源复用、2D/3D 投影差异 |
| 动态材质、环形特效、多光源 | 用 `Material`/Fabric 或 GLSL 根据 `czm_frameNumber`、纹理坐标和时间生成动画 | `Material`、`MaterialProperty`、`CallbackProperty`、`Primitive`、`CustomShader` | GLSL、uniform、时间驱动、透明排序、批次与 draw call 控制 |

### 4.4 D3：3D Tiles、后处理、复杂地形和高级渲染

| 功能 | 实现原理 | Cesium 核心 API | 面试级关键点 |
|---|---|---|---|
| HDR、体积云、体积光、级联阴影 | HDR 在高动态范围颜色空间中累积光照；体积效果通过 ray marching/噪声采样；级联阴影按距离切分视锥 | `Scene.highDynamicRange`、`PostProcessStage`、`PostProcessStageComposite`、`ShadowMap`、`CascadedShadowMap`（以目标版本公共 API 为准） | HDR/色调映射、ray marching、阴影 acne/peter-panning、级联稳定性、GPU 带宽 |
| 建筑颜色渐变、3DTiles 特效 | 在 Tileset 的 feature/style/custom shader 层读取属性或位置，计算颜色、发光和动画 | `Cesium3DTileset`、`Cesium3DTileStyle`、`Cesium3DTileFeature`、`CustomShader`、`Model` | 3D Tiles 层级裁剪、批量属性、shader 注入、uniform 组织、LOD |
| 六边形网格、向量场、OD 动态线 | 地理范围离散成规则网格/六边形；线段或粒子按时间场推进 | `Rectangle`、`PolylineGeometry`、`GroundPolylineGeometry`、`Primitive`、`ParticleSystem` | 空间离散化、GPU instancing、粒子积分、数据纹理、帧率预算 |
| 立方体截图、GTAO、景深、立体分屏 | 通过离屏 framebuffer 或多次渲染获得深度/颜色，再做屏幕空间卷积和左右眼投影 | `PostProcessStage`、`Framebuffer`、`ViewportQuad`、`Camera.frustum`、`Scene.render` | G-buffer、深度线性化、屏幕空间算法、离屏渲染、双眼视差 |
| 地形/3D Tiles 复杂分析 | 结合地形瓦片、Tileset 内容和深度缓冲，建立多阶段异步分析管线 | `Globe`、`Cesium3DTileset`、`Scene.preUpdate`、`Scene.postRender`、`JobScheduler`（公开能力范围内） | CPU/GPU 同步、异步任务、LOD 稳定性、内存峰值、结果精度 |

### 4.5 D4：专项能力、视频、流体、材质和标绘

| 功能 | 实现原理 | Cesium 核心 API | 自研/风险重点 |
|---|---|---|---|
| FLV/MP4 播放、视频流投影、视锥视频投放 | 视频解码得到纹理；按视锥投影或自定义 UV 将视频映射到平面/模型/地形 | `HTMLVideoElement`、`VideoTexture`、`Material`、`Primitive`、`Camera.frustum` | FLV 需浏览器外部解码能力；投影矩阵、UV、CORS、同步和带宽 |
| 流体模拟、船闸、大坝泄水、水质污染 | 在规则网格上执行浅水方程/粒子或对流扩散近似，再把标量场上传为纹理 | `Texture`、`Sampler`、`Material`、`Primitive`、`PostProcessStage` | 数值稳定性、CFL 条件、边界条件、GPU ping-pong、结果可视化 |
| 雷达分析 | 用雷达位置、方向、水平/垂直视场生成体积或扇形区域，并进行遮挡测试 | `PerspectiveFrustum`、`FrustumGeometry`、`Primitive`、`Scene.pick` | 坐标系、视锥体、遮挡、扫描动画、体积可视化 |
| 拉伸、实心剖切、炸开 | 把模型节点变换到局部坐标系，按楼层/节点/包围盒施加平移、缩放和裁剪 | `Model`、`Cesium3DTileset`、`ModelMatrix`、`Matrix4`、`ClippingPlaneCollection` | glTF 节点层级、模型矩阵、局部/世界坐标、动画与资源生命周期 |
| OBJ 模型编辑、高级模型材质 | 解析 OBJ/材质或转换为 glTF；用材质 uniform 和 shader 控制高光、发光和变体 | `Model.fromGltfAsync`、`Model`、`CustomShader`、`Texture`、`Matrix4` | OBJ 拓扑与材质差异、glTF PBR、shader 编译、纹理压缩与内存 |
| 军事标绘、态势推演 | 以控制点参数化符号几何，实时三角化/更新；推演由时间轴驱动实体和轨迹状态 | `Entity`、`PolygonHierarchy`、`PolylineGraphics`、`CallbackProperty`、`SampledPositionProperty`、`JulianDate`、`Clock` | 几何构造、贝塞尔/样条插值、拓扑合法性、时间系统、批量更新性能 |

## 5. 学习与面试输出要求

每完成一个示例，不只记录“能运行”，还要产出以下四项，形成可用于高级三维岗位面试的技术证据：

1. **坐标链路**：输入数据坐标系 → Cesium 世界坐标 → 局部 ENU/模型坐标 → 屏幕坐标；明确每次转换使用的矩阵或椭球方法。
2. **渲染链路**：CPU 准备什么数据、GPU 绘制什么资源、深度/颜色如何产生、是否有 framebuffer、shader 和后处理阶段。
3. **算法说明**：自研算法的输入、核心公式/伪代码、复杂度、误差来源和可替代方案；不能只写“调用分析 API”。
4. **工程指标**：数据量、加载时间、稳定帧率、显存/内存峰值、取消与销毁策略，以及无服务/空数据/低性能设备下的降级方案。

### 建议面试题清单

- Cesium 的 Entity、Primitive、GroundPrimitive、3D Tiles 分别适合什么场景？如何控制 draw call 和更新成本？
- `Cartesian3`、`Cartographic`、`Matrix4`、ENU 坐标之间如何转换？为什么不能直接对经纬度做欧氏距离？
- `Scene.pick`、`drillPick`、`pickPosition` 和 `Globe.pick` 的数据来源与限制分别是什么？
- 地形四叉树如何做 LOD、瓦片裁剪和高度采样？为什么地形分析必须考虑异步加载和采样精度？
- 3D Tiles 的层级裁剪、屏幕空间误差、批量属性和 `CustomShader` 如何共同影响性能？
- 如何实现通视、可视域、剖面、坡度坡向和填挖方？哪些步骤在 CPU，哪些步骤适合 GPU？
- 后处理中的颜色纹理和深度纹理分别是什么？如何进行深度线性化、景深、GTAO 或体积效果？
- 如何避免相机事件、`CallbackProperty`、post-process stage、Primitive 和 GPU 纹理泄漏？
- 在线瓦片服务、IndexedDB 缓存和离线回退如何设计一致的缓存键、版本和错误恢复策略？
- 如果要求完全不依赖第三方 SDK，如何从公共 Cesium API 设计一个可测试的分析/标绘模块？

## 6. 功能模块索引（保留原始模块归属）

### 6.1 P0：基础功能、数据加载与通用交互

#### 特色功能

- [ ] **P0** HDR（类虚幻引擎） — `#hdr`
- [ ] **P1** 体积云 — `#volumeClouds`
- [ ] **P1** 体积光 — `#volumetricLight`
- [ ] **P1** 近地天空盒 — `#nearGroundSkyBox`
- [ ] **P1** 稳定的级联阴影贴图 — `#scsm`

#### 基础功能

- [ ] **P0** 创建视图 — `#viewer`
- [ ] **P0** 顶点拾取 — `#vertexPicking`
- [ ] **P0** 参考椭球体 — `#ellipsoid`

#### 在线绘制与量测

- [ ] **P0** 绘制几何 — `#draw`
- [ ] **P0** 绘制可编辑平面 — `#drawEditablePlane`
- [ ] **P0** 绘制可编辑立方体 — `#drawEditableCube`
- [ ] **P0** 基础测量 — `#measure`

#### 在线底图

- [ ] **P0** 天地图底图 — `#tiandituBaseMap`
- [ ] **P1** esri 底图 — `#esriBaseMap`
- [ ] **P1** 百度底图 — `#baiduBaseMap`
- [ ] **P0** 天地图矢量底图 — `#tiandituvecBaseMap`
- [ ] **P0** 天地图注记 — `#tiandituzjBaseMap`
- [ ] **P1** 深色底图（可配） — `#darkImageryLayer`
- [ ] **P1** 天地图地名标注（三维） — `#tdtPlaceName`
- [ ] **P0** 无底图 — `#noneBaseMap`

#### 图层加载 / 影像栅格

- [ ] **P0** SmartImagery 影像 — `#layerInfoImageryMap`
- [ ] **P1** ArcGIS MapServer 4490 影像 — `#arcgis-4490`
- [ ] **P1** WMS 单图加载 — `#wms-single`
- [ ] **P2** 六边形网格 — `#hexagonalGridImageryProvider`

#### 地形

- [ ] **P0** 公网地形 — `#terrain`
- [ ] **P1** ArcGIS 地形 — `#esriterrain`
- [ ] **P1** 多地形管理 — `#multiTerrain`
- [ ] **P1** 天地图地形 — `#tdtTerrainProvider`
- [ ] **P1** 自定义地形 — `#customterrain`

#### 矢量

- [ ] **P0** 二维矢量瓦片底图 — `#vector2`
- [ ] **P1** 新海量矢量 — `#serviceLayer`
- [ ] **P1** PBF 矢量样式数据 — `#pbf`
- [ ] **P2** KMZ 全球经济 — `#globeKmz`

### 6.2 P0/P1：查询、分析与地形分析

#### 空间查询

- [ ] **P0** 框选 — `#drawRect`
- [ ] **P0** 几何拾取 — `#pickObjectsGeometrically`

#### 空间分析

- [ ] **P0** 通视分析 — `#sightLine`
- [ ] **P1** 可视域分析 — `#viewShed3d`
- [ ] **P0** 剖面分析 — `#profile`
- [ ] **P1** 立方体截图 — `#cubeScreenShot`
- [ ] **P1** 面裁剪（原剖切分析） — `#clipping`
- [ ] **P1** 天际线分析 — `#skyLine`
- [ ] **P1** 控高分析 — `#heightLimite`
- [ ] **P1** 日照分析 — `#sunShineAnalysis`
- [ ] **P1** 淹没分析 — `#flood`
- [ ] **P1** 淹没分析（贴地） — `#clampFlood`
- [ ] **P1** entity 淹没 — `#floodEntity`
- [ ] **P1** 缓冲分析 — `#bufferAnalysis`
- [ ] **P2** 雷达分析 — `#radarManager`

#### 地形分析

- [ ] **P1** 地形开挖 — `#terrainClip`
- [ ] **P1** 地形抬升 — `#topographicUplift`
- [ ] **P1** 填挖方分析 — `#cutOrFill`
- [ ] **P1** 等高线分析 — `#elevationAnalysis`
- [ ] **P1** 坡度坡向分析 — `#slopeAspect`

### 6.3 P1/P2：环境、可视化与场景表达

#### 视频相关

- [ ] **P2** 播放 FLV 视频流 — `#videoPlayFLV`
- [ ] **P1** 播放 MP4 视频文件 — `#videoPlayMP4`
- [ ] **P2** 视频流投影 — `#videoShadow`
- [ ] **P2** 视锥视频投放 — `#videoPut`
- [ ] **P2** 视频投放-自定义 — `#videoPut-custom`

#### 环境模拟（特效）

- [ ] **P1** 雨 — `#rainEffect`
- [ ] **P1** 雪 — `#snowEffect`
- [ ] **P1** 雾 — `#fogEffect`
- [ ] **P1** 粒子特效 — `#particleEffect`
- [ ] **P1** 水面效果 — `#waterPrimitive`
- [ ] **P1** 水面效果 2 — `#water`
- [ ] **P1** 水体效果 — `#waterVolume`
- [ ] **P2** 流体模拟 — `#fluidPrimitive`
- [ ] **P2** 船闸通航 — `#fluidPrimitive2`
- [ ] **P2** 大坝泄水 — `#fluidPrimitive3`
- [ ] **P2** 水质污染模型 — `#hydroPrimitive`

#### 热力图

- [ ] **P1** 热力图 — `#heatmap`

#### 场景展示

- [ ] **P1** 多光源 — `#multiLights`
- [ ] **P1** 建筑颜色渐变 — `#customShaderTilesetColorGradient`
- [ ] **P1** 3DTiles 特效 — `#customShaderTilesetEffect`
- [ ] **P1** OD 动态线 — `#odLines`
- [ ] **P1** 动态材质 — `#dynamicMaterial`
- [ ] **P1** 环形特效 — `#circlePrimitives`
- [ ] **P2** 向量场特效 — `#windy`

#### 后期处理

- [ ] **P1** 景深特效 — `#depthofField`
- [ ] **P1** 后处理颜色特效 — `#postprocessColor`
- [ ] **P0** 抗锯齿 — `#anti-alias`
- [ ] **P2** GTAO — `#gtao`

#### 显示设置

- [ ] **P1** 卷帘对比 — `#rollblind`
- [ ] **P1** 分屏对比 — `#multiViewport`
- [ ] **P2** 立体分屏 — `#StereoMultiScreen`
- [ ] **P1** 倾斜压平 — `#flatting`
- [ ] **P1** 地下模式 — `#underground`

### 6.4 P0/P1：相机、缓存、模型与标绘

#### 相机控制

- [ ] **P1** 鹰眼地图 — `#hawkeye`
- [ ] **P1** 二三维联动 — `#linkage23D`
- [ ] **P0** 绕中心旋转 — `#cameraRotationTool`
- [ ] **P0** 键盘漫游 — `#roam`
- [ ] **P1** 视点漫游 — `#viewRoaming`
- [ ] **P0** 飞行管理 — `#fly`

#### 内存缓存

- [ ] **P1** 离线数据（IndexedDB） — `#offlineDatabase`

#### 地质模型

- [ ] **P2** 拉伸 — `#scaling`
- [ ] **P2** 实心剖切 — `#solidClipping`
- [ ] **P2** 炸开 — `#explosion`

#### 模型操作

- [ ] **P0** 模型拾取 — `#pick`
- [ ] **P1** 模型展开 — `#featureTranslation`
- [ ] **P2** 模型编辑（OBJ 模型） — `#objLoader`
- [ ] **P0** 位置编辑 — `#editing`

#### 高级模型材质

- [ ] **P2** `KHR_materials_specular` — `#materialsSpecular`
- [ ] **P2** `KHR_materials_emissive_strength` — `#materialsBloom`
- [ ] **P2** `KHR_materials_variants` — `#materialsVariants`

#### 基础标绘

- [ ] **P0** HTML 标注 — `#htmlPoint`
- [ ] **P1** HTML 渲染至场景 — `#html2scene`
- [ ] **P1** HTML 标注-碰撞 — `#htmlPointCollection`

#### 军事标绘

- [ ] **P2** 军事标绘 — `#plotEdit`
- [ ] **P2** 态势推演 — `#plotAnimations`

## 7. 复刻时需要先统一的技术基座

| 基座 | 要求 | 影响范围 |
|---|---|---|
| Sandcastle 示例模板 | 每个示例有 `startup(viewer)`、清理函数和可重复执行机制 | 全部 |
| Viewer 配置 | token、默认视角、地形、底图、时钟、深度检测统一管理 | 全部 |
| 服务适配层 | 使用 Cesium 公共 Provider API，自研统一适配层；服务地址参数化，不依赖 SmartGIS 私有接口 | 底图、图层、地形 |
| 交互工具层 | 屏幕坐标/地理坐标转换、绘制状态机、拾取、编辑句柄、销毁 | 绘制、查询、分析、模型 |
| 数据与实体层 | Entity、Primitive、3D Tiles、GeoJSON/KML/KMZ/PBF 的加载和清理约定 | 图层、模型、可视化 |
| 分析结果层 | 优先自研几何/栅格/地形分析算法；结果图元、标签、统计值、导出/截图及取消操作统一生命周期 | 查询、空间分析、地形分析 |
| 特效层 | 使用 Cesium 公共 post-process、particle、material、shader API，自研效果算法与参数面板 | 环境、场景、后期处理 |
| 验证基线 | Chrome/Edge；无 token、服务超时、空数据、重复点击、切换示例、销毁后无残留 | 全部 |

## 8. P0 里程碑与验收

### M0：可运行示例壳

- [ ] Sandcastle 中按上述一级模块建立导航。
- [ ] 示例可独立运行、重复运行、切换运行，旧实体/监听器/后处理不会残留。
- [ ] 服务地址、token、默认视角和测试数据集中配置。
- [ ] 服务不可用时显示可理解的错误，不阻塞其他本地示例。

### M1：数据加载与基础交互

- [ ] 底图/注记/无底图切换；影像、地形、矢量和 3D Tiles 至少各有一个可用样例。
- [ ] 绘制点、线、面、矩形、平面、立方体，并支持完成、取消、清理。
- [ ] 点/顶点/模型拾取、位置编辑、基础量测可复现。
- [ ] 相机飞行、旋转、键盘漫游和抗锯齿示例可切换。

### M2：基础分析与交付质量

- [ ] 框选、几何拾取、通视、剖面、基础地形/模型分析至少各有一个完整闭环。
- [ ] 每个示例标注数据依赖、适用坐标系、性能风险和已知限制。
- [ ] 完成一次全量回归：加载、交互、清理、刷新和无服务配置场景。

## 9. 风险、依赖与待确认项

- **服务依赖**：SmartImagery、SmartGIS 矢量、地形、视频及部分在线底图可能需要账号、token 或内网服务；复刻前需准备脱敏的测试服务或本地 fixture。
- **实现边界**：原站示例中依赖南方 SDK 的扩展类、参数、内置变量或服务均视为不可用；逐项改写为“Cesium 公共 API / 自研算法 / 自建数据源”，禁止通过变量名、类名或调用链复刻其私有实现。
- **版本差异**：仅针对项目选定的开源 Cesium 版本验证公共 API；优先记录“Cesium 公共 API 可实现 / 需要自研算法 / 暂不纳入”。
- **坐标与数据格式**：重点确认 4490、WGS84、WebMercator、地形高度采样和服务轴序，避免示例能显示但分析结果偏移。
- **性能**：体积云、体积光、流体、向量场、GTAO、视频投影和大规模标绘需要单独设定帧率、显存和数据量基线。
- **许可证与资源**：底图、模型、视频、字体和示例数据在进入公开 Sandcastle 前需确认授权。
- **代码溯源**：每个 task 记录使用的 Cesium 公共 API、算法出处/设计说明和数据许可证；代码审查时检查依赖清单，确保不存在南方 SDK 包、私有变量或内置服务地址。

## 10. 统计

- 一级功能模块：**10**
- 页面示例功能组：**23**
- 已整理示例入口：**108 项**（以页面当前目录为准；后续若站点目录变化，应重新抓取并核对）
- 建议优先交付：**P0 → P1 → P2**，每个阶段都要求示例可独立运行和可清理。
