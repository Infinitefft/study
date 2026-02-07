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

console.log(myInstanceof(dahuang, Animal));
console.log(myInstanceof(dahuang, Cat));