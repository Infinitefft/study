class MyPromise {
    // executor 就是 new Promise((resolve, reject) => {}) 里的 (resolve, reject) => {}
    // executor 会理解执行
    constructor(executor) {
        // 初始化状态
        this.status = 'pending';
        this.value = undefined;
        this.reason = undefined;

        // 初始化回调队列（订阅发布者模式）
        this.onResolvedCallbacks = [];
        this.onRejectedCallbacks = [];

        // resolve 和 reject 的使命是改变当前实例的状态。
        // 在 constructor 内部定义这两个函数，可以形成闭包
        // 可以直接访问并修改当前实例的 this.status 和 this.value。
        // 并且使用箭头函数，保证 this 指向当前 MyPromise 实例
        const resolve = (value) => {
            if (this.status === 'pending') {
                this.status = 'fulfilled';
                this.value = value;
                // 发布：状态改变了，把之前存起来的的成功回调函数拿出来执行
                this.onResolvedCallbacks.forEach(fn => fn());
            }
        }

        
        const reject = (reason) => {
            if (this.status === 'pending') {
                this.status = 'rejected';
                this.reason = reason;
                // 发布
                this.onRejectedCallbacks.forEach(fn => fn());
            }
        }

        try {
            executor(resolve, reject);
        } catch(e) {
            reject(e);
        }
    }


    then(onFulfilled, onRejected) {
        // 规范规定：如果 then 传的不是函数，就忽略它，并把值原样向后传递。
        // 比如：p.then().then().then(res => console.log(res))，
        // 前面的 then 没传参数，值要能穿透到最后
        onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
        onRejected = typeof onRejected === 'function' ? onRejected : err => { throw err; };

        let promise2 = new MyPromise((resolve, reject) => {
            if (this.status === 'fulfilled') {
                setTimeout(() => {
                    try {
                        let x = onFulfilled(this.value);
                        resolvePromise(promise2, x, resolve, reject);
                    } catch(e) {
                        reject(e)
                    }
                }, 0)
            }

            if (this.status === 'rejected') {
                setTimeout(() => {
                    try {
                        let x = onRejected(this.reason);
                        resolvePromise(promise2, x, resolve, reject);
                    } catch (e) {
                        reject(e)
                    }
                }, 0);
            }

            if (this.status === 'pending') {
                // 订阅：这时候我们不知道未来是成功还是失败，所以不能立刻执行回调。
                // 我们把回调包装一下，存到对应的数组里。等未来 resolve 或 reject 被调用时，再拿出来执行。
                this.onResolvedCallbacks.push(() => {
                    setTimeout(() => {
                        try {
                            let x = onFulfilled(this.value);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    }, 0);
                });

                this.onRejectedCallbacks.push(() => {
                    setTimeout(() => {
                        try {
                            let x = onRejected(this.reason);
                            resolvePromise(promise2, x, resolve, reject);
                        } catch (e) {
                            reject(e);
                        }
                    }, 0);
                });
            }
        })

        return promise2;
    }
}



function resolvePromise(promise2, x, resolve, reject) {
    // 循环引用检测
    // 如果 then 的回调里返回了 promise2 本身，会导致死循环。
    // 比如：let p2 = p.then(() => { return p2; })
    // 规范规定：如果 promise2 和 x 相等，必须抛出 TypeError
    if (promise2 === x) {
        return reject(new TypeError('Chaining cycle detected for promise'));
    }

    // 防止多次调用
    let called = false;

    if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
        try {
            // 尝试去取 x 的 then 方法
            let then = x.then;
            if (typeof then === 'function') {
                // 如果 then 是一个函数，我们就认定 x 是一个 promise 或者是thenable
                // 既然 x 是promise，promise2 的状态就得跟着x 的状态走
                // 我们不写 x.then(...)，而是用 then.call(x)，这是为了防止多次读取 x.then 触发 getter 造成副作用
                then.call(x, y => {
                    // x 成功了，拿到结果y
                    if (called) {
                        return;
                    }
                    called = true;
                    // 极其关键的一步：y 有可能还是一个 Promise！
                    // 比如：p.then(() => new Promise(res => res(new Promise(...))))
                    // 所以必须递归调用 resolvePromise，直到解析出一个普通值为止！
                    resolvePromise(promise2, y, resolve, reject)
                }, reason => {
                    if (called) {
                        return;
                    }
                    called = true;
                    // x 失败了，promise2 也跟着失败
                    reject(reason);
                })
            } else {
                // 如果 then 不是函数（比如 x 只是一个普通对象 { a: 1 }）
                // 那 x 就是一个普通值，直接让 promise2 成功
                resolve(x);
            }
        } catch (error) {
            // 取 then 的时候报错了（比如 x 上定义了恶意的 getter 抛错），或者执行 then 报错了
            if (called) {
                return;
            }
            called = true;
            // 直接让 promise2 失败
            reject(error);
        }
    } else {
        // x 是一个普通值（比如字符串 'hello'、数字 123、布尔值 true 等）
        // 没有任何悬念，直接让 promise2 成功，值为 x
        resolve(x);
    }
}