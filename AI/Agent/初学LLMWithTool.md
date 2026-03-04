# 初学 LLM With Tools

## LLM With Tools
langchain 提供了 Tool

### Tool 的核心构成
一个标准的 LangChain Tool 通常包含三个关键要素：

- `Name（名称）`：告诉 LLM 这个工具叫什么（如 web_search）。

- `Description（描述）`：这是最重要的部分。LLM 通过阅读描述来判断什么时候该用这个工具（例如：“当用户询问实时天气时调用此工具”）。

- `Schema（入参规范）`：利用 Zod 或 Pydantic 定义工具接收的参数格式，确保 LLM 传参不会出错。

## 基本流程
用户通过 `Prompt（HumanMessage）` 发起请求，大模型进行**语义分析**后，如果发现**无法直接回答**，就会返回一个包含 `tool_calls` 对象的 `AIMessage` ，这代表大模型发出了“工具调用申请”。

作为开发者，我们需要根据 `tool_calls` 里的信息去本地匹配对应的工具函数。我们会把这些工具调用放进一个 `Promise 数组` 中**并发执行 (Promise.all 并发执行**)，这是因为读写文件或请求接口等操作是异步且耗时的，这样做能提高效率。

执行完本地工具后，我们会利用 `try...catch` 捕获可能的异常，并将拿到的结果包装成 `ToolMessage` ，带上**唯一**的 `tool_call_id` 重新 `push` 回对话上下文（ `messages` ）中。这样大模型就能看到它想要的“证据”。

最后，大模型带着这些新拿到的结果重新组织语言，再次生成的 `AIMessage` 就不再包含 `tool_calls` ，而是最终要返回给用户的人类语言回复。


## 一个简单的 LLM With Tool (读取文件)

``` js
import 'dotenv/config';
// console.log(process.env.OPENAI_API_KEY);

import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,  // 告知工具使用
} from '@langchain/core/messages';

// node 内置文件模块 异步ID
import fs from 'node:fs/promises';
// 数据校验 zod tool parameter 校验
import { z } from 'zod';

const model = new ChatOpenAI({
  modelName: 'qwen-coder-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL,
  },
  temperature: 0,
})

// 原生写法 麻烦
// 新建一个 tool
const readFileTool = tool(
  // tool 处理函数的函数体
  // 分析 xxx 代码文件有没有bug
  // 先 tool 读取文件内容，path 作为参数 等待它读取完成
  // 再分析 bug
  async ({path}) => {
    const content = await fs.readFile(path, 'utf-8');
    console.log(`[工具调用] read_file("${path}") 成功读取 ${content.length} 个字符`);
    return content;
  },
  {
    name: "read_file",
    description: `用此工具来读取文件内容，当用户需要读取文件、查看代码时、分析文件内容时，
    调用此工具，输入文件路径（可以是相对路径或者绝对路径）`,
    schema: z.object({path: z.string().describe("要读取的文件路径")})
  }
);

const tools = [
  readFileTool,
]

// langchain 提供了一个方法，绑定工具
// model 不再孤单，有了工具的陪伴
// llm 就可以干活了
const modelWithTools = model.bindTools(tools);

const messages = [
  new SystemMessage(`
    你是一个代码助手，可以使用工具读取文件并解释代码。

    工作流程：
    1. 用户要求读取文件时，立即调用 read_file 工具
    2. 等待工具返回文件内容
    3. 基于文件内容进行分析和解释

    可用工具：
    - read_file: 读取文件内容（使用此工具来获取文件内容）
  `),
  new HumanMessage("请读取tool-file-read.mjs文件内容并解释代码"),
];


// llm 返回的决策，要调用工具
// tool_calls 的 api 部分
// name 执行函数 result
// message llm
// 最后的结果

let response = await modelWithTools.invoke(messages);
messages.push(response);  // 把 llm 要调用工具的message也加入messages数组，形成多轮对话

while (response.tool_calls && response.tool_calls.length > 0) {  // LLM 需要调用工具
  console.log(`\n [检测到] ${response.tool_calls.length} 个工具`);
  const toolResults = await Promise.all(  // 并发执行所有工具调用，并返回一个 Promise 数组
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find(t => t.name === toolCall.name);  // 本地找到对应的工具
      if (!tool) {
        return `错误：找不到工具 ${toolCall.name}`;
      }
      console.log(`[执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

      try {
        const result = await tool.invoke(toolCall.args);  // 调用工具函数，并等待其完成
        return result;  // 返回工具的结果
      } catch (err) {
        return `错误：${err.message}`;
      }
    })
  )
  // 遍历每个工具调用，将结果包装成 ToolMessage 并加入 messages
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],  // 工具调用的结果
        tool_call_id: toolCall.id,  // 工具调用的唯一标识符
      })
    )
  })

  console.log(messages);

  response = await modelWithTools.invoke(messages);  // 让 LLM 基于新加入的工具调用结果，生成下一个回复
  // 不再有 tool_calls 了，说明对话结束了
  console.log(response);
}


console.log(response);
```