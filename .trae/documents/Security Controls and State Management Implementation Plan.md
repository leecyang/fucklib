I have analyzed the codebase and requirements. Here is the implementation plan:

## 1. Security & Reservation Time Validation (Frontend)

* **File**: `frontend/src/pages/InteractiveReserve.tsx`

* **Action**:

  * Enhance the library selection dropdown to calculate opening hours in real-time. If the current system time is outside the `open_time_str` - `close_time_str` range, append `(闭馆)` to the library name.

  * In `handleReserve`, enforce a **strict double-check**:

    1. Verify the library's `status` field.
    2. Verify the current system time against the library's opening hours.

  * If the check fails, **immediately block the request** and show an alert, preventing the API call to `reserveSeat`.

## 2. Request Interception & Ban Status Handling

* **File**: `frontend/src/api/client.ts`

* **Action**:

  * Update the global Axios response interceptor.

  * Add a specific check for the error pattern: `msg` contains "临时限制预约用户(异常预约)" or `code` is 1.

  * If detected, trigger a specific alert: **"您因尝试预约非法座位导致账号被封禁"**.

## 3. Scheduled Tasks Exception

* **File**: `frontend/src/components/SeatPicker.tsx`

* **Action**:

  * Add an optional prop `ignoreTimeCheck` (boolean).

  * When `true`, the seat picker will allow selecting seats even if the library is currently closed (bypassing the `within` time check).

* **File**: `frontend/src/pages/ScheduledTasks.tsx`

* **Action**:

  * Pass `ignoreTimeCheck={true}` to the `SeatPicker` component to fulfill the requirement: "Allow scheduled tasks reservation to select custom seat without opening hour restriction".

## 4. User Status & Settings Sync

* **File**: `frontend/src/pages/Settings.tsx`

* **Action**:

  * Verify and ensure the `deny_deadline` display logic matches the path `data -> userAuth -> currentUser -> user_deny`.

  * The backend `lib_service.py` already implements the `index` GraphQL query required. The frontend `Settings.tsx` already has logic to display this. I will review and slightly enhance the UI to ensure the ban status is prominent.

## 5. Verification

* I will verify the logic by checking the code paths for boundary conditions and error handling.

