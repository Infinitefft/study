# MCP

- llm with tools

  read write listDir exec tool
  llm + tools = Agent
  甜头 llm 真的能干活了

- mini-corsur
  mcp with tools 不太满意
  怎么把 llm 能干活的甜头扩大呢？ 更多的tools，更好的tools，第三方的tool
  向外提供tool 大厂将自己的服务以mcp 的方式向外提供
  - 80% 的 App 会消失
  - 集成第三方mcp 服务，mcp 就是tool
  - node 调用 Java/Python/Rust 等其他语言的 tool
  - 远程的tool

## MCP
就是tool
Model Content Protocol Anthorpic
在大量的本地，跨语言、第三方的tool 集成到Agent 里来的时候，让llm 强大的同时，也会带来一定的复杂性（对接联调）
大家都按一个约定来

## 按 MCP 协议来开发，将我们的服务器或资源 输出出去

## MCP 协议 还有通信部分
  - stdio 本地命令行
  - http 远程调用

## MCP 最大的特点就是可以跨进程调用工具
  - 子进程 node:child-process
  - 跨进程 java/rust
  - 远程进程
  llm 干更强大的任务
  繁杂（本地、跨语言、跨部门、远程）不同的通信方式（stdio，http）
  规范的提供工具和资源，mcp 协议

## 编写满足mcp协议规范的Tool

- Model Context Protocol
  tool result, ToolMessage Context 上下文
- Anthorpic 24年底  25年底贡献给开源社区
- sdk @modelcontextprotocl/sdk

- 为什么mcp 配置？
  - cursor/trae 变成Agent 支持MCP client
  - 读取 mcp.json 需要的mcp tool
- 手写 MCP tool


## 编写本地 Tools
分成两个模块，一个是本地Tools的实现，一个是调用


### 第一部分：编写 Server 端

在 `MCP (Model Context Protocol)` 架构中， `Server` 是能力的生产者。它不是一个被动被调用的简单 API，而是一个封装了工具、资源和协议规则的独立实体。

- 架构定位 (B/S vs. C/S)：首先要明确，虽然我们开发的是 Web 程序，但 `MCP` 协议本身是标准的 `C/S` 架构。这里的 `Server` 就像是一个专业的“服务员”，它不负责做决策，只负责在被叫到时提供特定的服务。它在宿主环境（Client）的调度下运行。

- 创建 `Server` 实例 (McpServer)：通过 `new McpServer` 初始化。这个实例是你所有工具的母体。你代码中填写的 version（如 1.0.0）是符合语义化版本规范的，它告诉 `Client` ：“我是基于此版本协议实现的实体”，方便 `Client` 在连接时进行版本兼容性检查。

- 注册工具 (`registerTool`)：这是定义 AI “动词”的核心过程。

- 语义化描述 (`description`)：这是给 LLM 读的指令。LLM 会扫描所有 Tool 的描述，匹配用户的自然语言意图（例如用户说“查查 002”，LLM 发现 query-user 的描述完全匹配，从而决定发起调用）。

- 参数约束 (`inputSchema`)：利用 zod 强行规定参数格式。这起到了安全网的作用，防止 LLM 在生成调用指令时产生“幻觉”从而传错参数名或类型，确保进入业务逻辑的数据是干净、合法的字符串。

- 逻辑实现 (`async callback`)：这是真正的业务逻辑执行区。你从 database 查找数据，并必须按照 MCP 规定的标准格式返回 content 数组，这样 Client 才能正确解析结果。

- 注册资源 (`registerResource`)：这是 MCP 区别于普通 Tool 协议的核心。为什么叫 Context（上下文）而非单纯的 Tool？ 因为模型有时需要先阅读背景资料（如你的“使用指南”）才能更好地理解任务。Resource 是只读的，它是通过 URI（如 docs://guide）暴露给 LLM 的“外部知识库”，让 AI 具备预读能力。

- 通信层铺设 (`Transport`)：由于 Server 运行在不同于 Client 的独立进程中，必须通过 StdioServerTransport。它利用了 Node.js 的 process.stdin 和 process.stdout。这相当于在两个独立的程序之间挖了一条隧道，所有的指令都通过 JSON-RPC 格式在这条隧道里往返传输。最后调用 server.connect(transport) 完成握手，Server 正式上线。

`my-mcp-server.mjs:`
``` js
// Browser/Server 架构 Web 程序
// C/S 架构 Client/Server 通信
// MCP 的client不同于传统app的 C/S 架构中的 C
// MCP 中的 client：负责连接 LLM 和多个 Server，管理生命周期。
// mcp 协议 通信协议
// mcp client cursor
// mcp server my-mcp-server.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
// 标准输入输出 通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod';

// tool 数据服务

const database = {
  users: {
    "001": { id: "001", name: "张三", email: "zhangsan@example.com", role: "admin" },
    "002": { id: "002", name: "李四", email: "lisi@example.com", role: "user" },
    "003": { id: "003", name: "王五", email: "wangwu@example.com", role: "user" },
  }
}


const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
});

server.registerTool('query-user', {
  description: '查询数据库中的用户信息，输入用户ID，返回该用户的详细信息（姓名、邮箱、角色）。',
  inputSchema: {
    userId: z.string().describe("用户ID，例如：001, 002, 003")
  }
}, async ({ userId }) => {
  const user = database.users[userId];
  if (!user) {
    return {
      content: {
        type: 'text',
        text: `用户ID ${userId} 不存在。可用的ID: 001, 002, 003`
      }
    }
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`
        }
      ]
    }
  }
})


// 注册资源，使用指南 提供资源给llm
// Model Tool Protocol PromptTemplate Protocol
// Model Context Protocol  上下文协议
// Context = Tool + Resource + PromptTemplate
// Resource：为了解决信息不对等的问题
// Description：是“标签”，告诉 AI 这是什么。
// Tool：是“扳手”，让 AI 去干活。
// Resource：是“图纸”或“资料库”，让 AI 了解当前的环境。

server.registerResource('使用指南', 'docs://guide', {
  description: 'MCP Server 使用文档',
  mimeType: 'text/plain',
}, async () => {
  return {
    contents: [
      {
        // URI 寻址像网页一样被引用：LLM 可以像我们在浏览器输入网址一样，通过 URI 找到特定的数据块。
        // 多种格式支持：资源可以声明 mimeType（如 text/plain, application/json）。这意味着你可以传文本给 AI 读，也可以传复杂的 JSON 数据让它解析。
        uri: 'docs://guide',
        mimeType: 'text/plain',
        text: `MCP Server 使用指南
          功能：提供用户查询等工具。
          使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具。
        `,
      }
    ]
  }
})



// 连接方式 本地跨进程调用
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 第二部分：编写 Client 端

`Client` 是整个系统的宿主 (`Host`) 和指挥官。它负责把 `LLM` 的“智力”和 `Server` 的“体力”缝合在一起（例如 `Cursor`, `Claude Desktop` 就是宿主）。

- 配置与实例连接 (`MultiServerMCPClient`)：Client 首先要声明它要连接哪些 Server。在 mcpServers 配置里，你通过 command: 'node' 启动了刚才写的 Server 文件。此时，Client 实际上启动了一个子进程，并握住了该进程的输入输出流（Stdio）。

- 能力聚合 (`getTools`)：连接成功后，Client 调用 mcpClient.getTools()。这一步非常关键，它通过协议将 Server 里的所有函数定义“拉取”到 Client 的本地内存中。

- 模型绑定 (`bindTools`)：你声明了 ChatOpenAI 实例。通过 model.bindTools(tools)，你把从 Server 拿到的能力注入到了模型的“思考边界”内。现在，模型意识到它除了聊天，还可以调用一个叫 query-user 的具体函数。

- 构建 Agent 执行循环 (`The Loop`)：这是实现“智能”的关键逻辑。

- 初始提问：将用户的自然语言需求（`HumanMessage`）存入 messages 数组作为上下文。

- 轮询决策 (`Iteration`)：开启一个带有最大次数限制（如 30 次）的 for 循环。每一轮，LLM 都会拿到包含之前所有对话和结果的 messages 全量上下文进行思考。**轮询的作用**：**1.** 实现“多步推理”与“任务拆解”  **2.** 构建“短期记忆”与“观察反馈” (Observation) **3.** 错误处理与自我修复

- 检测工具调用 (`tool_calls`)：如果 LLM 回复中包含 tool_calls，说明它决定“动手执行”了。此时它会生成调用指令，但暂时不给出最终文本回复。

- 本地执行与回传：`Client` 根据 `tool_call.name` 找到对应的工具函数并运行，获取 `toolResult`。

- 上下文追加：将 AI 的思考过程（包含调用意图）和你的执行结果（ToolMessage）按顺序 push 到数组中。这就是你说的“不断检查进度、增加上下文、优化回答”的过程。

- 终止条件：当某一次 LLM 的回复中不再包含 tool_calls 时，说明它已经拿到了所有必要信息，给出了最终的总结答复，此时 return 结果并关闭 Client 进程。


`langchain-host.mjs:`
``` js
import 'dotenv/config';
// adapters  mcp 适配器
import {
  MultiServerMCPClient
} from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  ToolMessage
} from '@langchain/core/messages';
import chalk from 'chalk';
// host


// client
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    'my-mcp-server': {
      command: 'node',
      args: ['./my-mcp-server.mjs'],
    },
  },
});


const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL,
  }
});

const tools = await mcpClient.getTools();
console.log(tools, '////');
const modelWithTools = model.bindTools(tools);



async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new HumanMessage(query)
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen('⏳正在等待AI思考...'));
    const response = await modelWithTools.invoke(messages);
    console.log(response, '////');
    messages.push(response); // assistant content 为空   tool_calls

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n AI 最终回复：\n ${response.content}\n`);
      return response.content;
    }

    console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
    console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find(t => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        messages.push(new ToolMessage({
          content: toolResult,
          tool_call_id: toolCall.id
        }));
      }
    }
  }
  return messages[messages.length - 1].content;
}

const result = await runAgentWithTools("查一下用户 002 的信息");
console.log(result, '////');
await mcpClient.close();
```