class Deque {
  constructor() {
    this.items = [];  // 存储队列元素的数组
    this.head = 0;  // 队首
    this.tail = 0;  // 队尾
  }

  // 队尾入队
  pushBack(item) {
    this.items[this.tail] = item;
    this.tail++;
  }

  // 队首入队
  pushFront(item) {
    this.head--;
    this.items[this.head] = item;
  }

  // 队尾出队
  popBack() {
    if (this.isEmpty()) {
      return undefined;
    }
    this.tail--;
    const item = this.items[this.tail];
    delete this.items[this.tail];
    return item;
  }

  popFront() {
    if (this.isEmpty()) {
      return undefined;
    }
    const item = this.items[this.head];
    delete this.items[this.head];
    this.head++;
    return item;
  }

  front() {
    return this.items[this.head];
  }
  back() {
    return this.items[this.tail-1];
  }
  size() {
    return this.tail - this.head;
  }
  isEmpty() {
    return this.size() === 0;
  }
}