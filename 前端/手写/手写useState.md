# 手写 useState

简易版的 useState 实现


`index.js`
``` js
let isMount = true;
let workInProgressHook = null;

const fiber = {
    stateNode: App,
    memoizedState: null,  // 保存的是一条链表，每一个hook的state
}

function useState(initialState) {
    let hook;

    if (isMount) {
        hook = {
            memoizedState: initialState,
            next: null,
            queue: {
                pending: null
            }
        }
        if (!fiber.memoizedState) {
            fiber.memoizedState = hook;
        } else {
            workInProgressHook.next = hook;
        }
        workInProgressHook = hook;
    } else {
        hook = workInProgressHook;
        workInProgressHook = workInProgressHook.next;
    }

    let baseState = hook.memoizedState;

    if (hook.queue.pending) {  // 本次更新有updata需要执行
        let firstUpdate = hook.queue.pending.next;

        do {
            const action = firstUpdate.action;
            baseState = action(baseState);
            firstUpdate = firstUpdate.next;
        } while (firstUpdate !== hook.queue.pending.next);

        hook.queue.pending = null;
    }

    hook.memoizedState = baseState;
    return [baseState, dispatchAction.bind(null, hook.queue)];
}

function dispatchAction(queue, action) {
    const update = {
        action,
        next: null
    }

    // queue.pending 保存的是一个最后一个updata,queue.pending.next 指向第一个updata
    if (queue.pending === null) {  // 第一次调用
        update.next = update;
    } else {
        update.next = queue.pending.next;
        queue.pending.next = update;
    }
    queue.pending = update;

    schedule();
}


function schedule() {
    workInProgressHook = fiber.memoizedState;
    const app = fiber.stateNode();
    isMount = false;
    return app;
}


function App() {
    const [num, updataNum] = useState(0);
    const [num1, updataNum1] = useState(10);

    console.log('isMount?', isMount);
    console.log('num?', num);
    console.log('num1?', num1);

    return {
        onClick() {
            updataNum(num => num + 1);
        },
        onFocus() {
            updataNum1(num1 => num1 + 10);
        }
    }
}

window.app = schedule();
```

`index.html:`
``` html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <script src="./index.js"></script>
</body>
</html>
```