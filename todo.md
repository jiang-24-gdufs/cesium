开发者想cesium中加载切片3DTiles的原理, 包括和superMap和S3M的; 
他们的原理是否一致, 也可以一起对比, 现在我已经clone了Cesium开源仓库到本地, 现在本地已经启动成功了;
我现在想先关注于3DTiles渲染的原理(和源码), 并产出一个文档; 
基于一个足够简单的sandcastle2示例, 先关注第一步应该怎么开始调试. 给出逐步说明

---

通过实际调试的调用栈定位到了Render函数, 这个是真正执行渲染的核心函数; 这个函数做了什么? updateAndExecuteCommands怎么和Cesium3DTileset中的update关联起来, 怎么理解这个调用关系;

怎么理解Cesium3DTileset中的update中的处理逻辑, 这个是核心的逻辑, 一定要梳理清除. 
- 如何处理瓦片? 在Cesium3DTileset的属性中,root是什么? 它有什么重要的属性?  
- frameState 是什么? 这个状态包含什么信息
- 关联了什么其他的方法, 做了什么处理?
协助我理解这个核心的加载3DTiles的核心流程, 与具体细节