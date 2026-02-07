# 让 langchain 有记忆

> 在初步学习的 langchain 中，是没有记忆功能的

比如：
``` js
import {
  ChatDeepSeek
} from '@langchain/deepseek';
import 'dotenv/config';

const model = new ChatDeepSeek({
  model: 'deepseek-chat',
  temperature: 0.5
});

// http api 请求
const res = await model.invoke("我是熊二，我喜欢吃蜂蜜");
console.log(res);
const res2 = await model.invoke("我叫啥");
console.log(res2);   // 大模型不会回答我叫熊二
```

> 我们可以通过 `RunnableWithMessageHistory` 类来实现记忆功能。

``` JavaScript
import {
  ChatDeepSeek
} from '@langchain/deepseek';
import {
  ChatPromptTemplate
} from '@langchain/core/prompts';
// 带上历史记录的可运行对象
import {
  RunnableWithMessageHistory
} from '@langchain/core/runnables';
// 存放在内存中
import {
  InMemoryChatMessageHistory
} from '@langchain/core/chat_history';
import 'dotenv/config';

const model = new ChatDeepSeek({
  model: 'deepseek-chat',
  temperature: 0
});
// chat 模式， 数组
const prompt = ChatPromptTemplate.fromMessages([
  ['system', "你是一个有记忆的助手"],
  ['placeholder', "{history}"],
  ['human', "{input}"]   // 用户的输入
])

const runnable = prompt
  .pipe((input) => { // debug 节点
    console.log(">>> 最终传给模型的信息(Prompt 内存)");
    console.log(input)
    return input;   // 传入用户的输入，必须返回 input，否则会报错
  })
  .pipe(model);
// 对话历史实例
const messageHistory = new InMemoryChatMessageHistory();
const chain = new RunnableWithMessageHistory({   // 带上历史记录的可运行对象，使得模型有记忆功能
  runnable,
  getMessageHistory: async () => messageHistory,
  inputMessagesKey: 'input',
  historyMessagesKey: 'history',
});

const res1 = await chain.invoke(
  {
    input: '我叫熊二，我喜欢吃蜂蜜',
    
  },
  {
    configurable: {
      sessionId: 'makefriend'
    }
  }
)

console.log(res1.content);
const res2 = await chain.invoke(
  {
    input: '我叫什么名字',
    
  },
  {
    configurable: {
      sessionId: 'makefriend'
    }
  }
)

console.log(res2.content);
```


## ChatPromptTemplate：消息模板引擎
> `ChatPromptTemplate` 负责将原始输入（Raw Input） 转换为 消息序列（List of Messages）。

- `['system', "..."]`： 对应底层的 `SystemMessage` 类。它定义了模型的 **指令上下文 (Instructional Context)** 。

- `['placeholder', "{history}"]`： 这是 `MessagesPlaceholder` 的语法糖。它是一个动态填充位。它的特殊之处在于它接收的不是 string，而是 `BaseMessage[]`（消息对象数组）。作用：它允许在格式化 Prompt 时，将一组完整的历史对话历史（包括角色和内容）原封不动地插入到指定位置，保持数据的结构化。

- `['human', "{input}"]`： 对应 HumanMessagePromptTemplate。它是一个变量注入点，期待接收一个字符串，并将其封装为 HumanMessage 对象。

## Runnable
`Runnable` 就是把一堆零散的、有特定功能的“小零件”，拼成一个可以一键执行的“大机器”。小零件叫 Runnable。大机器也叫 Runnable。

`Runnable` 协议规定： 只要你是一个 `Runnable` ，你就必须具备以下几个标准动作：
  - $(1)$`.invoke()`：单次调用（你现在用的就是这个）。
  - $(2)$`.batch()`：批量调用。
  - $(3)$ `.stream()`：流式调用（像打字机一样一个字一个字出）。