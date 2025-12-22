# 修复 500 错误与账号隔离性确认

## 1. 确认 Cookies/Session ID 的隔离性
我已检查 `backend/app/routers/library.py` 和 `backend/app/routers/auth.py` 的代码。
- **结论**: 是严格隔离的。
- **分析**: 
  - 系统使用 JWT Token 识别当前用户。
  - 每个 API 请求都会通过 `get_current_user` 获取当前用户信息。
  - `LibService` 实例是**每个请求独立创建的** (`LibService(current_user.wechat_config.cookie)`)，直接使用当前用户的数据库配置。
  - 因此，普通用户的 Cookie 失效不会直接污染管理员的 `LibService` 实例。
- **为何管理员账号也崩溃**:
  - 极有可能是因为**代码逻辑缺陷**（即日志中的 `AttributeError`）。当后端抛出 500 错误时，前端页面可能因为无法获取数据而白屏或报错，让人感觉"账号崩溃"。
  - 另外，如果所有请求都从同一个 IP（Docker 容器）发出，目标服务器可能会针对 IP 进行限流，导致所有账号（包括管理员）都出现连接问题。

## 2. 修复计划 (代码编写将全程使用中文注释)

我将修改 `backend/app/services/lib_service.py` 文件，修复导致崩溃的核心 Bug：

1.  **修复空指针异常 (`AttributeError: 'NoneType' ...`)**:
    - 在 `get_lib_list`、`get_reserve_info`、`get_seat_info` 等方法中，增加健壮性检查。
    - 当上游 API 返回错误（导致 `data` 为 `null`）时，不再盲目读取属性，而是安全地返回空列表或 `None`，避免触发 500 服务器内部错误。

2.  **增强错误处理 (Error Handling)**:
    - 修改 `_post` 方法，增加对错误码 `40005` (**需要绑定学号**) 的识别。
    - 目前代码只识别 `40001`，遇到 `40005` 时会忽略错误并返回 `null` 数据，导致后续代码崩溃。
    - 修复后将明确抛出异常，让前端能收到准确的错误提示（如"请先绑定学号"），而不是不明所以的"系统错误"。

通过这些修改，系统将不再因为单个账号的配置问题（如未绑定学号）而抛出代码级异常，管理员账号的访问也将恢复正常（只要不是被目标服务器封锁 IP）。