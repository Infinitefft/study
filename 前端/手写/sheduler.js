class Scheduler {
    constructor(limit = 2) {
        this.limit = limit;
        this.runningCount = 0;   // 正在执行的个数
        this.queue = [];   // 等待执行的个数
        // 想象成定长滑动窗口
    }

    async add(promiseCallback) {
        if (this.runningCount >= this.limit) {
            // 如果超过，利用await特性，让当前任务的代码停在这里
            // 只有改变这个 new Promise 的状态（不为 pending）才会放行
            // 这个resolve就是个开关，调用了则改变状态
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.runningCount++;  // 来到这里说明窗口大小不超过limit，此时窗口长度+1

        try {
            // 执行当前任务
            // 加个 await ，下面的finally才能捕捉到
            return await promiseCallback();
        } finally {
            // 不管 promiseCallback 是否成功，至少已经执行完成了
            // 丢掉，类似滑窗 l++ ，缩小窗口
            this.runningCount--;
            // 完成窗口内的一个任务，如果队列中有任务等待执行，则调用resolve
            // 相当于如果右边还没到数组边界，那么右窗口扩大，放进来新的任务运行
            const nextResolve = this.queue.shift();
            // 调用了 resolve 改变状态，那么任务则会被放行
            if (nextResolve) {
                nextResolve();
            }
        }
    }
}