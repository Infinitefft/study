# 手写 zustand


> `create` 接收一个函数，函数的参数是 `set` 和 `get` ，**返回一个对象**，对象的属性是 `state` 对象的属性（ `state` 是一个对象，包含了**所有需要管理的状态**）。

`例如:`
``` ts
export  const useUserStore = create<UserStore>() (
  persist((set, get) => ({  // state 对象
    accessToken: null,
    refreshToken: null,
    user: null,
    isLogin: false,
    login: async ({name, password}) => {
      const res = await doLogin({name, password});
      console.log(res, '??????');
      const { access_token, refresh_token, user } = res;
      // console.log(access_token, refresh_token, user);
      set({
        user: user,
        accessToken: access_token,
        refreshToken: refresh_token,
        isLogin: true,
      })
    },
    aiAvatar: async () => {
      // coze title desc 生成应用的 logo
      const name = get().user?.name;
      const avatar = await getAiAvatar(name);
      set({
        user: {
          ...get().user,
          avatar,
        }
      })
    },
    logout: () => {
      set({
        user: null,
        isLogin: false,
        accessToken: null,
        refreshToken: null,
      })
    }
  }), {
    name: 'user-store',
    partialize: (state) => ({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      user: state.user,
      isLogin: state.isLogin,
    })
  })
)
```


## 手写

`先看完整版：`
``` js
import {
  useEffect,
  useState,
} from 'react';


// createState 创建状态的函数
// set 第一个参数
// get 第二个参数
// 模块私有的方法
const createStore = (createState) => {
  let state;  // 需要根据createState 初始化状态
  // 初始化
  const listeners = new Set();
  const getState = () => state;
  // 修改状态
  // partial 部分更新
  // 函数
  // replace 是否替换状态
  const setState = (partial, replace = false) => {
    const nextState = typeof partial === 'function' ? partial(state): partial;
    // Object.is(val1, val2) 比较两个值是否相等
    // 指向同一个内存地址（或者是相同的原始值），它返回 true
    if (!Object.is(nextState, state)) {
      const previousState = state;
      if (!replace) {  // 替换的方式更新
        state = (typeof nextState !== 'object' || nextState === null)
          ? nextState
          : Object.assign({}, state, nextState);
      } else {
        state = nextState;
      }
      // 通知所有订阅者
      listeners.forEach(listener => listener(state, previousState));
    }
  }
  
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);  // 取消订阅，在下面 useStore 中的 useEffect 中调用
    }
  }

  const destory = () => {
    listeners.clear();
  }

  const api = {
    setState,
    getState,
    subscribe,
    destory,
  }

  state = createState(setState, getState, api);  // 初始化状态
  return api;
}

// hooks 方便任何组件使用这个仓库
const useStore = (api, selector) => {
  // api 仓库里的状态
  // selector 局部
  // 局部状态，只需要修改状态的方法
  const [, forceRender] = useState(0);
  useEffect(() => {
    // 自动订阅 不需要手动subscribe
    // 只关心的状态 改变了
    const unsubscribe = api.subscribe((state, previousState) => {
      const newObj = selector(state);  // 关心的才会改变
      const oldObj = selector(previousState);
      if ((newObj !== oldObj)) {
        forceRender(Math.random());  // 强制组件刷新
      }
    })
    return () => unsubscribe();  // 防止组件卸载后还在内存里偷偷跑监听逻辑
  }, []);

  return selector(api.getState());   // 返回初始值
}

// 高阶函数
// 返回一个函数 useXXXStore
// useXXXStore 可以接收一个函数，返回某一些状态或方法。
export const create = (createState) => {
  // 返回 subscribe 方法
  const api = createStore(createState);
  // selector 选择哪个属性，哪个方法
  const useBoundStore = (selector) => {
    return useStore(api, selector);
  }
  Object.assign(useBoundStore, api);  // 这行代码让我们可以像调用对象属性一样调用 Hook，例如 useUserStore.getState()。在 JavaScript 中，函数本质上也是对象，这种模式在现代库（如 Axios, Zustand）中非常流行。
  return useBoundStore;
}
```


## App.jsx 中使用

``` jsx
import React from 'react';
// 假设上面的代码保存在 store.js 文件中
import { create } from './zustand';

// 1. 创建 Store
// createState 接收 (set, get, api) 参数
const useCounterStore = create((set, get, api) => ({
  count: 0,
  text: '初始文本',
  // 定义一个动作方法（也可以直接在组件里调用 set，但封装在 store 里更清晰）
  increment: () => set((state) => ({ count: state.count + 1 })),
  updateText: (newText) => set({ text: newText }),
}));

// --- 子组件 A：只关心 count ---
// 当 text 变化时，这个组件【不会】重新渲染，因为 selector 返回的 count 没变
const CountDisplay = () => {
  console.log('CountDisplay 渲染了');
  
  // 选择器：只提取 count
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);

  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px' }}>
      <h3>计数器组件 (只订阅 count)</h3>
      <p>当前计数: {count}</p>
      <button onClick={increment}>增加 Count</button>
      <p style={{fontSize: '12px', color: '#666'}}>
        (尝试修改下方的 Text，此组件不会重新渲染)
      </p>
    </div>
  );
};

// --- 子组件 B：只关心 text ---
// 当 count 变化时，这个组件【不会】重新渲染
const TextDisplay = () => {
  console.log('TextDisplay 渲染了');

  // 选择器：只提取 text
  const text = useCounterStore((state) => state.text);
  const updateText = useCounterStore((state) => state.updateText);

  return (
    <div style={{ border: '1px solid #ccc', padding: '10px', margin: '10px' }}>
      <h3>文本组件 (只订阅 text)</h3>
      <p>当前文本: {text}</p>
      <input 
        value={text} 
        onChange={(e) => updateText(e.target.value)} 
        placeholder="输入新文本"
      />
       <p style={{fontSize: '12px', color: '#666'}}>
        (尝试点击上方的 Count，此组件不会重新渲染)
      </p>
    </div>
  );
};

// --- 子组件 C：演示直接调用 API (不通过 Hook) ---
const ApiDemo = () => {
  const handleDirectUpdate = () => {
    // 直接通过挂载在 Hook 上的 API 修改状态
    // 这证明了 Object.assign(useBoundStore, api) 生效了
    useCounterStore.setState((prev) => ({ 
      count: prev.count + 10, 
      text: '通过 API 直接批量修改!' 
    }));
    
    // 也可以直接读取最新状态（不触发渲染）
    console.log('当前最新状态:', useCounterStore.getState());
  };

  return (
    <div style={{ border: '1px dashed red', padding: '10px', margin: '10px' }}>
      <h3>API 直接调用演示</h3>
      <button onClick={handleDirectUpdate}>
        点击直接调用 setState (Count+10 & 改文本)
      </button>
    </div>
  );
};

// --- 主组件 App ---
export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Zustand 简易版实现演示</h1>
      <p>打开浏览器控制台 (Console) 观察 "xxx 渲染了" 的日志，验证局部更新。</p>
      
      <div style={{ display: 'flex' }}>
        <CountDisplay />
        <TextDisplay />
      </div>
      
      <ApiDemo />
    </div>
  );
}
```


## 一些理解的点：

### 全局状态的定义：

``` js
const useCounterStore = create((set, get, api) => ({
  count: 0,
  text: '初始文本',
  // 定义一个动作方法（也可以直接在组件里调用 set，但封装在 store 里更清晰）
  increment: () => set((state) => ({ count: state.count + 1 })),
  updateText: (newText) => set({ text: newText }),
}));
```

可以看到，我们使用了 `create` 函数来创建一个**全局**状态的 `store` ，这个 `useCounterStore` 被作为一个 `Hook` 函数，可以在组件中直接使用。这个 `Hook` 函数返回一个对象，对象中包含了全局状态的所有属性和方法。

我们接下来看三个部分的定义：
``` js 
// 第一部分
const createStore = (createState) => {
  let state;
  const listeners = new Set();
  const getState = () => state;
  const setState = (partial, replace = false) => {}
  const subscribe = (listener) => {}
  const destory = () => {}
  const api = {setState,getState,subscribe,destory,}

  state = createState(setState, getState, api);
  return api;
}
```

``` js
// 第二部分
const useStore = (api, selector) => {
  const [, forceRender] = useState(0);
  useEffect(() => {

  }, []);
  return selector(api.getState());
}
```

``` js
// 第三部分
export const create = (createState) => {
  const api = createStore(createState);
  const useBoundStore = (selector) => {
    return useStore(api, selector);
  }
  Object.assign(useBoundStore, api);
  return useBoundStore;
}
``` 

先看 `create` ，我们定义全局状态的时候使用 `create` 方法并传入一个函数，这个函数有 `set, get` 三个参数，并且返回一个对象，
状态定义时的函数
``` js
(set, get, api) => ({
  count: 0,
  text: '初始文本',
  // 定义一个动作方法（也可以直接在组件里调用 set，但封装在 store 里更清晰）
  increment: () => set((state) => ({ count: state.count + 1 })),
  updateText: (newText) => set({ text: newText }),
})
```
这个就是 `createState` 函数，我们用 `state = createState(setState, getState, api);` 来接收返回值，这个返回值就是创建状态时的状态对象。`state` 就是全局所有状态的存储对象。

### `selector` 是啥呢？

第三部分 `create` 函数有中：

``` js
const useBoundStore = (selector) => {
  return useStore(api, selector);
}
```

`App.jsx` 组件中消费数据时：

``` jsx
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
```

可以看到 `useCounterStore` 传入了一个函数，可以知道这个函数其实就是 `selector` ，这个函数的参数是 `state` 。
所以在第二部分 `useStore` 中：
``` js
const newObj = selector(state);
const oldObj = selector(previousState);
```

其实就是 `newObj = state.(...)` 如果是调用 `useCounterStore` 的是 `((state) => state.count)` ，那么 newObj 就是 `state.count` 
最后 `useStore` 返回:
``` js
return selector(api.getState());
```

以及 `create` 中接收：
``` js
const useBoundStore = (selector) => {
  return useStore(api, selector);  // 接收返回值
}
Object.assign(useBoundStore, api);
return useBoundStore;

// App.jsx 中消费时：
// const count = useCounterStore((state) => state.count);
// count 则拿到了全局状态的 count 属性值
```