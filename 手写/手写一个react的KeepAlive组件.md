# 手写 KeepAlive 组件

> 在一个应用中，例如京东、淘宝，用户在浏览商品时会频繁的进入一个商品详情然后回到首页，接在进入另一个详情页再回到首页。那么首页就会**不断地挂载，重复渲染**，首页非常重要，那么可以使用 `react-activation` 进行缓存。通过控制 $CSS$ 中的 `display` 来进行隐藏和展示。性能更好，即再次显示时，只是修改一个 $CSS$ 属性，**不需要**重新创建 $DOM$ 。


> 在项目之中，在路由中通过 `AliveScope` 包裹路由来控制缓存的范围，再使用 `KeepAlive` 包裹来表示需要缓存的

例如：

`router/index.tsx` 中：
``` tsx
// 
import {
  Suspense,
  lazy,
} from 'react'

import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom'


import Loading from '@/components/Loading'
import MainLayout from '@/layouts/MainLayout'
import { AliveScope } from 'react-activation'


const Home = lazy(() => import('@/components/KeepAliveHome'));
const Mine = lazy(() => import('@/pages/Mine'));
const Login = lazy(() => import('@/pages/Login'));
const Order = lazy(() => import('@/pages/Order'));
const Chat = lazy(() => import('@/pages/Chat'));
const PostLayout = lazy(() => import('@/layouts/PostLayout'));
const PostDetail = lazy(() => import('@/pages/post'));


export default function RouterConfig({children} : {children: React.ReactNode}) {
  return (
    <Router>
      <AliveScope>
        {/* 需要缓存的范围 */}
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Post 模块 */}
            <Route path="/post" element={<PostLayout />} > 
              <Route path=":id" element={<PostDetail />} />
            </ Route>

            {/* 布局功能 */}
            <Route path="/" element={<MainLayout/> }>
              <Route path="" element={<Home />}></Route>
              <Route path="chat" element={<Chat />}></Route>
              <Route path="order" element={<Order />}></Route>
              <Route path="mine" element={<Mine />}></Route>
            </Route>
          </Routes>
        </Suspense>
      </AliveScope>
      {children}
    </Router>
  )
}
```

--- 

`components/KeepAliveHome.tsx` 中：
``` tsx
import { KeepAlive } from 'react-activation'
import Home from '@/pages/Home'


const KeepAliveHome = () => {
  return (
    // 将每个被 <KeepAlive> 包裹的组件视为一个“缓存实体”。name 是这个实体的 Key。
    <KeepAlive name="home" saveScrollPosition="screen">
      <Home />
    </KeepAlive>
  )
}

export default KeepAliveHome

```

--- 

> 我们手写的 $KeepAlive$ 则需要**包裹住需要缓存的**，即作为 `children` 传入，另外还需要要一个 `activeId` 表示**展示哪一个**。

### 下面来手写实现缓存和切换：

> 先在 `App.jsx` 中创建两个简单的组件用来模拟：`CounterA` 和 `CounterB`

``` jsx
import {
  useState,
  useEffect,
} from 'react';

import KeepAlive from './components/KeepAlive.jsx';


const CounterA = ({ name }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("挂载", name);
    return () => {
      console.log("卸载", name);
    }    
  }, [])

  return (
    <div style={{padding: '20px', border: '1px solid #ccc'}}>
      <h3>{name} 视图</h3>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>点击加1</button>
    </div>
  )
}

const CounterB = ({ name }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("挂载", name);
    return () => {
      console.log("卸载", name);
    }    
  }, [])

  return (
    <div style={{padding: '20px', border: '1px solid #ccc'}}>
      <h3>{name} 视图</h3>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>点击加1</button>
    </div>
  )
}


const App = () => {
  const [activeTab, setActiveTab] = useState('A');

  return (
    <div>
      <div style={{marginBottom: '20px'}}>
        <button onClick={() => setActiveTab('A')}>显示A组件</button>
        <button onClick={() => setActiveTab('B')}>显示B组件</button>
      </div>
      {/* children 提升组件的定制能力 给父组件方便 */}
      <KeepAlive activeId={activeTab}>
        { activeTab === 'A' ? <CounterA name="A" /> : <rCounterB name="B" /> }
      </KeepAlive>
    </div>
  )
}

export default App
```

---

> `KeepAlive.jsx:`

``` jsx
import {
  useState,
  useEffect,
} from 'react';

const KeepAlive = ({
  activeId,
  children,
}) => {
  const [cache, setCache] = useState({});  // 缓存组件的 存的是对象
  // console.log(children, "--------");
  useEffect(() => {
    // activeId updata 切换显示
    // children updata 保存
    if (!cache[activeId]) {  // 缓存里没有，那就进行缓存
      // activeId key 
      setCache((pre) => ({
        ...pre,   // 展开之前缓存的
        [activeId]: children  // 为新来的进行缓存
      }))
    }
    // console.log(cache, "????????");
  }, [activeId, children, cache])
  return (
    <>
      {
        // 由于对象并没有 map 遍历方法，那么需要将 cache 转成数组
        // 接着进行 map 遍历来判断当前 id 是否与 activeId 匹配来判断显隐
        // Object.entries 对象变成数组，变成 [key, value] 形式
        // 那么 key 可以刚好设为当前的 id
        // [key, value] 又方便使用
        Object.entries(cache).map(([id, components]) => (
          // 通过 CSS 的 display 来进行显示和隐藏操作
          <div key={id} style={{display: id === activeId ? 'block' : 'none'}}
          >
            {components}
          </div>
        ))
      }
    </>
  )
}

export default KeepAlive
```