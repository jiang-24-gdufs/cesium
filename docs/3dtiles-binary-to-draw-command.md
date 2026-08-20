# 3D Tiles：从 `ArrayBuffer` 到 `DrawCommand`

> 这份文档只追踪“一个 Tile 的内容文件下载以后发生什么”。Tile 树如何选择节点，请先看[Cesium3DTileset / Cesium3DTile 入门文档](./cesium3dtileset-vs-tile.md)。

## 先给结论

下载到 `ArrayBuffer` 以后，Cesium 还没有把它变成 GPU 可绘制对象。中间至少有四层工作：

```text
网络字节
  ↓
识别格式：b3dm / pnts / i3dm / glb / subtree / tileset.json ...
  ↓
解析容器：读 header、JSON 区段、二进制区段、嵌入的 glTF
  ↓
创建 Content 和 Model：建立组件、材质、属性表、纹理和缓冲区加载器
  ↓
逐帧 process/update：解码并创建 WebGL 资源，生成 DrawCommand
```

最重要的时间点是：

- `ArrayBuffer` 到达：只说明网络请求完成。
- `Cesium3DTileContent` 创建：只说明 Cesium 知道这是什么类型，并建立了对应对象。
- `READY`：内容已经可以被选中并参与渲染。
- `frameState.commandList` 中出现命令：本帧已经把可执行的绘制工作交给 Scene。

## 1. 从请求返回值开始

对于单内容 Tile，入口是 `Cesium3DTile.prototype.requestContent()`，最后走到 `requestSingleContent()`。核心过程在 [Cesium3DTile.js:1126](../packages/engine/Source/Scene/Cesium3DTile.js#L1126) 和 [Cesium3DTile.js:1300](../packages/engine/Source/Scene/Cesium3DTile.js#L1300)：

```text
Cesium3DTile.requestContent()
  └─ requestSingleContent()
       ├─ new Request({ type: TILES3D, priorityFunction: ... })
       ├─ resource.fetchArrayBuffer()
       └─ processArrayBuffer(tile, ..., promise)
```

`resource.fetchArrayBuffer()` 的返回值是 `Promise<ArrayBuffer>`，但也可能因为 `RequestScheduler` 节流而暂时返回 `undefined`。请求完成后，`processArrayBuffer()` 会先把状态设为 `LOADING`，等待 Promise，然后处理取消、失败或成功。成功路径的关键代码是：

```text
ArrayBuffer 到达
  └─ makeContent(tile, arrayBuffer)
       ├─ preprocess3DTileContent(arrayBuffer)
       ├─ contentFactory[contentType](...)
       └─ tile._content = content
            tile._contentState = PROCESSING
```

成功创建 Content 后不是直接 `READY`，而是进入 `PROCESSING`，等待渲染循环继续推进内部 loader。

## 2. 第一次解析：Cesium 如何知道文件类型

实现文件是 [preprocess3DTileContent.js](../packages/engine/Source/Scene/preprocess3DTileContent.js)。它做的事情可以概括成：

1. 用 `Uint8Array` 查看字节，用 `getMagic()` 读取文件开头的 magic。
2. 如果 magic 对应二进制 3D Tiles 格式，返回 `binaryPayload`。
3. 否则把字节解码为 JSON，再根据 JSON 的特征字段判断类型。

```javascript
const uint8Array = new Uint8Array(arrayBuffer);
let contentType = getMagic(uint8Array);
```

Cesium 不是只看 URL 的扩展名。例如 URL 没有 `.b3dm` 后缀，只要文件开头的 magic 是 `b3dm`，仍然可以识别为 b3dm。

### 二进制 magic 和 JSON 特征

| 识别依据 | 结果 | 后续对象 |
| --- | --- | --- |
| magic `b3dm` | Batched 3D Model | `Model3DTileContent.fromB3dm()` |
| magic `pnts` | Point Cloud | `Model3DTileContent.fromPnts()` |
| magic `i3dm` | Instanced 3D Model | `Model3DTileContent.fromI3dm()` |
| magic `cmpt` | Composite | `Composite3DTileContent`，再递归处理内部内容 |
| magic `glTF` | 二进制 glTF（Cesium 内部记为 `glb`） | `Model3DTileContent.fromGltf()` |
| JSON 有 `root` | 外部 `tileset.json` | `Tileset3DTileContent`，继续扩展 Tile 树 |
| JSON 有 `asset` | JSON glTF | `Model3DTileContent.fromGltf()` |
| JSON 有 `tileAvailability` | subtree JSON | `Implicit3DTileContent` |

这个阶段的输出只有两种形态：

```text
{ contentType, binaryPayload: Uint8Array }
或
{ contentType, jsonPayload: object }
```

它还没有解析 b3dm 的 feature table，也没有创建顶点缓冲区；这些工作交给对应的 Content/Loader。

## 3. 第二次解析：以 `b3dm` 为例

`b3dm` 是一个“外层容器”，里面通常还包着一个 glTF/GLB。解析器是 [B3dmParser.js](../packages/engine/Source/Scene/B3dmParser.js)，核心方法 `B3dmParser.parse(arrayBuffer, byteOffset)` 使用 `DataView` 按小端序读取整数。

可以把 b3dm 看成：

```text
┌──────────────┬──────────────────────┬────────────────────┬─────────────────────┐
│ 28 字节 header│ featureTable JSON    │ featureTable binary│ batchTable JSON/bin │
└──────────────┴──────────────────────┴────────────────────┴─────────────────────┘
                                                        ↓
                                                embedded glTF / GLB
```

当前 header 中的重要长度字段包括：

```text
magic                       4 bytes，应该是 "b3dm"
version                     4 bytes，当前支持 1
byteLength                  4 bytes，整个 b3dm 长度
featureTableJsonByteLength  4 bytes
featureTableBinaryByteLength 4 bytes
batchTableJsonByteLength    4 bytes
batchTableBinaryByteLength  4 bytes
```

解析器用这些长度计算每个区段的起止位置：

```text
header
  → featureTableJson
  → featureTableBinary
  → batchTableJson
  → batchTableBinary
  → 剩余字节 = glTF / GLB
```

其中：

- Feature Table 描述渲染所需的全局信息，例如 `BATCH_LENGTH`、`RTC_CENTER`。
- Batch Table 保存旧版 3D Tiles 的逐对象属性。
- 最后的 glTF/GLB 才是模型网格、材质、纹理和节点层级的主要来源。

`B3dmParser` 返回的是一组视图和 JSON，而不是一个 WebGL 对象：

```javascript
{
  featureTableJson,
  featureTableBinary,
  batchTableJson,
  batchTableBinary,
  gltf // Uint8Array，指向嵌入的 glTF/GLB
}
```

这也是为什么“解析完成”仍不等于“可以绘制”：模型还需要加载 glTF 的 buffer、image、材质等资源。

### `pnts` 的区别

`pnts` 没有嵌入 glTF。解析器 [PntsParser.js](../packages/engine/Source/Scene/PntsParser.js) 读取 feature table，并直接得到点的位置、法向、颜色、batch id 等属性：

```text
pnts header
  → featureTable JSON/bin
  → batchTable JSON/bin
  → POSITION / POSITION_QUANTIZED
  → NORMAL / RGB / RGBA / BATCH_ID（如果存在）
```

如果使用 Draco 压缩，`PntsLoader` 会在后续 `process(frameState)` 中安排解码；没有 Draco 时也要把属性整理成模型组件和 GPU buffer。

`i3dm` 与 b3dm 类似，也包含 feature/batch table，但表达的是多个实例和它们共享的 glTF；解析器见 [I3dmParser.js](../packages/engine/Source/Scene/I3dmParser.js)。

## 4. Content Factory：把“类型”接到具体实现

`makeContent()` 在 [Cesium3DTile.js:1372](../packages/engine/Source/Scene/Cesium3DTile.js#L1372) 得到 `preprocessed.contentType` 后，查找 [Cesium3DTileContentFactory.js](../packages/engine/Source/Scene/Cesium3DTileContentFactory.js)：

```text
contentType = b3dm
  └─ Model3DTileContent.fromB3dm(...)
       └─ Model.fromB3dm(...)
            └─ new B3dmLoader(...)

contentType = pnts
  └─ Model3DTileContent.fromPnts(...)
       └─ Model.fromPnts(...)
            └─ new PntsLoader(...)

contentType = externalTileset
  └─ Tileset3DTileContent.fromJson(...)
       └─ tileset.loadTileset(..., parentTile)
```

对普通模型/点云来说，`Model3DTileContent` 是 Tile 与通用 `Model` 类之间的适配层：它保存 `_tile` 和 `_model`，把 Tileset 的颜色、矩阵、裁剪面、光照、样式等设置同步给 Model。

例如它的 `update(tileset, frameState)` 会做两件事：

```text
1. 把 tile.computedTransform 和 tileset 的渲染设置同步到 Model
2. 调用 model.update(frameState)
```

见 [Model3DTileContent.js:243](../packages/engine/Source/Scene/Model/Model3DTileContent.js#L243)。

## 5. Loader 的两个阶段：load 与 process

以 `b3dm` 为例，`Model.fromB3dm()` 创建 `B3dmLoader` 并调用 `loader.load()`。在 [B3dmLoader.js](../packages/engine/Source/Scene/Model/B3dmLoader.js) 中，`load()` 主要完成 CPU 侧的初步解析，并创建 `GltfLoader`；接着 `process(frameState)` 才逐帧推进资源加载和 GPU 资源创建。

```text
B3dmLoader.load()
  ├─ B3dmParser.parse()
  ├─ 读取 feature/batch table
  ├─ 取出嵌入 glTF
  └─ 创建 GltfLoader

B3dmLoader.process(frameState)
  ├─ GltfLoader.process(frameState)
  ├─ 等待 buffer/image/纹理等资源
  ├─ 组合 RTC_CENTER 等变换
  ├─ 生成 ModelComponents
  └─ state = READY
```

`pnts` 的 loader 会把解析后的点属性变成组件；使用 Draco 时还会通过 `DracoLoader` 异步解码。重要的是：Cesium 不在网络 Promise 回调里随意创建所有 WebGL 资源，而是把处理放回每帧的 `processTiles()`，这样可以受内存和帧预算控制。

## 6. Tile 从 `PROCESSING` 到 `READY`

网络 Promise 成功后，`processArrayBuffer()` 会：

```text
tile._content = content
tile._contentState = PROCESSING
tileset._processingQueue.push(tile)
```

随后，在 Tileset 的 `prePassesUpdate()` 中：

```text
Cesium3DTileset.prePassesUpdate()
  └─ processTiles(tileset, frameState)
       └─ tile.process(tileset, frameState)
            ├─ 如果 content.ready，状态改为 READY
            └─ content.update(tileset, frameState)
```

源码见 [Cesium3DTileset.js:2701](../packages/engine/Source/Scene/Cesium3DTileset.js#L2701)、[Cesium3DTileset.js:2898](../packages/engine/Source/Scene/Cesium3DTileset.js#L2898) 和 [Cesium3DTile.js:2330](../packages/engine/Source/Scene/Cesium3DTile.js#L2330)。

这里有一个容易误解的细节：`tile.process()` 中会用临时 command list 调用 Content 的 `update()`，目的是推进 loader 和准备资源；此时不一定把这些命令作为本帧最终绘制结果提交。真正的可见 Tile 绘制发生在 `updateTiles()` 处理 `_selectedTiles` 时。

## 7. Model 如何生成 DrawCommand

对 b3dm、i3dm、pnts 和 glTF，最终通常都会落到 `Model`。`Model3DTileContent.update()` 调用 `model.update(frameState)`，其核心阶段在 [Model.js:1924](../packages/engine/Source/Scene/Model/Model.js#L1924)：

```text
Model.update(frameState)
  ├─ processLoader(model, frameState)
  ├─ loader 完成后创建 ModelSceneGraph
  ├─ buildDrawCommands(model, frameState)
  ├─ 更新矩阵、样式、裁剪、特征表等
  └─ submitDrawCommands(model, frameState)
```

### 7.1 第一次更新：创建 Scene Graph 和 DrawCommand 模板

当 loader 的主资源准备好后，Model 创建 `ModelSceneGraph`。随后 `buildDrawCommands()` 调用：

```text
ModelSceneGraph.buildDrawCommands()
  ├─ buildRenderResources()
  │    └─ 运行各个 pipeline stage，准备属性、材质、纹理、uniform
  ├─ computeBoundingVolumes()
  └─ createDrawCommands()
       └─ 每个 glTF primitive 创建一个 ModelDrawCommand
```

源码见 [Model.js:2272](../packages/engine/Source/Scene/Model/Model.js#L2272)、[ModelSceneGraph.js:451](../packages/engine/Source/Scene/Model/ModelSceneGraph.js#L451) 和 [ModelSceneGraph.js:676](../packages/engine/Source/Scene/Model/ModelSceneGraph.js#L676)。

`ModelDrawCommands.buildModelDrawCommand()` 最终创建基础 `DrawCommand`，其中包含 shader、vertex array、uniform map、render state 和 pass 等 GPU 绘制所需信息，见 [ModelDrawCommands.js:28](../packages/engine/Source/Scene/Model/ModelDrawCommands.js#L28)。

可以把它理解为：

```text
glTF primitive
  → ModelRuntimePrimitive
  → ModelDrawCommand
  → 基础 DrawCommand + 运行时派生命令
```

### 7.2 后续每帧：把命令放进当前帧列表

模型资源和命令模板准备好后，`submitDrawCommands()` 会判断模型是否显示、当前 pass 是否允许绘制，然后调用 `model._sceneGraph.pushDrawCommands(frameState)`；见 [Model.js:2564](../packages/engine/Source/Scene/Model/Model.js#L2564)。

`ModelSceneGraph.pushDrawCommands()` 遍历模型中的 runtime primitive，调用每个 `ModelDrawCommand.pushCommands(frameState, frameState.commandList)`；见 [ModelSceneGraph.js:1003](../packages/engine/Source/Scene/Model/ModelSceneGraph.js#L1003)。这就是“命令进入当前帧命令列表”的直接位置。

```text
Model.update(frameState)
  └─ submitDrawCommands()
       └─ ModelSceneGraph.pushDrawCommands()
            └─ ModelDrawCommand.pushCommands(
                 frameState,
                 frameState.commandList
               )
                    └─ frameState.commandList.push(DrawCommand)
```

注意“创建命令”和“提交命令”不是同一步：

- `buildDrawCommands()`：通常在资源准备好后构建/缓存命令对象。
- `pushDrawCommands()`：每个可见帧把命令放进本帧 `commandList`，并根据矩阵、样式、pick、阴影、轮廓等状态使用适合的派生命令。

## 8. 回到 `Cesium3DTileset.update()`：为什么只选中的 Tile 会画

把两份文档连起来，完整链路是：

```text
Cesium3DTileset.updateForPass()
  └─ update()
       ├─ traversal.selectTiles()
       │    ├─ _selectedTiles = 当前可画 Tile
       │    └─ _requestedTiles = 需要加载 Tile
       ├─ requestTiles()
       │    └─ Tile.requestContent() → ArrayBuffer → Content
       └─ updateTiles()
            └─ selectedTile.update()
                 └─ Model3DTileContent.update()
                      └─ Model.update()
                           └─ ModelSceneGraph.pushDrawCommands()
                                └─ frameState.commandList
```

`selectedTiles` 中的 Tile 必须具有可用的可绘制 Content；如果精细子节点还没准备好，`REPLACE` 策略会继续选择父节点，所以用户看到的是粗糙但连续的画面。下载完成但仍为 `PROCESSING` 的子节点不会因为“文件已经在内存”就立即替换父节点。

## 9. 常见问题定位

### “Network 面板有响应，但没有模型”

按顺序检查：

1. `preprocess3DTileContent()` 是否识别出正确类型？
2. 对应 Parser 是否抛出 header/长度/版本错误？
3. `tile._contentState` 是否从 `LOADING` 进入 `PROCESSING`？
4. `Model` 的 loader 是否继续 `process()` 并变为 ready？
5. Tile 是否进入 `_selectedTiles`？
6. `ModelSceneGraph.pushDrawCommands()` 是否被调用？
7. `frameState.commandList` 是否出现命令？

### “Content 已经 READY，但这一帧没画”

`READY` 只表示“内容可用”，还需要满足当前帧的可见性、SSE/LOD、`show`、pass、距离显示条件等。请同时看 Tile 是否被 traversal 选中。

### “`ArrayBuffer` 很大，为什么处理不是一次完成”

因为 glTF buffer、纹理、Draco 解码、WebGL buffer/texture 创建可能跨帧进行。Cesium 通过 `ResourceLoader.process(frameState)`、`processTiles()` 和缓存预算把工作分摊到渲染循环中。

## 10. 最短源码索引

| 目的 | 源码 |
| --- | --- |
| 下载后的状态迁移 | [Cesium3DTile.js:1207](../packages/engine/Source/Scene/Cesium3DTile.js#L1207) |
| magic/JSON 类型识别 | [preprocess3DTileContent.js](../packages/engine/Source/Scene/preprocess3DTileContent.js) |
| 类型到 Content 的映射 | [Cesium3DTileContentFactory.js](../packages/engine/Source/Scene/Cesium3DTileContentFactory.js) |
| b3dm 外层容器解析 | [B3dmParser.js](../packages/engine/Source/Scene/B3dmParser.js) |
| pnts 点属性解析 | [PntsParser.js](../packages/engine/Source/Scene/PntsParser.js) |
| Tile Content 适配 Model | [Model3DTileContent.js:243](../packages/engine/Source/Scene/Model/Model3DTileContent.js#L243) |
| Tile processing 队列 | [Cesium3DTileset.js:2898](../packages/engine/Source/Scene/Cesium3DTileset.js#L2898) |
| Model 创建 DrawCommand | [ModelSceneGraph.js:451](../packages/engine/Source/Scene/Model/ModelSceneGraph.js#L451) |
| 命令进入当前帧列表 | [ModelSceneGraph.js:1003](../packages/engine/Source/Scene/Model/ModelSceneGraph.js#L1003) |

## 一句话总结

`ArrayBuffer` 是“收到的原材料”，Parser 把它拆成结构化数据，Loader 把结构化数据准备成 Model 组件和 GPU 资源，`ModelSceneGraph` 为 primitive 建立 DrawCommand，最后 `pushDrawCommands()` 才把命令放进 `frameState.commandList`，交给 Scene 在本帧执行。
