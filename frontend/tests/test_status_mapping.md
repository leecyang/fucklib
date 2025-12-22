# 前端渲染测试用例（手动）

- 目标组件：`InteractiveReserve.tsx` 与 `Dashboard.tsx`
- 数据来源：`/library/reserve` 响应对象含 `status` 与 `selection_status`

## 用例 1：未签到（reserved）
- 输入：`{ status: 1, selection_status: 'reserved', lib_id: 1, seat_key: 'A-001' }`
- 期待：
  - 交互页状态文案展示“未签到”
  - 仪表盘状态徽标文案展示“未签到”

## 用例 2：已签到（checked-in, status=2）
- 输入：`{ status: 2, selection_status: 'checked-in', ... }`
- 期待：
  - 交互页文案“已签到”
  - 仪表盘文案“已签到”

## 用例 3：已入座（checked-in, status=3）
- 输入：`{ status: 3, selection_status: 'checked-in', ... }`
- 期待：
  - 交互页文案“已入座”
  - 仪表盘文案“已入座”

## 用例 4：暂离（checked-in, status=4）
- 输入：`{ status: 4, selection_status: 'checked-in', ... }`
- 期待：
  - 交互页文案“暂离”
  - 仪表盘文案“暂离”

## 用例 5：无预约
- 输入：`null`
- 期待：
  - 交互页隐藏“当前有效预约”卡片
  - 仪表盘显示“暂无预约”并提供“立即预约”入口

