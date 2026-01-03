# $instanceof$ 运算符用于检测 构造函数的 $prototype$ 属性 是否出现在 某个实例对象的原型链 上。

## 例如：
``` JavaScript
const arr = [1, 2, 3];
const date = new Date();
const reg = /abc/;

console.log(arr instanceof Array);  // true
console.log(date instanceof Date);   // true
console.log(reg instanceof RegExp); // true
console.log(arr instanceof Object); // true (原型链顶端都是 Object)



class Shape {}
class Rectangle extends Shape {}
class Square extends Rectangle {}

const mySquare = new Square();

console.log(mySquare instanceof Square);    // true
console.log(mySquare instanceof Rectangle); // true (爷爷辈)
console.log(mySquare instanceof Shape);     // true (祖先辈)
```


##  构造 $Animal, Dog, Cat$, 实例化 $dahung, tom$
``` JavaScript
function Animal() {}
Animal.prototype.Say = function() {
  console.log("I am an animal");
};

function Dog() {}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

function Cat() {}
Cat.prototype = Object.create(Animal.prototype);
Cat.prototype.constructor = Cat;

const dahuang = new Dog();
const tom = new Cat();
```

---

## $手写 Instanceof$

### $1.迭代$
``` JavaScript
const myInstanceof = (instance, target) => {
  if (typeof instance !== 'object' || instance === null) {
    return false;
  }
  
  let proto = instance.__proto__;
  const targetPrototype = target.prototype;
  
  while (true) {
    if (!proto) {
      return false;
    }
    if (proto === targetPrototype) {
      return true;
    }
    proto = proto.__proto__;
  }
}


const myInstanceof = (instance, target) => {
  const isObject = typeof instance === 'object' && instance !== null;
  const isFunction = typeof instance === 'function';
  
  if (!isObject && !isFunction) return false;

  let proto = Object.getPrototypeOf(instance);
  const targetPrototype = target.prototype;

  while (proto !== null) {
    if (proto === targetPrototype) return true;
    proto = Object.getPrototypeOf(proto);
  }

  return false;
}


console.log(myInstanceof(dahuang, Animal));  // true
console.log(myInstanceof(dahuang, Cat));  // false
```

---

### $2.递归$
``` JavaScript
const myInstanceof = (instance, target) => {
  if (typeof instance !== 'object' || instance === null) return false;

  const proto = Object.getPrototypeOf(instance);
  const targetPrototype = target.prototype;

  if (proto === null) return false;
  if (proto === targetPrototype) return true;

  return myInstanceof(proto, target);
}
```

---

### $3.标准 API 写法 (isPrototypeOf)$
``` JavaScript
const myInstanceof = (instance, target) => {
  if (typeof instance !== 'object' || instance === null) return false;
  
  return target.prototype.isPrototypeOf(instance);
}
```


### $原生 instanceof 的几个“冷知识”$

**原始类型**始终为 $false$ 原生 $API$ 内部有一层保护机制，如果左侧不是**对象**，直接返回 $false$ 。

``` JavaScript
console.log(1 instanceof Number);      // false
console.log('gustt' instanceof String); // false
``` 