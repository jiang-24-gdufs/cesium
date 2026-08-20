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

## 4. CBD S3M 核心方法阅读卡

本节按照真实调用顺序展开方法，而不是只罗列文件名。阅读每张卡时遵循同一个提问顺序：**它接收什么上下文？改变了哪些对象状态？下一步由谁消费？若画面有问题应看什么？**

### 4.1 `S3MTilesLayer.loadConfig(url)`：把数据描述变成可调度的根节点

源码：[S3MTilesLayer.js:371](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTilesLayer.js#L371)。这是 CBD 的初始化边界；它不下载几何，只建立今后一切请求所需的**坐标、资源基址、类型和根 tile**。

```text
输入：url = "./data/CBD/cbd.scp"
  │
  ├─ Resource.createIfNeeded(url)
  ├─ 保存 _url / _basePath / _baseResource
  ├─ isS3MB ? fetchJson() : fetchXML()
  │
  ├─ 读取 fileType、position、geoBounds、压缩/透明扩展
  ├─ position → ENU modelMatrix / invModelMatrix
  ├─ config.tiles 或 config.rootTiles
  │    └─ 每个条目 new S3MTile(...); 加入 _rootTiles 与 cache
  │
  └─ _readyPromise.resolve(layer)
```

CBD 的 `cbd.scp` 虽然用 `.scp` 后缀，但页面没有传 `isS3MB: false`，默认值为 true，所以这里走 `fetchJson()`。随后 `fileType = "OSGBCacheFile"` 决定稍后内容工厂会选择 `S3MCacheFileRenderEntity`。这是“**配置字段决定渲染类**”的第一次分流。

`modelMatrix` 是本方法最容易被低估的结果。它把配置的经纬高插入点变成东-北-天（ENU）局部坐标变换；后续 S3MB 内 geode 的局部矩阵会与它相乘。若模型整体偏移、倒置或根本不在相机附近，先在这里看 `position`、`_position`、`modelMatrix`，而不是先怀疑顶点解析。

建议观察：

- `resource.url`、`_basePath`：本地 CBD 应基于 `data/CBD/`；服务数据还会影响 `S3MTile.getUrl()` 的 Realspace 拼接分支。
- `config.extensions["s3m:FileType"]`、`config.tiles`：分别决定 entity 类型和根请求数。
- `layer._rootTiles[0].contentResource.url`：配置 URL 到第一条 `.s3mb` 请求的最终映射。
- `layer.ready` 与 `_rootTiles.length`：它们为真仅表示根节点存在，并非模型已渲染。

当前工作区的该方法开头已包含 `debugger` 语句；刷新 CBD 时会自动停在这里。它适合作为第一次断点，但不要把它误当成几何完成点。

### 4.2 `S3MTilesLayer.update(frameState)`：S3M 每帧的总控器

源码：[S3MTilesLayer.js:937](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTilesLayer.js#L937)。这是 S3M 的“控制平面”：它本身不理解某个顶点和纹理字段，却严格规定这一帧中哪些阶段可以发生。

```js
schedule(layer, frameState);     // 写入请求、处理、渲染队列
requestTiles(layer);             // 启动网络 I/O
processTiles(layer, frameState); // 推进 CPU 数据到 GPU 资源
updateTiles(layer, frameState);  // 向 commandList 提交已就绪实体
```

它先排除三种无需工作情况：图层未 ready、图层不在可见高度/视口范围内、pick pass 且禁用了选择。之后它等待 CRN 转码 WASM 就绪，再按上述顺序执行。这个顺序非常关键：**本帧刚开始请求的 tile 通常不能在同帧画出；本帧从网络 Promise 变为解析完成的 tile，最早也要在后续处理阶段创建 GPU 资源。**

`prePassesUpdate()` 会在新帧清空 `_requestTiles`、`_processTiles`、`_renderQueue`；它们不是长期的“已加载集合”，而是本帧调度结果。`postPassesUpdate()` 才进行资源回收。因此在调试面板中看到队列长度为 0 并不说明数据没有加载，必须同时看 tile 的 `contentState` 和 page LOD 的 `renderEntities`。

推荐的条件断点不是直接断在每帧入口，而是：

```js
this._requestTiles.length > 0 || this._processTiles.length > 0
```

命中时依次展开三个队列，回答“此帧是在等网络、在传 GPU，还是已经能画”。这也是与 3D Tiles `update()` 最直接的结构同构点。

### 4.3 `S3MLayerScheduler.schedule(layer, frameState)`：从 tile 树选出三类工作

源码：[S3MLayerScheduler.js:62](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MLayerScheduler.js#L62)。这个方法不直接发 HTTP，也不创建 WebGL buffer；它把当前相机下的树遍历结果拆成三个队列。

```text
root tiles
  ├─ updateTile：计算 visibility / distance / foveated factor
  ├─ visible 且 UNLOADED → _requestTiles
  ├─ 已解析、等待 GPU → _processTiles
  └─ READY → stack
                   │
                   ▼
             逐个检查 pageLod
               ├─ leaf 或不可细化 → 选中当前 pageLod
               ├─ 还没有 child tile → 创建 child；仍选中父 pageLod
               ├─ child 未 READY → 请求/处理 child；仍选中父 pageLod
               └─ child READY → 继续向 child 深入

selected pageLods 的 renderEntities → _renderQueue
```

这段逻辑给出 CBD 渐进显示的实质：当更精细子瓦片尚未可用时，父 page LOD 的 `renderEntities` 留在 `_renderQueue` 中继续画；只有 child READY 后，遍历才深入子节点。它类似 3D Tiles 的 replacement 回退体验，但不是由 `refine: "REPLACE"` 的通用声明实现，而是这段调度代码的具体行为。

`updateTile()` 只在 `updatedVisibilityFrame` 不等于当前帧号时计算一次可见性，避免同帧重复开销；`touchTile()` 同时更新 LRU 的最近使用位置。请求优先级则在遍历完成后集中计算，使用距离、深度、视线中心偏离度和 pixel 等值归一化组合。

调试时，最重要的不是 stack 长度，而是单个 `pageLod` 的四个字段：`isLeafTile`、`canRefine`、`childTile`、`renderEntities.length`。它们可以精确解释“为何此刻画父、为何发子请求、为何没有继续细化”。

#### 将 `schedule()` 看成一个“选择状态机”

可以把 `schedule()` 中每个 PageLOD 的分支压缩成下面的规则。这里的“画当前层”不是直接调用 WebGL，而是把当前 `pageLod.renderEntities` 加入 `selectPageLods`，最后统一汇入 `layer._renderQueue`。

| PageLOD / 子 tile 条件 | scheduler 的动作 | 本帧是否保留当前 PageLOD | 目的 |
| --- | --- | --- | --- |
| `isLeafTile === true` | 直接选中 | 是 | 没有更细的子内容，当前层就是叶子结果 |
| `canRefine === false` | 直接选中 | 是 | 当前投影精度足够，继续细化没有收益 |
| `canRefine === true`，但 `childTile === undefined` | 创建 child tile、touch child | 是 | 第一次知道需要更细层级；先保存子节点，保持父内容可见 |
| child 已存在但 `contentState === UNLOADED` | 放入 `_requestTiles` | 是 | 请求子 S3MB 时用父层填补画面 |
| child 正在 `LOADING` | 不再重复加入请求队列 | 是 | 网络尚未返回，仍显示父层 |
| child 已解析、待资源创建 | 放入 `_processTiles` | 是 | GPU buffer/shader 未好之前，仍显示父层 |
| child `READY` | 放入遍历 stack | 否 | 向下检查子节点的 PageLOD，让更细内容接管 |
| child 不可见 | 不继续处理该 child | 否（此分支不会选中当前 PageLOD） | 当前代码把可见性优先于该 PageLOD 的回退选择；排查边缘闪烁时应在此分支检查父/子包围体 |

因此 LOD 在这个 scheduler 中不是一个单独的“下载算法”，而是一条**选择规则**：它决定什么时候有资格创建/请求 child，以及在 child 未 READY 的时间里是否继续提交 parent 的 render entities。网络、解析和 GPU 上传分别在后续方法中真正执行。

#### CBD 中一次细化的典型时序

下面的帧号只是为了理解状态迁移；网络和 JobScheduler 的实际耗时会让某阶段跨越更多帧。

```text
帧 A  root UNLOADED
  schedule: root → _requestTiles
  requestTiles: 发 root.s3mb 请求

帧 B  root 下载、解析完成（中间状态）
  schedule: root → _processTiles
  processTiles: 为 root 的 RenderEntity 创建 buffer / shader / command

帧 C  root READY，PageLOD 判断需要更细，但 child 尚不存在
  schedule: createChildTile(); 选中 root PageLOD
  updateTiles: 父层命令继续进入 commandList

帧 D  child UNLOADED
  schedule: child → _requestTiles；同时仍选中父 PageLOD
  requestTiles: 发 child.s3mb 请求

帧 E  child 已下载但 GPU 尚未完成
  schedule: child → _processTiles；父层继续显示

帧 F  child READY
  schedule: child → stack；转而检查 child 的 PageLOD
  updateTiles: 父 PageLOD 不再因这条细化分支被选中，子层接管
```

注意 child 首次在帧 C 被 `createChildTile()` 创建时，代码只 `touchTile` 而没有立刻调用 `loadTile`；通常要到下一帧（帧 D）才会进入 child 的 `UNLOADED → _requestTiles` 分支。这是该实现的明确时序，调试时不要把这一个帧间隔误判为请求丢失。

#### `pageLod.update()` 才是 LOD 判定本身

`schedule()` 负责消费 `canRefine`，真正计算它的是 [S3MPageLod.update](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MPageLod.js#L16)。数据从 S3MB 的 `rangeList` / `rangeMode` 解析出来后，在 `createChildren()` 中写入 `pageLod.rangeData` / `pageLod.rangeMode`。三种模式的语义如下：

```text
Distance:
  canRefine = distanceToCamera × lodRangeScale < rangeData

Pixel:
  pixel = drawingBufferHeight / (2 × tan(fovy / 2))
          × boundingVolume.radius / distanceToCamera
  canRefine = pixel > rangeData × lodRangeScale

GeometryError:
  pixelSize = geometricError × drawingBufferHeight
              / (distanceToCamera × sseDenominator × pixelRatio)
  canRefine = pixelSize > 16 × lodRangeScale
```

直观地说，Distance 模式在相机足够近时细化；Pixel 模式在该 PageLOD 的包围球在屏幕上仍足够大时细化；GeometryError 模式将几何误差投影为像素后使用固定的 16 像素阈值。`lodRangeScale` 是对生产数据阈值的倍率：增大它会让 Distance/Pixel 条件更难成立，通常减少细化、请求与命令数；减小它通常会更早进入细化。

S3M 的 `rangeData` 是 **每个 PageLOD 自己的阈值**，所以 LOD 判定的直接对象是 PageLOD 而非整个 `S3MTile`。一个 S3MB tile 可以有多个 PageLOD，每个 page LOD 都能独立决定保留自身实体、请求其 child，或让 child 接管。这是理解 S3M 树时最关键的粒度差异。

#### 不要混淆“细化判定”和“请求优先级”

`pageLod.canRefine` 回答的是“要不要更细”；`tile.priority` 回答的是“多个已决定要请求的 tile，哪个先发”。后者由 `updateMinimumMaximumPriority()` 收集当前帧 tile 的 distance/depth/foveated/pixel 最值，随后 `updatePriority()` 将各 tile 压缩成可排序的数值，`requestTiles()` 再按这个数值升序发请求。

当前源码需要特别留意两个实现事实：

- `ContentState.js` 定义的是 `PARSING`，而 scheduler 和 `S3MTile` 使用 `ContentState.LOADED`。两处都取到 `undefined` 时比较仍可能成立，但这是命名错误造成的偶然行为，不应当作为状态机契约。
- `S3MPageLod.update()` 计算的是局部变量 `pixel`，并没有写入 `tile.pixel`；而 scheduler 的 priority 聚合和 `S3MTile.updatePriority()` 却读取 `tile.pixel`。在当前目录内没有找到对 `tile.pixel` 的赋值，因此该 priority 分量可能产生 `NaN`。这不改变 `canRefine` 的 Pixel LOD 判断，但会使“多个请求谁先发”的排序值得单独验证。

这两个问题都应与 LOD 结果分开判断：先在 `pageLod.canRefine` 验证“是否应该细化”，再在 `tile.priority` / Network 请求顺序验证“是否按预期优先请求”。

### 4.4 `S3MTile.requestContent()` 与 `contentReadyFunction()`：网络字节进入 S3M 运行时

源码：[S3MTile.js:231](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTile.js#L231) 与 [S3MTile.js:252](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTile.js#L252)。两者共同构成一个 tile 从“被选中请求”到“拥有 page LOD 和 RenderEntity”的边界。

`requestContent()` 会克隆 `contentResource`，创建带 `throttle`、`throttleByServer`、`RequestType.TILES3D`、`priorityFunction` 和 `serverKey` 的 Cesium `Request`，再调用 `fetchArrayBuffer()`。如果 RequestScheduler 因并发/优先级在本帧不接受请求，`fetchArrayBuffer()` 会返回 `undefined`，方法也会返回 `false`；这不是解析错误，调度器应在后续帧再试。

请求真正发出后，tile 被置为 `LOADING`。Promise 成功时进入 `contentReadyFunction()`：

```text
ArrayBuffer
  ├─ S3ModelParser.parseBuffer(arrayBuffer)      二进制 → 中间内容对象
  ├─ await S3MContentParser.parse(layer, content, tile)
  │    └─ 材质、纹理、PageLOD、RenderEntity
  ├─ createChildren(tile, pageLod data)
  └─ tile 进入“已解析、待 GPU 资源”的中间状态
```

这里要区分“文件已下载”和“可以渲染”：前者只保证 `arrayBuffer` 存在；`parseBuffer` 后有 CPU 结构；`S3MContentParser` 后有 render entities；只有后续 `transformResource` 让所有 entity 的 `ready` 为真，tile 才会进入 READY。模型 200 但空白时，把断点放在这个方法的三处边界最有效：`arrayBuffer.byteLength`、`content.groupNode`/`geoPackage`、`data.length`/`tile.pageLods.length`。

### 4.5 `S3ModelParser.parseBuffer(buffer)`：S3MB 的二进制总入口

源码：[S3ModelParser.js:1430](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MParser/S3ModelParser.js#L1430)。这是理解 S3MB 格式与渲染的关键桥梁：它不创建 WebGL 对象，而是把字节布局解释成后续模块共同使用的中间对象。

解析顺序是固定的：

```text
文件头
  ├─ version
  ├─ S3M 3.0 的 compressedType
  ├─ 版本 ≥ 2 的 uncompressed size（读取但当前函数不用于分配）
  └─ 压缩块 byteSize
        │
        ├─ 3.0 + compressedType=0：直接使用块
        └─ 其他：pako.inflate 解压
              │
              ▼
解压后主体
  ├─ nOptions
  ├─ parseGroupNode      PageLOD、子 tile、geode 引用
  ├─ parseSkeleton       顶点属性、索引、实例等 geoPackage
  ├─ parseTexturePackage 纹理数据与压缩格式
  ├─ parseMaterial       材质与纹理引用
  └─ parsePickInfo       对象 ID / batch / instance 选择信息
```

`bytesOffset` 是这个方法及其子解析器的核心不变量：每个 parser 返回下一个未读取字节位置。研究二进制格式时，不要一开始就在某个 `getUint32` 上猜字段含义；先在五个大区块之间记录 offset、区块长度和得到对象的 key 数量，再进入 `parseVertex`、`parseIndexPackage` 等子函数。这样最容易定位“版本判断错位、解压错误、某一段长度错导致后续全错”的问题。

与 3D Tiles 的差异在这里最清晰：3D Tiles 的 `Cesium3DTile` 先做内容类型预处理，再将 b3dm/glb/pnts 等分派给 Content factory；S3M 的 `parseBuffer` 本身承担了 S3MB 格式的几何、纹理、材质和 pick 解码，所以它是更厚、更接近格式规范的解析入口。

### 4.6 `S3MContentParser.parse(layer, content, tile)`：把格式对象变成渲染对象

源码：[S3MContentParser.js:266](../../s3m-spec/S3M_SDK/S3M_module/S3MTiles/S3MContentParser.js#L266)。它是“格式层 → 渲染层”的适配器，主要调用两个子过程：

1. `parseMaterial()` 遍历材料与 texture state，创建 `MaterialPass`，并以 `tile.fileName + textureCode` 作为 texture cache key。DXT 等走 `DDSTexture`；CRN 先转码；WebP 通过 Promise 等待异步创建完成。这是本方法被定义为 `async` 的主要原因。
2. `parsePagelods()` / `parseGeodes()` 将 group node 的 geode 变成 `RenderEntity`。它计算 `modelMatrix = layer.modelMatrix × geoMatrix`，取出对应 `geoPackage` 的 `vertexPackage`、`arrIndexPackage`、`pickInfo` 和材质，再按 `layer.fileType` 调用 `S3MContentFactory`。

这里生成的 `RenderEntity` 仍只保存 CPU typed array、attribute 描述、材质和包围球，还没有 `VertexArray`。所以看到 `renderEntities.length > 0` 只能说明 **格式关联正确**，不能说明 GPU 上已有模型。反过来，如果这里为 0，就不应该再追 `S3MCreateVertexJob`；问题通常在 `groupNode`、skeleton name 到 `geoPackage` 的关联，或 material code 到 material table 的关联。

### 4.7 `S3MTile.transformResource()`：把一个 tile 推到 READY 的闸门

源码：[S3MTile.js:325](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/S3MTile.js#L325)。当 scheduler 发现 tile 已解析时，会把它放入 `_processTiles`；本方法遍历每个 PageLOD 下的每个 RenderEntity，调用 `ro.transformResource()`。

它的关键不是“完成一项工作”，而是**聚合所有实体的可渲染性**：只要有一个 `ro.ready === false`，`allRenderable` 就保持 false；只有全部完成后 tile 才标为 READY。由于 buffer 和 shader 创建经 `frameState.jobScheduler` 执行，预算不足时 RenderEntity 的内部创建队列会留到下一帧，`transformResource()` 必须多次执行。这正是“已下载很久但仍未绘制”的正常异步/分帧情形。

断在这里应同时看：`pageLod.renderEntities.length`、每个 entity 的 `vertexBufferToCreate.length`/`indexBufferToCreate.length`/`shaderProgramToCreate.length`、`ro.ready` 和最终 `allRenderable`。这比只看 tile 的状态更能判断瓶颈是顶点上传、索引上传还是 shader 编译。

### 4.8 `S3MCacheFileRenderEntity.transformResource()`：CBD 的 GPU 建设顺序

源码：[S3MCacheFileRenderEntity.js:247](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/Factory/S3MCacheFileRenderEntity.js#L247)。CBD 因为是 `OSGBCacheFile`，这是最值得逐行阅读的 entity 方法。

```text
createBatchTable     建立每对象/实例的颜色、操作、pick 属性表
createPickIds        把 pickInfo 写进 BatchTable
createBuffers        通过 JobScheduler 创建 VertexBuffer / IndexBuffer
createShaderProgram  由 attribute、材质、压缩/实例状态组装 shader variant
createCommand        只有三类创建队列均为空时才创建 DrawCommand
initLayerSetting     把已有的对象操作状态应用到新 entity
```

这个顺序揭示了 S3M 选择和高亮不是渲染后的附加脚本，而是 draw 前写入 BatchTable 并进入 shader 的属性。若 `pickInfo` 异常，既应查看 parser 的 `parsePickInfo`，也应在 `createBatchTable` 和 `createPickIds` 查看 instance/batch ID 是否与顶点属性一致。

### 4.9 `createCommand()` 与 `update()`：资源齐备才产生可执行命令

源码：[S3MCacheFileRenderEntity.js:171](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/Factory/S3MCacheFileRenderEntity.js#L171) 与 [S3MCacheFileRenderEntity.js:259](../../s3m-spec/S3M_SDK/S3M_JS/S3M_module/S3MTiles/Factory/S3MCacheFileRenderEntity.js#L259)。

`createCommand()` 开头的 guard 是核心：只要 vertex/index/shader 任一创建队列不为空，就立刻返回。它避免创建引用未完成 GPU 对象的 command。资源齐备后，它：

- 将 attribute 与 index buffer 组合为 `Cesium.VertexArray`；
- 根据索引包 primitive type 选择点、线或三角形；
- 按 alpha mode 和透明优化决定 `CESIUM_3D_TILE` 或 `TRANSLUCENT` pass；
- 组装 `uniformMap`，并用 BatchTable/材质 atlas 的 callback 包装它；
- 保存 `colorCommand`，清空 shader 源码引用，并令 `ready = true`。

`update()` 是每帧的轻量阶段：先将脏 BatchTable 属性同步，再调用 batch table update；非 WireFrame 时将 `colorCommand` push 到 `frameState.commandList`，非 Fill 时额外加入边线 command。也就是说，`ready === true` 不是“马上必定出现三角面”，还要检查 `style3D.fillStyle`、`colorCommand` 是否存在、是否处于所需 pass，以及包围体/深度测试是否最终让命令可见。

当前工作区在 `createCommand()` 和 `S3MContentParser.parse()` 中也已有 `debugger` 语句。它们正好覆盖“解析对象完成”和“命令首次创建”两个低频且高价值的停点；对于高频 `update()`，更推荐条件断点或在第一次命中后移除。

### 4.10 将方法卡映射回 3D Tiles 的抽象边界

| CBD S3M 方法 | 3D Tiles 最接近的入口 | 相同点 | 关键不同 |
| --- | --- | --- | --- |
| `S3MTilesLayer.loadConfig` | `Cesium3DTileset.fromUrl` / `loadTileset` | 都建立数据集级运行时与根树 | S3M 读取 config 后只建根；3D Tiles 可从 JSON 立即建显式树 |
| `S3MTilesLayer.update` | `Cesium3DTileset.updateForPass` 内部 `update` | 都组织选择、请求、提交 | 3D Tiles 将 processing 放在 `prePassesUpdate`，且明确处理 pass options |
| `S3MLayerScheduler.schedule` | `Cesium3DTilesetBaseTraversal.selectTiles` | 都做可见性、细化、优先级和选择 | S3M 围绕 PageLOD range；3D Tiles 围绕 SSE、ADD/REPLACE、隐式/外部内容 |
| `S3MTile.requestContent` | `Cesium3DTile.requestContent` | 都用 `RequestScheduler` 限流请求 ArrayBuffer | 3D Tiles 原生支持 multiple contents、empty content、expiry 与更完整取消处理 |
| `S3ModelParser.parseBuffer` | `preprocess3DTileContent` + Content factory | 都将下载字节转为内容运行时 | S3M 在一个 parser 内解释几何/纹理/材质；3D Tiles 先分派给多种 Content/Model 管线 |
| `S3MTile.transformResource` | `Cesium3DTile.process` | 都分帧推进内容到 READY | 3D Tiles 的 Content 隐藏资源细节；S3M entity 直接暴露 buffer/shader 创建队列 |
| `S3MCacheFileRenderEntity.update` | `Cesium3DTile.update` → `content.update` | 最终都 push DrawCommand | S3M 自己决定 uniform、BatchTable、fill style；3D Tiles 经 Model/Content 的更通用管线 |

## 5. LOD 核心原理：Pixel 阈值与 SSE 阈值

### 5.1 S3M：每个 PageLOD 的 range 条件

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

### 5.2 3D Tiles：SSE 是“几何误差投影”

3D Tiles 的典型判断为：

```text
screenSpaceError = geometricError × drawingBufferHeight
                   / (distanceToCamera × sseDenominator × pixelRatio)

canTraverse = screenSpaceError > memoryAdjustedScreenSpaceError
```

其中 `geometricError` 是 `tileset.json`/tile header 定义的几何误差，阈值来自 tileset 的 `maximumScreenSpaceError`，并会因缓存内存压力调整为 `memoryAdjustedScreenSpaceError`。3D Tiles 的 LOD 因而具有一个更明确的、数据集统一的误差语义；CBD S3M 更多依赖各 PageLOD 写入的 `rangeData` 与 range mode。

### 5.3 不能把两者参数直接等价换算

`S3MTilesLayer.lodRangeScale` 和 `Cesium3DTileset.maximumScreenSpaceError` 都会影响“何时更细”，但不能按一个固定比例互相换算：

- S3M 的 Pixel range 用的是该 page LOD 的包围球半径和文件内阈值；Distance range 甚至不计算投影误差。
- 3D Tiles SSE 基于生产端声明的 `geometricError`，还会受 `pixelRatio`、动态 SSE、foveated loading、memory-adjusted SSE 和 refine 策略影响。
- 若要对同一数据做性能/画质比较，应该记录相机位置、屏幕尺寸、当前选择的 tile 数、请求数、GPU 内存和最终 command 数，而不是只比较一个阈值参数。

## 6. 内容解析与材质：S3MB 对 glTF/3D Tile Content

### 6.1 S3M：解析器直接生成 WebGL 所需描述

`S3ModelParser.parseBuffer()` 读取版本和压缩头后，依序解析 `groupNode`、`skeleton`（几何/顶点包）、`texturePackage`、`material` 和 `pickInfo`。`S3MContentParser` 随后：

1. 将材料转换成 `MaterialPass`；
2. 将内嵌纹理交给 `DDSTexture` / CRN 转码 / WebP 异步创建；
3. 将 geode + vertex package + index package 构造为 `RenderEntity`；
4. 由 entity 在渲染循环内创建 `Buffer`、`VertexArray`、`ShaderProgram` 和 `DrawCommand`。

所以 S3MB 解析结果已经非常贴近渲染硬件数据布局。CBD 的 `S3MCacheFileRenderEntity` 还在创建 command 前建立 `BatchTable`/pick id，并根据材质透明度决定 `CESIUM_3D_TILE` 或 `TRANSLUCENT` pass。

### 6.2 3D Tiles：先选择 Content，再进入模型管线

`Cesium3DTileContentFactory` 根据下载内容的 magic/JSON 类型创建内容对象。例如 b3dm、i3dm、pnts、glb/gltf 会转入 `Model3DTileContent`，而 cmpt、subtree、外部 tileset 会转入不同 Content。`Model3DTileContent.fromB3dm()` 进一步调用 `Model.fromB3dm()`，由 Cesium 的 Model/glTF 管线负责后续资源与命令生成。

这带来两个架构后果：

- 3D Tiles 的 Tile 调度层不需要理解每一种模型二进制布局；它只管理一个统一的 Content 生命周期。
- S3M 当前 SDK 的 Tile 调度层与 S3MB 的几何/材质组织更紧耦合。新增一种 S3M 文件类型或渲染模型，通常要同时扩展 `S3ModelParser`、`S3MContentParser` 和 Content Factory/RenderEntity。

## 7. GPU 与命令：同一个终点，不同的抽象边界

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

## 8. 缓存、错误与资源生命周期

| 主题 | S3M SDK | Cesium 3D Tiles |
| --- | --- | --- |
| 触碰缓存 | scheduler 对可见 tile 调用 `S3MLayerCache.touch` | traversal 对访问节点 `touchTile`，Tileset cache 保持 LRU 访问顺序 |
| 释放位置 | `S3MTilesLayer.postPassesUpdate` 调 `S3MLayerCache.unloadTiles`，tile `free()` 销毁 page LOD entity | `Cesium3DTileset.postPassesUpdate` 取消离屏请求并回收 cache；`unloadContent()` 释放内容 |
| 内存策略 | `maximumMemoryUsage` / `totalMemoryUsageInBytes` 参与 cache 条件；当前 CBD SDK 需额外核实内存统计写入者 | `cacheBytes + maximumCacheOverflowBytes` 限制 processing，并可动态提高 SSE 降低精度 |
| 请求取消 | 失败分支能识别 `RequestState.CANCELLED` 并回到 UNLOADED；现有代码对普通请求失败的 reject 处理较弱 | 明确维护 in-flight 队列，帧后取消离屏 LOADING 请求，并维护 pending/processing 统计与失败事件 |
| 内容状态 | `UNLOADED → LOADING →（解析完成）→ READY`，并依赖 entity `ready` 聚合 | `UNLOADED → LOADING → PROCESSING → READY`，另有 EXPIRED/FAILED 语义 |

### 源码审阅注意：S3M 的中间状态名称不一致

当前 SDK 的 `ContentState.js` 定义的是 `PARSING`，而 `S3MTile.js` 和 `S3MLayerScheduler.js` 实际读写的是 `ContentState.LOADED`。在 JavaScript 中未定义的属性值同为 `undefined`，因此当前比较仍可能“碰巧”工作，但这是一个脆弱的命名不一致，不应当作为架构设计本身理解。调试 CBD 的状态机时，优先观察数值、网络与 `renderEntity.ready`，并将这一处记录为后续独立修复项。

## 9. 断点一对一映射

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

## 10. 建议的研究路径

1. **先跑通相同问题的两条路径。** 在 CBD 用 Network + P0 断点确认 `cbd.scp → .s3mb → DrawCommand`；在 3D Tiles 示例确认 `tileset.json → content → DrawCommand`。
2. **第二步只研究 LOD。** 固定相机、屏幕尺寸和 `lodRangeScale`/SSE，记录选择树、请求 URL、命令数和内存，避免把格式差异和 LOD 差异混在一起。
3. **第三步进入内容。** S3M 从 `S3ModelParser.parseBuffer` 对照 `s3m-spec/Specification/S3MB/`；3D Tiles 从 Content Factory 进入 `Model3DTileContent` 与 Model/glTF 管线。
4. **最后研究特性。** 选择/BatchTable、透明和压缩纹理属于 CBD 的高价值路径；3D Tiles 的 style、metadata、implicit tiling、multiple contents、external tileset 和 skip-LOD 属于其通用框架路径。

这样建立的不是“两个格式字段表”，而是一个可验证的架构映射：每个结论都能回到一个数据文件、一个源码断点和一帧中的 command 结果。

## 11. 核心源码索引

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
