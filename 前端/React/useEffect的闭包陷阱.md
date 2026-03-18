# useEffect的闭包陷阱

> 闭包陷阱发生在异步回调（如 setInterval, setTimeout, Promise）中。由于这些函数在创建时“捕获”了当时那一帧的状态快照，导致后续执行时无法获取最新的 State。

实现一个简单的 Hook ，每秒将值增加 1 。

`有问题的：`
``` jsx
import { useState, useEffect } from 'react';

export default function useCountAdd(count) {
  const [cnt, setCnt] = useState(count);

  useEffect(() => {
    const id = setInterval(() => {
      // 问题点：这个函数只在挂载时创建一次（依赖为空时）
      // 它捕获了初始的 cnt (0)，所以永远在执行 setCnt(0 + 1)
      setCnt(cnt + 1); 
    }, 1000);

    return () => clearInterval(id);
  }, []); // 如果为了性能不把 cnt 加在这里，就会产生闭包陷阱

  return cnt;
}
```
为啥？`setInterval` 里的匿名函数在组件第一次渲染时被创建，它“记住”了当时的 `cnt` 是 `0` 。即便页面渲染到了第 10 秒，这个定时器**依然在试图把 0 改成 1**。

### 解决方案：

#### 1. 利用 `setState` 接受函数作为参数，直接从 React 内部状态池获取最新值，彻底绕过闭包。
``` jsx
export default function useCountAdd(initialCount) {
  const [cnt, setCnt] = useState(initialCount);

  useEffect(() => {
    const id = setInterval(() => {
      // 不读取外部变量，直接告诉 React 在最新值基础上 +1
      setCnt(prev => prev + 1);
    }, 1000);

    return () => clearInterval(id);
  }, []); // 依赖为空，定时器永不重启，性能最优

  return cnt;
}
```

#### 2.使用 `useRef` 
> `useRef` 的 `.current` 属性是可变的地址，不随渲染产生快照

``` jsx
import { useState, useEffect, useRef } from 'react';

export default function useCountAdd(initialCount) {
  const [cnt, setCnt] = useState(initialCount);
  const cntRef = useRef(cnt);

  // 每次渲染完成后，更新 Ref 里的最新状态
  useEffect(() => {
    cntRef.current = cnt;
  });

  useEffect(() => {
    const id = setInterval(() => {
      // 通过 Ref 拿到的永远是柜子里最新的值
      setCnt(cntRef.current + 1);
    }, 1000);

    return () => clearInterval(id);
  }, []); 

  return cnt;
}
```

#### 3. 使用 `useEffectEvent`
React 官方提供的特殊 Hook，专门用于提取“非响应式”逻辑，使其能读取`最新 State` 但不触发 `Effect 重启`。

``` jsx
import { useState, useEffect, useEffectEvent } from 'react';

export default function useCountAdd(initialCount) {
  const [cnt, setCnt] = useState(initialCount);

  // 该函数内部永远能看到最新的 cnt，但它被视为“非响应式”的
  // 返回
  const onTick = useEffectEvent(() => {
    setCnt(cnt + 1);
  });

  useEffect(() => {
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
  }, []);

  return cnt;
}
```

在普通的 React 逻辑中，如果你想让一个函数访问`最新的 state`，你通常需要把它写在 `useEffect 内部`，**或者作为依赖项**。

而 `useEffectEvent` 返回的函数：

`静态引用`：这个函数在组件的多次渲染之间，其引用（内存地址）是恒定不变的。

`动态内容`：虽然引用不变，但当你调用它时，它内部执行的逻辑永远是当前`最新一帧的代码和状态`。