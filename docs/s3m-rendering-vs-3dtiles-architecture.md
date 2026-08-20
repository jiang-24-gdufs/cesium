# CBD S3M 与 Cesium 3D Tiles：渲染原理、架构和断点对照

> 本文以本地 CBD 示例的实际链路为 S3M 侧事实来源，并与本仓库的 [3D Tiles 渲染调试指南](./debug-3dtiles-rendering.md)、[Tileset 与 Tile 的对象关系](./cesium3dtileset-vs-tile.md)及当前 `packages/engine/Source` 源码对照。文中“3D Tiles”特指 CesiumJS 内置 `Cesium3DTileset` 运行时；“S3M”特指相邻 `s3m-spec/S3M_SDK/S3M_JS` 中的 JavaScript SDK。

## 结论先行

S3M 和 3D Tiles 并不是两套完全无关的渲染思想。两者都把一个数据集作为 Cesium scene primitive，在每帧依据相机做 **可见性/LOD 选择 → 请求 → CPU/GPU 处理 → 向 `frameState.commandList` 提交命令**。CBD 的真实运行路径已验证为：

```text
cbd.scp (JSON) → OSGBCacheFile → 根 .s3mb → S3MCacheFileRenderEntity → DrawCommand
```

真正的差异在于“瓦片树与内容的表达方式”和“谁拥有运行时”：

| 维度 | CBD S3M SDK | Cesium 3D Tiles |
| --- | --- | --- |
| 数据集级运行时 | `S3MTilesLayer` | `Cesium3DTileset` |
| 逻辑节点 | `S3MTile` + 当前包内 `S3MPageLod` | `Cesium3DTile` |
| 顶层入口 | `cbd.scp`（本例后缀为 SCP、内容为 JSON） | `tileset.json` |
| 内容格式 | S3MB：一个二进制包中含 group、geometry、纹理、材质、pick 数据 | b3dm/i3dm/pnts/glb/gltf/cmpt/subtree/外部 tileset 等多态内容 |
| 内容运行时 | `S3MContentParser` + `S3MContentFactory` + `RenderEntity` | `Cesium3DTileContentFactory` + `Cesium3DTileContent`（常落到 `Model3DTileContent`/`Model`） |
| LOD 度量 | 每个 `S3MPageLod` 的 Distance / Pixel / GeometryError `rangeData` | 每个 `Cesium3DTile.geometricError` 投影为 SSE，并与 tileset 的动态 SSE 阈值比较 |
| 细化语义 | 当前 SDK 由 `pageLod.canRefine` 和子 `.s3mb` 是否 READY 驱动，未实现 3D Tiles 那样显式的 ADD/REPLACE 通用策略 | 规范化 `ADD` / `REPLACE`，并支持 skip-LOD、隐式树和外部树 |
| 渲染资源 | SDK 直接创建 Cesium `Buffer`、`VertexArray`、`ShaderProgram`、`DrawCommand` | Content/Model 管线创建并更新命令；Tileset 统一处理 style、clipping、统计和各 pass |

因此应把 S3M 理解为：**借用 Cesium 渲染器与 FrameState，但自行实现“类似 3D Tileset”的格式适配和 tile 运行时。** 它不是 `Cesium3DTileset` 的一种 Content，也不会进入 `Cesium3DTileContentFactory`。

## 1. 共用的 Cesium 帧循环底座

两者加入 `scene.primitives` 后，都会由 Cesium 在每帧调用生命周期方法，并最终把 `DrawCommand` 放进同一个 `frameState.commandList`。后续的 command 排序、render/pick pass 与 WebGL 执行仍由 Cesium 统一完成。

```text
Cesium Scene / PrimitiveCollection / FrameState
        │
        ├─ S3M：S3MTilesLayer
        │     ├─ prePassesUpdate(frameState)
        │     ├─ update(frameState)
        │     └─ postPassesUpdate(frameState)
        │
        └─ 3D Tiles：Cesium3DTileset
              ├─ prePassesUpdate(frameState)
              ├─ updateForPass(frameState, passState)
              └─ postPassesUpdate(frameState)
                         │
                         ▼
                 frameState.commandList: DrawCommand[]
```

这一点解释了两条链路中都能看到 `scene._context`、`frameState.camera`、`frameState.cullingVolume`、`jobScheduler` 和 `frameState.commandList`。区别不是“谁调用 WebGL”，而是**调用 WebGL 前如何组织内容、选择 LOD 和管理资源**。

3D Tiles 为多种 pass 显式提供 `updateForPass`；S3M layer 的 `update` 直接判断 `frameState.passes.pick` 与 `selectEnabled`。这意味着 3D Tiles 在 pass、样式、clipping、统计等框架集成上更深，而当前 S3M SDK 更接近一个使用 Cesium 私有渲染 API 的专用 primitive。

## 2. CBD 的 S3M 实际架构

CBD 入口见 [CBD.html](../../s3m-spec/S3M_SDK/S3M_JS/CBD.html)。它传入 `scene._context` 和 `./data/CBD/cbd.scp` 来创建 `S3MTilesLayer`。配置中的 `extensions["s3m:FileType"]` 是 `OSGBCacheFile`，所以内容工厂实际选择的是 `S3MCacheFileRenderEntity`，不是 `OSGBFile` 对应的 Oblique 实体。

```text
CBD.html
  └─ S3MTilesLayer                         数据集级 primitive / 调度器
       ├─ loadConfig(cbd.scp)
       │    └─ rootTiles: S3MTile[]         从 config.tiles 创建根节点
       ├─ S3MLayerScheduler                 每帧遍历与队列填充
       │    ├─ _requestTiles
       │    ├─ _processTiles
       │    └─ _renderQueue
       ├─ S3MTile                           一个 .s3mb 文件及其状态
       │    └─ S3ModelParser.parseBuffer
       │         ├─ groupNode.pageLods      当前 S3MB 声明的子 LOD 与 geode 引用
       │         ├─ geoPackage              顶点/索引/实例/pick 数据
       │         ├─ texturePackage          内嵌纹理数据
       │         └─ materials
       ├─ S3MContentParser
       │    └─ S3MContentFactory[OSGBCacheFile]
       │         └─ S3MCacheFileRenderEntity
       │              ├─ VertexBuffer / IndexBuffer / ShaderProgram
       │              ├─ VertexArray / BatchTable
       │              └─ DrawCommand
       └─ S3MLayerCache                     LRU 风格的 tile 资源回收
```

### 2.1 配置树与内容内树：S3M 的两层树

CBD 配置 [cbd.scp](../../s3m-spec/S3M_SDK/S3M_JS/data/CBD/cbd.scp) 只给出根 tile 的 URL、包围盒和数据集元信息。根 S3MB 下载后，`S3ModelParser.parseBuffer()` 解析其中的 `groupNode.pageLods`；`S3MContentParser.parse()` 将它们变成 page LOD，随后 `S3MTile` 才按 `childTile` 惰性创建子 tile。

所以 S3M 的树并非全部在顶层配置中显式出现：

```text
cbd.scp.tiles[0]
  └─ root S3MTile (.s3mb)
       └─ S3MB groupNode.pageLods[]
            ├─ 当前包内 geodes → RenderEntity[]
            └─ childTile 字符串 → 下一层 S3MTile (.s3mb)
```

这是一种“**数据集配置定位根节点，二进制内容继续描述细化关系**”的设计。`Tile_-14624_42667_0000.json` 可用于离线查看导出的 LOD 树，但运行时 JS SDK 以 S3MB 解析出的 page LOD / `childTile` 为准。

### 2.2 3D Tiles 的树与内容分离更明确

3D Tiles 则先由 `tileset.json` 的 `root`/`children` 建立 `Cesium3DTile` 逻辑树；每个节点用 `content.uri` 或 `contents[]` 引用内容。显式树能在顶层 JSON 建完，隐式切片和外部 tileset 则在 Content 下载后扩展树。

```text
tileset.json
  └─ Cesium3DTileset
       └─ root Cesium3DTile
            ├─ children[]                显式 JSON 节点
            ├─ content.uri / contents[]  内容地址
            └─ implicit / external content
                 └─ 在内容处理后继续扩树
```

这使 3D Tiles 的“节点描述”和“内容实现”解耦：一个 `Cesium3DTile` 可以是空空间节点、普通模型/点云内容节点、外部 tileset 节点或 implicit subtree 占位节点。相反，当前 S3M SDK 的内容工厂只按数据集 `fileType` 分流 `OSGBFile` 与 `OSGBCacheFile`，其格式分支较集中。

## 3. 每帧渲染链路：一一对应

### 3.1 调度、请求、处理、提交

| 阶段 | CBD S3M | Cesium 3D Tiles | 关键含义 |
| --- | --- | --- | --- |
| 帧前处理 | `S3MTilesLayer.prePassesUpdate` 清空本帧请求/处理/渲染队列、重置 cache | `Cesium3DTileset.prePassesUpdate` 先处理 `_processingQueue`、更新 clipping/动态 SSE、重置 cache | 两者都把完成网络请求后的 GPU 处理放在渲染循环内推进 |
| 选择 | `S3MLayerScheduler.schedule` | `getTraversal(...).selectTiles` | 可见性、LOD 和优先级先决定本帧要请求和要画什么 |
| 请求 | `requestTiles` → `S3MTile.requestContent` → `fetchArrayBuffer` | `requestTiles` → `Cesium3DTile.requestContent` → `fetchArrayBuffer` | 都使用 Cesium `Request` 限流、服务器限流和 priority function |
| CPU 内容构造 | `S3ModelParser.parseBuffer` + `S3MContentParser.parse` | `preprocess3DTileContent` + `Cesium3DTileContentFactory` + 各 Content 构造 | S3M 解析单一 S3MB 体系；3D Tiles 按内容 magic/JSON 类型分发 |
| GPU 处理 | `S3MTile.transformResource` → RenderEntity 创建 buffer/shader/command | `processTiles` → `tile.process` → `content.update`，直到 READY | 3D Tiles 有显式 `PROCESSING` 状态；S3M 用 render entity 的 `ready` 聚合判断 |
| 命令提交 | `S3MCacheFileRenderEntity.update` push `colorCommand` / edge command | `updateTiles` → `tile.update` → `content.update` push command | 最终都落到同一 `frameState.commandList` |
| 帧后回收 | `S3MLayerCache.unloadTiles` | 取消离屏请求、`Cesium3DTilesetCache.unloadTiles` | 都按访问/内存回收；3D Tiles 还处理加载进度、style dirty 和请求取消 |

对应的调用图如下：

```text
S3M                                                3D Tiles
──────────────────────────────────────            ─────────────────────────────────────────
S3MTilesLayer.update                               Cesium3DTileset.updateForPass
  ├─ scheduler.schedule                              ├─ traversal.selectTiles
  ├─ requestTiles                                    ├─ requestTiles
  │   └─ S3MTile.requestContent                      │   └─ Cesium3DTile.requestContent
  │       └─ parseBuffer + ContentParser             │       └─ preprocess + ContentFactory
  ├─ processTiles                                    ├─ prePassesUpdate: processTiles
  │   └─ tile.transformResource                      │   └─ tile.process → content.update
  └─ updateTiles                                     └─ updateTiles
      └─ RenderEntity.update                             └─ tile.update → content.update
          └─ commandList.push                                 └─ commandList.push
```

一个重要的时序区别是：S3M 在 layer 的 `update` 内部依次执行 `schedule → request → process → update`；3D Tiles 的 `processTiles` 在 `prePassesUpdate`，而本 pass 的选择、请求和 `updateTiles` 在 `updateForPass` 中完成。两者最终都跨帧：网络 Promise 返回不代表 GPU 已准备好。

### 3.2 为什么 `readyPromise` 不是“模型已经画出来”

CBD 的 `S3MTilesLayer.readyPromise` 在配置读取、根 `S3MTile` 建立后 resolve；随后才依据相机发起 `.s3mb` 请求。3D Tiles 的 `fromUrl()` 也先完成 tileset JSON 与根树建立，但内容仍按需加载。两边都应把“**元数据/树已建立**”和“**可绘制内容 READY**”分开观测。

推荐观察的 S3M 层级为：`layer.ready` → `tile.contentState` → `renderEntity.ready` → `colorCommand`；3D Tiles 对应为：`tileset.root` → `tile._contentState` → `tile.contentReady` → 本帧 command 数。

## 4. LOD 核心原理：Pixel 阈值与 SSE 阈值

### 4.1 S3M：每个 PageLOD 的 range 条件

`S3MPageLod.update()` 同时支持三种 range mode：

```text
Distance:       distanceToCamera * lodRangeScale < rangeData
Pixel:          projectedPixelRadius > rangeData * lodRangeScale
GeometryError:  projectedGeometricError > 16 * lodRangeScale
```

CBD 的重点通常是 Pixel 模式。它将 page LOD 包围球半径投影为屏幕像素值：

```text
pixel = (drawingBufferHeight / 2 / tan(fovy / 2)) × radius / distanceToCamera
canRefine = pixel > rangeData × lodRangeScale
```

`canRefine` 为真时，调度器尝试创建/更新子 `S3MTile`；孩子未准备好时仍保留父 page LOD 的 render entities，孩子 READY 后才继续向下遍历。这构成了 CBD 实际呈现的渐进细化与回退行为。

### 4.2 3D Tiles：SSE 是“几何误差投影”

3D Tiles 的典型判断为：

```text
screenSpaceError = geometricError × drawingBufferHeight
                   / (distanceToCamera × sseDenominator × pixelRatio)

canTraverse = screenSpaceError > memoryAdjustedScreenSpaceError
```

其中 `geometricError` 是 `tileset.json`/tile header 定义的几何误差，阈值来自 tileset 的 `maximumScreenSpaceError`，并会因缓存内存压力调整为 `memoryAdjustedScreenSpaceError`。3D Tiles 的 LOD 因而具有一个更明确的、数据集统一的误差语义；CBD S3M 更多依赖各 PageLOD 写入的 `rangeData` 与 range mode。

### 4.3 不能把两者参数直接等价换算

`S3MTilesLayer.lodRangeScale` 和 `Cesium3DTileset.maximumScreenSpaceError` 都会影响“何时更细”，但不能按一个固定比例互相换算：

- S3M 的 Pixel range 用的是该 page LOD 的包围球半径和文件内阈值；Distance range 甚至不计算投影误差。
- 3D Tiles SSE 基于生产端声明的 `geometricError`，还会受 `pixelRatio`、动态 SSE、foveated loading、memory-adjusted SSE 和 refine 策略影响。
- 若要对同一数据做性能/画质比较，应该记录相机位置、屏幕尺寸、当前选择的 tile 数、请求数、GPU 内存和最终 command 数，而不是只比较一个阈值参数。

## 5. 内容解析与材质：S3MB 对 glTF/3D Tile Content

### 5.1 S3M：解析器直接生成 WebGL 所需描述

`S3ModelParser.parseBuffer()` 读取版本和压缩头后，依序解析 `groupNode`、`skeleton`（几何/顶点包）、`texturePackage`、`material` 和 `pickInfo`。`S3MContentParser` 随后：

1. 将材料转换成 `MaterialPass`；
2. 将内嵌纹理交给 `DDSTexture` / CRN 转码 / WebP 异步创建；
3. 将 geode + vertex package + index package 构造为 `RenderEntity`；
4. 由 entity 在渲染循环内创建 `Buffer`、`VertexArray`、`ShaderProgram` 和 `DrawCommand`。

所以 S3MB 解析结果已经非常贴近渲染硬件数据布局。CBD 的 `S3MCacheFileRenderEntity` 还在创建 command 前建立 `BatchTable`/pick id，并根据材质透明度决定 `CESIUM_3D_TILE` 或 `TRANSLUCENT` pass。

### 5.2 3D Tiles：先选择 Content，再进入模型管线

`Cesium3DTileContentFactory` 根据下载内容的 magic/JSON 类型创建内容对象。例如 b3dm、i3dm、pnts、glb/gltf 会转入 `Model3DTileContent`，而 cmpt、subtree、外部 tileset 会转入不同 Content。`Model3DTileContent.fromB3dm()` 进一步调用 `Model.fromB3dm()`，由 Cesium 的 Model/glTF 管线负责后续资源与命令生成。

这带来两个架构后果：

- 3D Tiles 的 Tile 调度层不需要理解每一种模型二进制布局；它只管理一个统一的 Content 生命周期。
- S3M 当前 SDK 的 Tile 调度层与 S3MB 的几何/材质组织更紧耦合。新增一种 S3M 文件类型或渲染模型，通常要同时扩展 `S3ModelParser`、`S3MContentParser` 和 Content Factory/RenderEntity。

## 6. GPU 与命令：同一个终点，不同的抽象边界

```text
S3M CPU parse data
  → S3MCreateVertexJob / S3MCreateIndexJob
  → Cesium.Buffer / VertexArray / ShaderProgram
  → S3MCacheFileRenderEntity.createCommand
  → Cesium.DrawCommand

3D Tiles content
  → Model3DTileContent / Model pipeline
  → Model 的 render resources / pipeline stages
  → Cesium DrawCommand（可能不止一条）
  → frameState.commandList
```

S3M 的好处是数据格式到 shader uniform、attribute 与 DrawCommand 的路径短，适合直接调试压缩顶点、DXT/CRN/WebP 纹理、选取和行业数据的渲染规则。代价是它直接使用了 `Queue`、`BatchTable`、`TileBoundingSphere` 等 Cesium 非稳定/内部导出；CBD SDK 因此被限制在 Cesium 1.133.x 或更早的 Build。

3D Tiles 内置实现也会使用大量 engine 内部设施，但应用和 3D Tiles 数据格式面对的是稳定的 `Cesium3DTileset`/Content/Model 抽象。升级 Cesium 时，它的内部 Model 渲染重构通常不要求数据集加载方改写自己的 tile primitive。

## 7. 缓存、错误与资源生命周期

| 主题 | S3M SDK | Cesium 3D Tiles |
| --- | --- | --- |
| 触碰缓存 | scheduler 对可见 tile 调用 `S3MLayerCache.touch` | traversal 对访问节点 `touchTile`，Tileset cache 保持 LRU 访问顺序 |
| 释放位置 | `S3MTilesLayer.postPassesUpdate` 调 `S3MLayerCache.unloadTiles`，tile `free()` 销毁 page LOD entity | `Cesium3DTileset.postPassesUpdate` 取消离屏请求并回收 cache；`unloadContent()` 释放内容 |
| 内存策略 | `maximumMemoryUsage` / `totalMemoryUsageInBytes` 参与 cache 条件；当前 CBD SDK 需额外核实内存统计写入者 | `cacheBytes + maximumCacheOverflowBytes` 限制 processing，并可动态提高 SSE 降低精度 |
| 请求取消 | 失败分支能识别 `RequestState.CANCELLED` 并回到 UNLOADED；现有代码对普通请求失败的 reject 处理较弱 | 明确维护 in-flight 队列，帧后取消离屏 LOADING 请求，并维护 pending/processing 统计与失败事件 |
| 内容状态 | `UNLOADED → LOADING →（解析完成）→ READY`，并依赖 entity `ready` 聚合 | `UNLOADED → LOADING → PROCESSING → READY`，另有 EXPIRED/FAILED 语义 |

### 源码审阅注意：S3M 的中间状态名称不一致

当前 SDK 的 `ContentState.js` 定义的是 `PARSING`，而 `S3MTile.js` 和 `S3MLayerScheduler.js` 实际读写的是 `ContentState.LOADED`。在 JavaScript 中未定义的属性值同为 `undefined`，因此当前比较仍可能“碰巧”工作，但这是一个脆弱的命名不一致，不应当作为架构设计本身理解。调试 CBD 的状态机时，优先观察数值、网络与 `renderEntity.ready`，并将这一处记录为后续独立修复项。

## 8. 断点一对一映射

| 研究问题 | CBD S3M 断点与观察 | 3D Tiles 对应断点与观察 |
| --- | --- | --- |
| 数据集入口怎样建树 | `S3MTilesLayer.loadConfig`：`config.tiles`、`fileType`、`modelMatrix` | `Cesium3DTileset.fromUrl` / `loadTileset`：`tilesetJson.root`、`root`、`geometricError` |
| 为什么这个节点可见 | `S3MTile.updateVisibility`：`distanceToCamera`、`visibilityPlaneMask`、`visible` | `Cesium3DTile.updateVisibility`：`_distanceToCamera`、`_screenSpaceError`、`_visible` |
| 为什么继续细化 | `S3MPageLod.update`：`rangeMode`、`rangeData`、`pixel`、`canRefine` | `Cesium3DTilesetTraversal.canTraverse`：`_screenSpaceError`、`memoryAdjustedScreenSpaceError`、`refine` |
| 请求的文件是什么 | `S3MTile.requestContent`：`relativePath`、`contentResource.url`、`priority` | `Cesium3DTile.requestContent` / `requestSingleContent`：`_contentResource.url`、`_priority`、Request 状态 |
| 字节如何变成内容 | `S3ModelParser.parseBuffer`：`version`、`groupNode`、`geoPackage`、`texturePackage` | `Cesium3DTile.makeContent` + Content Factory：`preprocessed.contentType`、创建的 Content 类 |
| 为什么还没能画 | `S3MTile.transformResource`：每个 `ro.ready`，以及 vertex/index/shader 队列 | `Cesium3DTile.process`：`_contentState`、`content.ready`、processing queue |
| 哪一行真正提交命令 | `S3MCacheFileRenderEntity.update`：`colorCommand`、`commandList.length` | `Cesium3DTile.update`：调用前后的 `commandList.length`；继续进 `content.update` / Model |
| 纹理/材质不对 | `S3MContentParser.parseMaterial`：`compressType`、`textures`、`MaterialPass` | `Model3DTileContent` / Model pipeline：glTF、feature/metadata、model render resources |

高频函数不宜无条件断下。首次观察推荐的条件为：

```js
// S3M：只在第一次出现请求时暂停
layer._requestTiles.length > 0

// 3D Tiles：只在有待请求节点时暂停
tileset._requestedTiles.length > 0
```

## 9. 建议的研究路径

1. **先跑通相同问题的两条路径。** 在 CBD 用 Network + P0 断点确认 `cbd.scp → .s3mb → DrawCommand`；在 3D Tiles 示例确认 `tileset.json → content → DrawCommand`。
2. **第二步只研究 LOD。** 固定相机、屏幕尺寸和 `lodRangeScale`/SSE，记录选择树、请求 URL、命令数和内存，避免把格式差异和 LOD 差异混在一起。
3. **第三步进入内容。** S3M 从 `S3ModelParser.parseBuffer` 对照 `s3m-spec/Specification/S3MB/`；3D Tiles 从 Content Factory 进入 `Model3DTileContent` 与 Model/glTF 管线。
4. **最后研究特性。** 选择/BatchTable、透明和压缩纹理属于 CBD 的高价值路径；3D Tiles 的 style、metadata、implicit tiling、multiple contents、external tileset 和 skip-LOD 属于其通用框架路径。

这样建立的不是“两个格式字段表”，而是一个可验证的架构映射：每个结论都能回到一个数据文件、一个源码断点和一帧中的 command 结果。

## 10. 核心源码索引

### CBD S3M SDK

- [S3MTilesLayer.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTilesLayer.js)：`loadConfig`、`update`、帧前/后生命周期。
- [S3MLayerScheduler.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MLayerScheduler.js)：可见性、PageLOD 遍历、请求/处理/渲染队列。
- [S3MTile.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTile.js)：请求、S3MB 解析、状态机、资源转换。
- [S3MPageLod.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MPageLod.js)：Distance / Pixel / GeometryError 细化条件。
- [S3ModelParser.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MParser/S3ModelParser.js)：S3MB 二进制解析。
- [S3MContentParser.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MContentParser.js)：几何、材质、纹理和 RenderEntity 适配。
- [S3MCacheFileRenderEntity.js](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/Factory/S3MCacheFileRenderEntity.js)：CBD 的 command 创建、BatchTable 与提交。

### Cesium 3D Tiles

- [Cesium3DTileset.js](../packages/engine/Source/Scene/Cesium3DTileset.js)：顶层树、队列、处理、渲染和缓存。
- [Cesium3DTile.js](../packages/engine/Source/Scene/Cesium3DTile.js)：节点可见性、SSE、请求、Content 生命周期与命令更新。
- [Cesium3DTilesetTraversal.js](../packages/engine/Source/Scene/Cesium3DTilesetTraversal.js) 与 [Cesium3DTilesetBaseTraversal.js](../packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js)：默认遍历与 LOD 判断。
- [Cesium3DTileContentFactory.js](../packages/engine/Source/Scene/Cesium3DTileContentFactory.js)：内容类型分发。
- [Model3DTileContent.js](../packages/engine/Source/Scene/Model/Model3DTileContent.js)：b3dm/i3dm/pnts/glTF 到 Model 管线的桥梁。
