# 双 token 机制无感刷新

> 前端请求接口时，如果 `access token` 过期，前端则请求 `refresh token` 接口刷新 `access token`，然后再请求原始接口。

## api/config.ts 拦截器实现无感刷新：

``` ts
import axios from 'axios';
import { useUserStore } from '@/store/user';


// instance 拦截器
// instance 即为 axios 实例
const instance = axios.create({
  baseURL: 'http://localhost:3001/api',
})

// 请求拦截器，在请求发送前添加 token
instance.interceptors.request.use(config => {
  const token = useUserStore.getState().accessToken;
  if (token) {
    // 将 token 添加到请求头
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
})


// 实现无感刷新token

// 是否在刷新token
let isRefreshing = false;

// 请求队列，refresh 中，在并发的请求再去发送没有意义
// 保存下来，存到一个队列中，无缝地将之前的所有失败的请求，再请求，带上新的token 就会成功
let requestQueue: any[] = [];

instance.interceptors.response.use(res => {
  // console.log('////[][][]');
  // console.log("|||||||", res);
  // if (res.status != 200) {
  //   console.log("出错了");
  //   return;
  // }
  // 来到这里说明成功响应
  // 直接返回 res.data ，那么别的 api 下直接返回 res 即可
  return res.data;
}, async (err) => {
  // 说明响应不成功，需要去刷新token
  const { config, response } = err;
  // config：原始请求的配置对象，包括 url、method、headers、data，自己加的token 等
  // 鉴权不成功返回 401 Unauthorized。
  if (response?.stauts === 401 && !config._retry) {
    // 401 就是token过期，如果token 过期了
    if (isRefreshing) {
      // 刷新了一次 token
      // 当 access_token 过期（401）时，你只想 刷新一次 token，而不希望并发的其他请求也去刷新。
      // 所以使用了一个队列 requestQueue 来存放这些请求的回调。
      // 刷新 token 完成后，会依次执行队列里所有请求，带上新的 token。
      return new Promise((resolve) => {  // 这就意味着当前请求被 挂起，不会继续执行后面的刷新逻辑
        // requestQueue 里存的是 (token: string) => void 类型的函数。
        // token刷新完成后再依次拿到队列中的回调，然后再带上新的token 发送新的请求
        requestQueue.push((token: string) => {
          config.headers.Authorization = `Bearer ${token}`
          // resolve 是 Promise 的成功回调函数，也就是用来告诉外部 “这个 Promise 已经完成，并返回结果了”。
          // instance(config) 发送请求
          // config 闭包，每个回调函数都会带上自己的config（原始请求对象）
          resolve(instance(config));
        });
      })
    }
    // retry 是每个请求自己的，如果一个请求进来了并且 isRefreshing 为 true，那么这个请求就会进入队列
    // 并且 retry 为 true 那么再请求就不会来到这
    config.retry = true;  // retry 开关  防止同一个请求无限循环刷新 token
    isRefreshing = true;  // 刷新一次 token

    try {
      const { refreshToken } = useUserStore.getState();  // 拿到前端存储的 refreshtoken 去刷新
      if (refreshToken) {
        // 拿到刷新的 token
        const { access_token, refresh_token } = await instance.post('/auth/refresh', {
          refresh_token: refreshToken
        });
        // 存到前端本地存储
        useUserStore.setState({
          accessToken: access_token,
          refreshToken: refresh_token,
          isLogin: true,
        });
        // 重新对之前刷新时的网络请求带上新的token进行请求
        // 队列存储的都是回调函数
        // (callback) => callback(access_token) 去调用存储的
        requestQueue.forEach((callback) => callback(access_token)); 
        requestQueue = [];

        config.headers.Authorization = `Bearer ${access_token}`
        // 原始请求的请求头带上新的 token
        // 若 refreshtoken 还有效 那么就会后续就会触发回调
        return instance(config);   // 触发刷新 token 的第一个请求重试
      }
    } catch (err) {
      window.location.href = '/login';
      return Promise.reject(err);   // 出错
    } finally {
      isRefreshing = false;
    }
  }
  // refreshtoken 也失效了，那么第一个失败的请求也就失败了
  // 第一个请求就失败了，队列里的请求也不会被执行
  // reject 是 Promise 的失败回调
  return Promise.reject(err);   // 外层 async 函数的默认返回
})


export default instance;
```