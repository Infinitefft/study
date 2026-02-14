# 双 token 机制

项目开发中，为了**提高系统的安全性**，通常会采用**双 token 机制**。一个 `refresh token` 用于刷新 token ，另一个 `access token `用于接口请求。`refresh token` 时间一般较长(7 天)， `access token` 时间较短(15 分钟)。

`token` 生成使用 `jwt` 库。

下面为使用 `NestJS` 实现双 token 机制的代码:

`auth.service.ts`:
``` ts
import { 
  Injectable,
  UnauthorizedException,  // UnauthorizedException 是 NestJS 内置的一个异常类
} from '@nestjs/common';

import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import {
  PrismaService,
} from '../prisma/prisma.service';



@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}


  async login(loginDto: LoginDto) {
    const { phone, password } = loginDto;
    // 根据手机号查询数据库中的用户
    const user = await this.prisma.user.findUnique({
      where: {
        phone,
      },
    });
    // hashed password 比对
    if(!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    // 颁发token
    const tokens = await this.generateTokens(user.id.toString(), user.phone);
    // generateTokens 返回 access_token 和 refresh_token
    return {
      ...tokens,  // 使用 ... 把 generateTokens 返回的 { access_token, refresh_token } 和新的 user 对象组合成一个最终返回对象。
      user:{
        id: user.id.toString(),
        nickname: user.nickname,
        phone: user.phone
      }
    }
  }


  // 刷新 token
  async refreshToken(rt: string) {
    try {
      // verifyAsync：验证 JWT 的方法。
      // 如果 token 过期或篡改，verifyAsync 会抛异常，你在 catch 里捕获，返回 401 错误。
      const payload = await this.jwtService.verifyAsync(rt, {
        secret:process.env.TOKEN_SECRET
      });
      // console.log(payload, "--------()()()")
      // 没有过期，那么生成新的 token
      return this.generateTokens(payload.sub, payload.name);
    } catch(err) {
      throw new UnauthorizedException("Refresh Token 已失效，请重新登录");
    }
  }


  // 生成 token
  private async generateTokens(userId: string, phone: string) {
    const payload = {
      sub: userId,   // sub：用来唯一标识 token 所代表的主体，刚好可以用 userID
      name: phone    // name：自定义字段，可以随便放你想让 token 携带的信息 
    };

    const [at, rt] = await Promise.all([
      // 颁发了两个token  access_token
      this.jwtService.signAsync(payload, {
        expiresIn: '15m', // 有效期 15分钟 更安全 被中间人攻击
        // TOKNE_SECRET：JWT 的签名密钥
        secret: process.env.TOKEN_SECRET
      }),
      // refresh_token  刷新
      // 7d 服务器接受我们，用于refresh 
      // 服务器再次生成两个token 给我们
      // 依然使用 15m token 请求 
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: process.env.TOKEN_SECRET
      }),
    ])
    return {
      access_token: at,
      refresh_token: rt
    }
  }
}
```