Function.prototype.myCall1 = function(context) {
    // this 的指向有一个最基本的规则：谁调用函数，this 就指向谁。
    // 如果 Obj1.Mycall(this)
    // 此时 context 指向 Obj1
    // 原生的 call 有一个特性：如果你传的 context 是基本类型（比如数字、字符串），它会自动把它变成对象。
    if (context === null || context === undefined) {
        context = window;
    } else {
        context = Object(context); // 这样数字 1 就变成了 Number 对象
    }
    var fn = 'fn_' + Date.now() + Math.floor(Math.random() * 1000);
    context[fn] = this;  // 强行把this作为 Obj1 的一个内部属性（借刀杀人）

    var args = [];
    // 从 1 开始因为 context 也算是一个参数
    // arguments 一定是表示函数的参数的
    for (var i = 1, len = arguments.length; i < len; i++) {
        args.push('arguments[' + i + ']');
    }
    
    // call 是一个一个参数接收的，所以得拆开来传递
    // eval 可以将里面的字符串作为一个代码块来执行
    // 'context.fn(' + args +')' 这里的 + args ，args会做一个隐式转换，调用 toString() 方法
    // ['a', 'b'].toString() 的结果是 "a,b"（方括号消失了，取而代之的是逗号）。
    // args为：[ 'arguments[1]', 'arguments[2]', 'arguments[3]' ]
    // 隐式转换后会变成：context.fn(arguments[1], arguments[2])
    // 所以这里 eval 也就能够执行了
    // obj[a] 是找变量a(var a = ...)，obj["a"]是找属性名就叫 a 的值
    var res = eval('context["' + fn + '"](' + args +')');  // eval 执行里面的代码块返回结果

    delete context[fn];  // 删除 fn 这个临时属性
    return res;
}

// es6+
Function.prototype.myCall2 = function(context) {
    if (context === null || context === undefined) {
        context = window;
    } else {
        context = Object(context);
    }
    const fn = Symbol('fn');
    context[fn] = this;

    var args = [... arguments];
    args.shift();

    var res = context[fn](...args);

    delete context[fn];
    return res;
}


const a = {
    name: 'a',
    fn: function() {
        console.log(this.name);
    }
}
const b = {
    name: 'b',
}

a.fn.myCall2(b, 'c', 'a', 'b');