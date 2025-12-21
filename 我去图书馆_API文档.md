# 我去图书馆 (Wo Qu Tu Shu Guan) 模拟请求 API 文档

本文档总结了“我去图书馆”微信公众号应用的所有详细真实的 API 接口。所有接口均通过对现有仓库代码的逆向分析得出。

## 1. 基本信息

*   **基础域名**: `wechat.v2.traceint.com`
*   **协议**: HTTPS (推荐) 或 HTTP
*   **Content-Type**: `application/json`
*   **User-Agent**: 必须模拟微信环境 (例如: `Mozilla/5.0 ... MicroMessenger/...`)
*   **核心 Header**:
    *   `Host`: `wechat.v2.traceint.com`
    *   `Origin`: `https://web.traceint.com`
    *   `Referer`: `https://web.traceint.com/`
    *   `App-Version`: `2.0.11` 或 `2.1.2.p1`

---

## 2. 认证与鉴权 (Authentication)

在使用任何 GraphQL 接口前，需要通过微信授权获取 Cookie。

### 2.1 获取授权 Cookie
*   **接口地址**: `GET /index.php/urlNew/auth.html`
*   **请求参数**:
    *   `r`: 重定向地址 (通常为 `https://web.traceint.com/web/index.html`)
    *   `code`: 微信授权 Code (由微信跳转链接提供，长度通常为 32 位)
    *   `state`: 状态值 (通常为 `1`)
*   **响应**:
    *   通过 `Set-Cookie` 返回关键凭证：`Authorization`, `SERVERID`, `wechatSESS_ID` 等。
    *   **注意**: `Authorization` 是后续请求最核心的身份标识。

---

## 3. GraphQL 核心接口

所有功能性请求均发送至统一的 GraphQL 入口。

*   **接口地址**: `POST /index.php/graphql/`
*   **请求体格式**: `{"operationName": "...", "query": "...", "variables": {...}}`

### 3.1 获取首页及当前预约信息 (`index`)
用于获取用户信息、当前预约状态、常用座位等。

*   **Operation Name**: `index`
*   **Variables**: `{"pos": "App-首页"}`
*   **核心查询内容**:
    *   `userAuth.reserve.reserve`: 当前预约详情（包括 `token`, `status`, `seat_name`, `exp_date` 等）。
    *   `userAuth.oftenseat.list`: 常用座位列表。
    *   `userAuth.currentUser`: 当前用户信息（学号、姓名、学校等）。

### 3.2 获取场馆列表及余座 (`list`)
获取所有可选的图书馆场馆及其当前开放状态和实时余座。

*   **Operation Name**: `list`
*   **Variables**: `{}`
*   **核心查询内容**:
    *   `userAuth.reserve.libs`: 场馆列表。
    *   `lib_rt`: 包含 `seats_total` (总座), `seats_used` (已用), `seats_has` (剩余), `open_time` (开放时间)。

### 3.3 获取场馆布局与座位状态 (`libLayout`)
获取指定场馆的座位分布图及每个座位的实时状态。

*   **Operation Name**: `libLayout`
*   **Variables**: `{"libId": <场馆ID>}`
*   **核心查询内容**:
    *   `lib_layout.seats`: 座位数组，包含 `x`, `y` 坐标, `key` (用于预约), `name` (座位号), `status` (是否有人)。

### 3.4 预约座位 (`reserueSeat`)
执行预约操作。**注意**: 部分版本中接口名为 `reserueSeat` (存在拼写错误)，部分为 `reserveSeat`。

*   **Operation Name**: `reserueSeat`
*   **Variables**:
    ```json
    {
      "seatKey": "x,y",
      "libId": 123,
      "captchaCode": "",
      "captcha": ""
    }
    ```
*   **响应内容**: `userAuth.reserve.reserueSeat` 返回字符串 `"true"` 表示成功。

### 3.5 取消预约 (`reserveCancle`)
取消当前的预约。

*   **Operation Name**: `reserveCancle`
*   **Variables**: `{"sToken": "<来自首页查询的token>"}`
*   **核心查询内容**: `userAuth.reserve.reserveCancle` 返回取消结果。

### 3.6 获取学校配置 (`getUserCancleConfig`)
查询学校关于暂离、取消等规则的配置。

*   **Operation Name**: `getUserCancleConfig`
*   **Variables**: `{}`
*   **核心查询内容**: `userAuth.user.holdValidate` (获取 `hold_validate` 字段)。

---

## 4. 验证码与预预约 (针对部分场馆)

在抢座高峰或特定场馆，可能需要处理验证码。

### 4.1 获取验证码步骤 (`getStep0`)
*   **Query**: 获取验证码图片数据和 `code`。
*   **路径**: `userAuth.prereserve.captcha`

### 4.2 验证验证码 (`setStep1`)
*   **Variables**: `{"captcha": "<验证码结果>", "captchaCode": "<captcha接口返回的code>"}`

### 4.3 执行预预约 (`save`)
*   **Variables**: `{"key": "x,y", "libId": 123, ...}`
*   **路径**: `userAuth.prereserve.save`

---

## 5. 常见错误代码 (Error Codes)

在 GraphQL 响应的 `errors` 数组中可能包含以下代码：

*   **1**: `LibID` 错误，场馆不存在。
*   **40001**: `Cookies` 已过期，需要重新通过 `auth.html` 获取。
*   **其他消息**: 通常直接在 `msg` 字段中以中文描述（如“已有预约”、“座位已被占用”等）。

---

## 6. 开发建议

1.  **心跳维持**: 建议每分钟调用一次 `index` 接口以维持 `Authorization` 有效。
2.  **并发处理**: 抢座时，建议提前获取 `libLayout` 锁定 `key`，在开放瞬间直接发送 `reserueSeat`。
3.  **拼写检查**: 请务必检查服务器实际支持的是 `reserveSeat` 还是 `reserueSeat`。
