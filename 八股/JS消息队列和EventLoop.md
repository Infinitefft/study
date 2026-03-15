# 深入理解 JavaScript 消息队列和 Event Loop

### 在浏览器中，每打开一个标签页都会开启一个**子进程（渲染进程）**，网路请求是在网络进程中处理的，浏览器`只有一个`网络进程，所有标签页的网络请求都在这个进程中处理。

**渲染进程**包括`几个线程`：

- **渲染**主线程: 解析 HTML/CSS、计算布局、执行 JavaScript、运行事件循环。

- **IO** 线程: 专门负责和其他进程（如网络进程、GPU 进程）通信。

- **合成**线程: 在主线程算好布局后，负责把页面分成一块块（图层），交给 GPU 去画。

- **计时器**线程: 专门负责 `setTimeout` 和 `setInterval` 的计时。

- **事件触发**线程: 监控鼠标点击、键盘输入等。

渲染主线程有多少事要做？
- 处理DOM 解析HTML 生成DOM树
- 计算样式合并css规则与元素默认样式，确定每个 DOM节点最终的可视化样式属性值，CSSOM 树
- DOM Tree 和 CSSOM Tree 树 结合生成 渲染树render Tree
- 处理布局，盒模型、BFC（弹性、浮动、定位），Layout Tree DOM 节点在屏幕的精确位置，尺寸等几何布局信息

合成线程：
- 合并图层
- 渲染引擎 绘制



### JavaScript 本身只是一门语言规范（ECMAScript），它定义了变量、函数、循环怎么写。但它并没有定义“如何发网络请求”或“如何开计时器”。

这些能力是由载体提供的：
  - `浏览器环境（Chrome/Edge）`： 提供 DOM、BOM、Web API（setTimeout, fetch）、多进程/多线程架构。

  - `Node.js 环境`： 提供文件系统（fs）、网络（http）、Buffer、Libuv 事件循环。 
    
    当你执行 npm init 时，你只是创建了一个空的项目说明书。当你运行代码时，是你电脑上安装的那个 node.exe（Node 运行时） 提供了所有的线程支持。

#### `浏览器`中运行的 `JavaScript` 代码，是在渲染主线程中执行的。
- 主线程任务：JS执行 + 渲染(DOM/CSS) + 布局
- 异步实现依靠：计时器线程、IO线程、网络进程
- 网络请求：**跨进程**发给`网络进程`
- 文件操作	严禁直接操作（安全原因）

#### Node.js 运行时
- 主线程任务：仅 JS 执行（没有 UI 渲染）
- 异步实现依靠：`Libuv 线程池` (Thread Pool)
- 网络请求：调用操作系统的`系统内核` (Kernel)
- 文件操作：通过 `Libuv 线程池`异步执行

## 浏览器运行

**JS 执行 开始于一个script 标签**
<script src="" type="module"></script>
  同步代码（尽快运行结束），异步代码（耗时的，未来的，事件的promise async await setTimeout,setInterval，addEventListener，...）

  - 消息机制
  - Event Loop
    第一个宏任务 script
    同步代码全部执行完，碰到异步任务就放入宏任务（setTimeout... 队列，每次只会取一个宏任务执行）或微任务队列（Promise 先进先出 一次清空所有微任务）
  - 当有一个耗时性任务时，会先去注册一个异步任务，假设是 `setTimeout` ，会将其放入计时器线程中，等待时机成熟，再将其放入宏任务队列中等待执行。如果是 `Promise` ，也会注册到微任务队列中，只有当异步操作完成，调用了 `resolve()` 或 `reject()` ，Promise 的状态从 `pending` 变为 `fulfilled` 或 `rejected` 的那一刻，引擎才会把对应的回调函数“拎出来”，**推入微任务队列**。

### 不同的任务，不同的“注册地”
主线程在执行代码时，一旦发现异步任务，就会立刻将其“登记”到对应的辅助模块中：

#### 定时器任务 (setTimeout, setInterval)
- 注册地：定时器线程 (Timer Thread)。
- 动作：主线程告诉它：“帮我盯着这 1000ms，时间到了喊我。”
- 后续：定时器线程开始独立计时。

#### 网络请求 (fetch, XMLHttpRequest)
- 注册地： 网络进程 (Network Process)。
- 动作： 渲染进程通过 IPC（进程间通信）发消息给浏览器主进程，主进程再叫网络进程去下载资源。
- 后续： 网络进程在后台下载，主线程继续干别的。

#### 用户交互事件 (addEventListener)
- 注册地： 事件触发线程。
- 动作： 告诉它：“帮我盯着这个按钮，只要用户点了，就通知我。”
- 后续： 操作系统监控到点击，发消息给事件触发线程。


#### Promise 回调 (.then, .catch)
- 注册地： JS 引擎内部 (V8 内存空间)。
- 动作： 如果 Promise 还没完成，回调会被存在 Promise 的 [[PromiseFulfillReactions]] 列表里。
- 后续： 一旦 resolve 被调用，JS 引擎直接把这些回调推入微任务队列。


### 程序运行模型
- 主（单）线程模型
顺序执行的，执行完，线程会自动退出。
简单、高效  阻塞（异步来解决阻塞问题）
- 在主线程过程中处理新的任务（优先级更高）
  I/O 任务，点击事件，键盘事件，就要采用事件循环机制
  单线程机制下，要去响应众多任务设计出来的执行机制

  ``` C++
  //GetInput
  //等待用户从键盘输入一个数字，并返回该输入的数字
  int GetInput(){
    int input_number = 0;
    cout<<"请输入一个数:"; // 会让主线程一直阻塞在输入等待状态
    cin>>input_number;
    return input_number;
  }

  //主线程(Main Thread)
  void MainThread(){
    for(;;){
      int first_num = GetInput()；
      int second_num = GetInput()；
      result_num = first_num + second_num;
      print("最终计算的值为:%d",result_num)；
    }
  }
  ```

  相对于之前的单线程，有两个改变
  - 循环机制，一直检测
  - 引入了事件
  Event + Loop = Event Loop 线程是活的

  - 处理其他线程发送过来的任务
  网络进程 消息机制 + Event Loop（JS执行机制）

渲染主线程会频繁接收到来自于 IO 线程的一些任务，接收到这些任务之后，渲染进程就需要着手处理，比如接收到资源加载完成的消息后，渲染进程就要着手进行 DOM 解析了；接收到鼠标点击的消息后，渲染主线程就要开始执行相应的 JavaScript 脚本来处理该点击事件。

优先级别 队列搞定
宏任务队列 一次只会执行一个
微任务队列 一次全清空