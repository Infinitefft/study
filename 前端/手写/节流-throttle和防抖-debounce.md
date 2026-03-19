# 手写节流和防抖

> 在事件监听时，有些事件会触发的非常频繁并且没必要每次都处理，可以间隔处理，那么可以通过节流来进行性能优化。

## `两种的 JavaScript 简易实现：`
``` JavaScript
// 防抖（执行最后一次）
function debounce(fn, delay = 300) {
  let timer = null;

  // 返回一个函数，且形成闭包
  return function(...args) {
    if (timer) {   // 如果存在上一个定时器，说明在小于delay时有输入，那么直接清理掉上一个定时器
      clearTimeout(timer);
    }

    // 重开一个定时器
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}


// 节流（间隔执行）
function throttle(fn, delay = 300) {
  let timer = null;

  return function(...args) {
    if (timer) {  // 如果有上一个，不清除定时器，每delay执行一次
      return;  // 直接返回，不会执行下面代码导致新开一个定时器
    }

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  }
}

```

## `节流:`
``` TypeScript
type ThrottleFunction = (...args: any[]) => void;

export function throttle(fun: ThrottleFunction, delay: number): ThrottleFunction {
  let last: number | undefined;
  let deferTimer: NodeJS.Timeout | undefined;

  // return function 是为了把 last、timer 这些状态闭包包住，让每次调用都共享同一份状态。
  return function (...args: any[]) {
    const now = +new Date();

    if (last && now < last + delay) {   // 小于间隔时间，节流
      clearTimeout(deferTimer);  // 清掉上一次未执行的定时器
      deferTimer = setTimeout(function () {  // 重新设置一个定时器
        last = now;
        fun(...args);   // 执行一次
      }, delay);   // 等 delay 后再执行
    } else {   // 超过间隔时间，直接执行
      last = now;
      fun(...args);
    }
  };
}

// =========================


// 例如：
window.addEventListener('scroll', throttle(fn, 1000));
// fn 为业务函数，scroll 触发频繁，需要节流
```


## `防抖:`

> 只需要存储最后一次的值（`大于 delay`），如果在delay

### `react:`
``` jsx
import {
  useState,
  useEffect,
} from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounceValue, setDebounceValue] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounceValue(value);
      // 只有在 delay 的间隔期间没有任何输入才会执行这个 setDebounceValue 宏任务
    }, delay)

    return () => {
      clearTimeout(id);
      // 如果每次输入都 delay 间隔期间那么都会导致 useEffect 依赖项的变化
      // 那么也就会在新的 useEffect 之前时都会调用清理函数将定时器清除
      // 所以输入间隔小于 delay 的 setDebounceValue 不会执行
    }
  }, [value, delay]);
  return debounceValue;
}
```