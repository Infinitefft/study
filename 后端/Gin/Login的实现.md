# 用户登录功能的实现


## internal/router/router.go
> 先定义全局的 API 路由
``` Go
package router

import (
	"backend/internal/handler"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

type RouterHandlers struct {
	User *handler.UserHandler
	// Problem *ProblemHandler // 以后的 handler 都直接往这加
}

// NewRouter 初始化路由引擎，用于main.go调用使得所有路由生效
func NewRouter(handlers *RouterHandlers) *gin.Engine {
	//r := gin.Default() 等同于
	// r := gin.New()      // 创建一个完全空白的引擎
	// r.Use(gin.Logger())   // 加上日志中间件：控制台会打印每个请求的路径、状态码、耗时
	// r.Use(gin.Recovery()) // 加上异常恢复中间件：即使代码写 Bug 崩了，服务器也不会挂掉，而是返回 500
	r := gin.Default()

	// r.Use() 是 Gin 框架挂载中间件的标准动作。
	//它的意思是：“从现在起，每一个进来的请求，都要先经过我括号里写的这个函数处理。”
	r.Use(middleware.Cors())
	// 在 router.go 里，r.Use(middleware.Cors()) 必须写在路由定义（r.Group）的前面

	apiGroup := r.Group("/api")
	{
		// router/login.go 里自定义的 InitUserRouter 为用户路由导向
		InitUserRouter(apiGroup, handlers.User)
	}

	// 返回初始化好的路由引擎
	return r
}
```


### internal/router/user.go
``` Go
package router

import (
	"backend/internal/handler"
	"github.com/gin-gonic/gin"
)

// InitUserRouter 专门负责用户模块的路由注册
// UserHandler 来自 handler/login.go 负责处理用户模块的请求
func InitUserRouter(rg *gin.RouterGroup, h *handler.UserHandler) {
	// 创建一个子组 /api/user
	userGroup := rg.Group("/user")
	{
		userGroup.POST("/login", h.Login) // 用户登录路由
		//userGroup.POST("/register", h.DoRegister)  // 用户其他的handler的路由
		//userGroup.GET("/profile", h.GetProfile)
	}
}
```

### internal/service/user/service.go
### 定义用户服务接口，以便handler调用
``` Go
package user

import (
	"backend/internal/ent"
	"context"
)

// Service 定义接口
type Service interface {
	// Authenticate 逻辑在 login.go 里实现
	Authenticate(ctx context.Context, username, password string) (*ent.User, error)
}

// userService 结构体实现接口
type userService struct {
	client *ent.Client // 持有数据库连接
}

// New 构造函数：由 main.go 传入 client
// 依赖注入，userService需要操作数据库，所以需要传入数据库连接
func New(client *ent.Client) Service {
	return &userService{
		client: client,  // 把外部传进来的“依赖”存起来
	}
}
```

### internal/service/user/login.go
``` Go
package user

import (
	"context"
	"errors"

	"backend/internal/ent"
	"backend/internal/ent/user" // 确保路径正确
	"golang.org/x/crypto/bcrypt"
)

// Authenticate 验证用户登录
func (s *userService) Authenticate(ctx context.Context, username, password string) (*ent.User, error) {
	// 1. 去数据库里找这个 username
	u, err := s.client.User.
		Query().
		Where(user.UsernameEQ(username)).  // Ent 的查询语句UsernameEQ(username)， EQ：equal 等于
		Only(ctx)

	if err != nil {
		// 如果没找到用户，或者数据库报错
		if ent.IsNotFound(err) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}

	// 2. 校验密码：bcrypt.CompareHashAndPassword(数据库里的哈希, 用户输入的明文)
	// 如果 err == nil 则说明密码正确
	err = bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	if err != nil {
		return nil, errors.New("密码错误")
	}

	// 3. 验证成功，返回用户对象
	return u, nil
}

```

### intenal/handler/user.go
``` Go
package handler

import (
	"backend/internal/service/user" // 导入你刚刚建好的 user 包
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService user.Service // 这里使用的是接口类型
}

// NewUserHandler 构造函数  用于 main.go 中新建一个 UserHandler 实例
func NewUserHandler(s user.Service) *UserHandler {
	return &UserHandler{
		userService: s,  // 将 s 赋值给 userService，userService才是干活的那个
	}
}

func (h *UserHandler) Login(c *gin.Context) {
	// 1. 定义一个临时结构体来接收 JSON
	// 注意：这里的 tag `json:"username"` 必须和前端发送的 key 完全一致
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "参数格式错误"})
		return
	}

	if u, err := h.userService.Authenticate(c.Request.Context(), req.Username, req.Password); err != nil {
		c.JSON(401, gin.H{
			"error": "用户名或密码错误",
		})
		return
	} else {
		c.JSON(200, gin.H{
			"message": "登录成功",
			"user": gin.H{
				"id":       u.ID,
				"username": u.Username,
				"avatar":   u.Avatar,
			},
		})
	}
}

```