// const flatten = (arr) => {
//   let res = [];
//   for (const item of arr) {
//     if (Array.isArray(item)) {
//       // 递归终点：数组中没有嵌套的数组，那么函数返回一个数组，使用 ... 来 push 拼接。
//       res.push(...flatten(item));
//       // 或者 res = res.concat(flatten(item));
//     } else {
//       res.push(item);
//     }
//   }
//   return res;
// }
const flatten = (arr) => arr.reduce((pre, cur) => pre.concat(Array.isArray(cur) ? flatten(cur) : cur), [])

const arr = [1, [2, [3, [4]]]]
console.log(flatten(arr));