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

---

## 7. 幽灵预约修复指南（座位被占后网站误判为已预约）

当用户预选的座位在开放瞬间被他人占用时，服务器或前端可能残留“已预约”状态（俗称幽灵预约），导致无法继续手动预约。可按以下步骤自检并修复：

### 7.1 识别与确认
- 调用 `index`（`operationName: "index"`，`variables: {"pos": "App-首页"}`）读取 `userAuth.reserve.reserve`：
  - 若看到 `status` 显示已预约、但实际没有入座或 `exp_date` 已过期，视为状态异常。
- 同步调用 `libLayout`（带 `libId`）或 `list` 检查场馆余座与座位占用，核对你预选的 `seat_key` 是否已被他人占用。

### 7.2 常规解除（首选方案）
- 从 `index` 响应中获取当前预约的 `token`（记为 `sToken`）。
- 发送 `reserveCancle` 取消请求：
  ```json
  {
    "operationName": "reserveCancle",
    "variables": { "sToken": "<从index获取的token>" }
  }
  ```
- 期望返回 `userAuth.reserve.reserveCancle` 为成功；随后再次调用 `index`，`userAuth.reserve.reserve` 应为空或显示未预约。

### 7.3 Cookie 重置与重新鉴权（若取消失败或状态不刷新）
- 可能因 `Authorization` 或 `wechatSESS_ID` 失效/黏连导致状态不一致：
  - 重新访问授权接口：`GET /index.php/urlNew/auth.html?r=https://web.traceint.com/web/index.html&code=<微信code>&state=1`。
  - 接受服务器下发的 `Set-Cookie`（至少包含 `Authorization`, `SERVERID`, `wechatSESS_ID`）。
- 重新鉴权后，立刻调用一次 `index` 作为心跳，确认预约状态已恢复为未预约。

### 7.4 校验与再次预约
- 状态恢复后，先用 `libLayout` 锁定目标 `key` 并确认座位空闲。
- 在开放时间点，使用 `reserueSeat`（或服务器实际支持的 `reserveSeat`）发起预约：
  ```json
  {
    "operationName": "reserueSeat",
    "variables": {
      "seatKey": "x,y",
      "libId": 123,
      "captchaCode": "",
      "captcha": ""
    }
  }
  ```
- 响应中 `userAuth.reserve.reserueSeat` 返回 `"true"` 表示成功。

### 7.5 附加诊断
- 错误码 `40001`：表示 Cookie 过期，需走 7.3 重新鉴权。
- 学校规则校验：使用 `getUserCancleConfig` 读取 `userAuth.user.holdValidate`，若存在暂离/保留机制，可能导致短时锁定，稍后再试或先执行 7.2 取消。
- 若 `reserueSeat` 仍提示“已有预约”，重复执行 7.2 与 7.3，并确保 `Host/Origin/Referer/App-Version` 头正确模拟微信环境。

### 7.6 预防建议
- 维持心跳：每分钟调用一次 `index` 保持 `Authorization` 有效并及时刷新状态。
- 并发策略：开放前提前拉取 `libLayout` 定位 `key`，开放瞬间直接下单，避免长时间状态不一致。
- 预约后立即校验：成功后再次调用 `index`，确认 `reserve.token/status/exp_date/seat_name` 与预期一致。
