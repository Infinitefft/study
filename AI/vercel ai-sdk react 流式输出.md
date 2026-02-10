# 流式输出

## 前置知识

### (1) @ai-sdk/react 是 Vercel 为了让前端开发者“秒出” AI 聊天界面而做的一套 React Hook 工具包。** 包里有 `useChat` 这个 **Hook** ，它可以让你在 React 组件中快速实现一个 AI 聊天界面。

- `useChat` ：聊天机器人。支持上下文、历史记录、流式返回。
- `useCompletion` ：文本补全。比如写代码建议、续写文章，不需要对话历史。
- `useObject`	：结构化数据。比如让 AI 生成一个 JSON 表单，前端直接渲染。

#### 在一个完整的 AI 聊天应用里，状态极其复杂。 `useChat` 内部自动帮你封装了：
  - 消息状态 (`messages`)：自动维护一个数组，包含用户的提问和 AI 的实时回答。
  - 输入流控 (`input`)：实时双向绑定输入框的值。
  - 流式处理 (`Streaming`)：这是最难写的。它会自动解析后端传回来的数据流，实时更新最后一条消息的内容。
  - 生命周期回调：当 AI 开始说话、说话结束、或者报错时，你可以执行特定逻辑。

---

### (2) SSE (Server-Sent Events)

#### `SSE` 是一种让服务器向浏览器单向推送实时数据的技术。

#### SSE 的工作原理 ：
- 浏览器发起请求： 客户端发送一个普通 HTTP 请求给服务器，但在 Header（请求头）里声明：`Accept: text/event-stream` 。
- 服务器保持连接： 服务器不立刻关闭连接，而是保持开启。
- 持续推送： 每当服务器有新数据（比如 AI 生成了一个新字），就立刻发给浏览器。
- 数据格式： 数据必须以 data: 开头，并以两个换行符 \n\n 结束。


---

## 下面用 mockjs 来实现一下流式输出

### hooks/useChatBot.ts:
``` TypeScript
// input handleChange handleSubmit
// messages 
// mockjs  /api/chat  流式输出
// chat 业务
import {
  useChat,
} from '@ai-sdk/react';

export const useChatBot = () => {
  return useChat({
    api: "/api/ai/chat",   // 要访问的后端接口
    // api: "http://localhost:3000/api/ai/chat",
    onError: (err) => {
      console.log("Chat Error:", err);
    }
  })
}
```

### pages/Chat.tsx:

``` TypeScript
import {
  useEffect,
} from 'react';
import Header from '@/components/Header'
import {
  useChatBot
} from '@/hooks/useChatBot'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'


export default function Chat() {
  const {
    messages,    // 后端返回的数据在前端状态中的实时映射
    input,       // 前端输入框的值
    handleInputChange,    // 前端输入框值变化时，更新状态
    handleSubmit,   // 前端提交表单时，调用后端接口
    isLoading,    // 后端是否正在返回数据
  } = useChatBot();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSubmit(e);
  }


  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 pb-2">
      <Header title="DeepSeek Chat" showBackBtn={true} />
      {/* html 原生滚动条不太好看，体验不好
        shadcn ScrollArea 样式和体验上优化
      */}
      <ScrollArea className="flex-1 border rounded-lg p-4 mb-4 bg-background">
        {
          messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Start a conversation with DeepSeek
            </div>
          ) : (
            <div className="space-y-4">
              {
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                        }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              }
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
              )}
            </div>
          )
        }
      </ScrollArea>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input value={input} onChange={handleInputChange}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 "
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
```


### mock/chat.js
``` TypeScript
// 流式输出本质是变算（llm token 生成）边给，而不是等全部结果生成再一次性返回
// AI场景中，模型生成文本是逐个token 产生的（模型每次基于已生成的token 序列）
// 通过自回归方式预测下一个最可能的方式预测下一个最可能的token
// streaming：true
// http chunked 数据块来传  不用res.end()
// res.write(chunk) 
// res.end text/plain;
// SSE 服务器发送事件（Server-Sent Events）
// text/event-stream 模式去发送token

import { config } from 'dotenv';
config();


export default [
  {
    url: "/api/ai/chat",
    method: "post",
    // rawResponse 用于自定义原始的 HTTP 响应（如流式输出）
    // 而 response 通常指封装后的结构化响应
    rawResponse: async (req, res) => {
      // node 原生地去拿到请求体
      // console.log("/////[][][]/////");
      // chunk 数据块（buffer）
      // tcp/ip tcp：可靠的传输协议
      // 按顺序组装，失败重传  html
      // on data
      let body = '';
      // chunk 二进制流 buffer
      // 最后把 buffer 转成字符串
      req.on('data', (chunk) => { body += chunk })
      // 数据接收完成
      req.on('end', async () => {
        // 都到位了
        console.log(body);
        try {
          const { messages } = JSON.parse(body);
          // console.log(messages);
          res.setHeader('Content-Type', 'text/plain;charset=utf-8');
          // 响应头先告诉浏览器 这是流式的 数据会分块传输
          res.setHeader('Transfer-Encoding', 'chunked');
          // vercel ai sdk 特制头
          res.setHeader('x-vercel-ai-data-stream', 'v1');
          const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.VITE_DEEPSEEK_API_KEY}`
            },
            body:JSON.stringify({
              model: "deepseek-chat",
              messages: messages,
              stream: true  // 流式输出
            })
          })
          // console.log(process.env.VITE_DEEPSEEK_API_KEY, "[][][]{}{}{}{[][][]")
          if (!response.body) throw new Error("No response body");
          // SSE：二进制流  有个reader 对象 接根管子一样
          // LLM 输出和解析之间连上以根管子
          // 用reader 对象不断从llm 输出中读取token
          const reader = response.body.getReader();  // token
          // 用于将ArrayBuffer 或 TypedArray（如 Uint8Array） 转换为字符串
          const decoder = new TextDecoder();
          // Uint8Array 字节数据  解码为可读的 UTF-8 字符串
          while(true) {
            // llm 的这一次的生成 被读到了
            // 事件，有新的token生成了
            const { done, value } = await reader.read(0);
            // console.log(done, value, '--------------');
            if (done) break;
            // 解析出 token字符串  LLM 内部 数学向量
            const chunk = decoder.decode(value);
            // console.log(chunk, "------")  // JSON 字符串  结构
            // chunk 有data: 这个前缀  
            // delta：增量  又一次token 生成
            const lines = chunk.split('\n');  // 拿到每一行有效数据
            for (let line of lines) {  // 不需要下标，好理解，计数循环比较机械
              if (line.startsWith('data:') && line !== 'data: [DONE]') {
                // data: [DONE] llm 生成的结束标志
                // startWith: es6 的语法  优雅简单
                // 还可以用老的 indexOf 方法：查找某个元素在数组或字符串中第一次出现的位置（索引）
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices[0]?.delta?.content || '';
                  // ?.  增强代码的健壮性 
                  // 安全地访问对象内部的属性，防止因为中间某个属性不存在（null 或 undefined）。
                  if (content) {
                    // 发送给前端  SSE 核心
                    // 向输出流不断地写入content
                    // ai-sdk 要求的格式
                    res.write(`0:${JSON.stringify(content)}\n`);
                  }
                } catch (err) {
                  
                }
              }
            }
          }
          // 结束响应
          res.end();
        } catch (err) {

        }
      })
    }
  }
]
```

#### req.on(event, callback)
- req: 它是 http.IncomingMessage 的实例。
- .on: 这是 EventEmitter 类的方法，意思是“当……发生时，执行……”。
- event: 你要监听的事件名称。
- callback: 事件触发时执行的函数。

`req.on('data', ...)` —— HTTP 请求体可能很大（比如你发了一段超长的聊天记录）。Node.js 不会等全部数据到齐才处理，而是每到一小块（Chunk），就触发一次 `data` 事件。

`req.on('end', ...)` —— 当所有的数据块都传输完毕时，触发 `end` 事件。