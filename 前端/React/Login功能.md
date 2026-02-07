# zustand 管理 Login


### Login.tsx:
``` JSX
import React from "react";
import { Credential } from "@/types";
import { useState } from "react";

import { useUserStore } from '@/store/useUserStore';
import { useNavigate } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from "lucide-react";



export default function Login() {
  const [loading, setLoading] = useState(false);  // 登录loading状态
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Credential>({  // 登录表单数据 Credential约束
    name:"",
    password:"",
  })

  const { login } = useUserStore();  // 全局状态管理 登录方法

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value
    }));
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const password = formData.password.trim();
    if (!name || !password) {  // 用户名密码为空 直接返回
      return;
    }
    // 否则 ，
    setLoading(true);
    try {
      await login({name, password})   // 登录
      navigate("/", { replace: true })   // 登录从 history 中移除，并回到首页
    } catch(err) {
      console.error("登录失败", err);
    } finally {
      setLoading(false);   // 登录loading状态 设为 false，不在登录中
    }
  }

  <div className="min-h-screen flex flex-col items-center justify-center
      p-6 bg-white
    ">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">登录</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            {/* 无障碍访问 for + id  for是关键字，react htmlFor */}
            <Label htmlFor="name">用户名</Label>
            <Input id="name" value={formData.name} placeholder="请输入用户名" 
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input type="password" id="password" value={formData.password} placeholder="请输入密码" 
              onChange={handleChange}
            />
          </div>
          <Button>
            {loading? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>登录中...</>) : "立即登录"}
          </Button>
        </form>
        <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
          暂不登录，回首页
        </Button>
      </div>
    </div>
}
```

## zustand

### useUserStore.tsx:
``` JSX
import { create } from 'zustand';
import { User } from '../types';
import { doLogin } from '../api/user';
import { persist } from 'zustand/middleware';
import Credential from '../types/credential';

interface UserStore {
  token: string;
  user: User | null;
  isLogin: boolean;
}

export const useUserStore = create<UserStore>() (
  // persist：zustand 帮忙保存到 localStorage
  // persist 里定义的是整个 store（state + actions）
  persist((set) => ({  // state 对象
    // state  全局的状态
    token: "",  // token：后端用来确认“你是不是合法用户”的唯一依据。
    // 前端每次请求都要带 token，后端根据 token 确认“你是不是合法用户”。
    user: null,
    isLogin: false,

    // actions 全局的行为
    login: async ({name, password}: Credential) => {
      const res = await doLogin({name, password});
      // console.log(res, '??????');
      // const { token, user } = res.user;
      set({
        user: res.user,
        token: res.token,
        isLogin: true,
      })
    }
  }), {
    name: 'user-store',  // 本地存储的名字，localStorage.getItem("user-store");
    // partialize: 控制“怎么存 localStorage”。
    // state 即是 persist 中的 state
    partialize: (state) => ({
      token: state.token,
      user: state.user,
      isLogin: state.isLogin,
    })
  })
)
```