# 手写节流

> 在事件监听时，有些事件会触发的非常频繁并且没必要每次都处理，可以间隔处理，那么可以通过节流来进行性能优化。

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