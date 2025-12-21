I will implement the requested features and fixes by modifying both the backend and frontend.

### Backend Changes

1.  **Add User Info Endpoint (`backend/app/routers/library.py`)**
    -   Create a new endpoint `GET /library/user_info` that exposes the existing `LibService.get_user_info()` method.
    -   This will allow the frontend to retrieve full student details (name, ID, school, etc.).

2.  **Fix Seat Layout Logic (`backend/app/services/lib_service.py`)**
    -   Modify `get_lib_layout` to remove the incorrect categorization of seats (splitting by 'Y' for monitor seats).
    -   Update the return value to provide the raw `lib_layout` object (containing the `seats` array with `x, y` coordinates) as specified in the API documentation.

### Frontend Changes

1.  **Update API Client (`frontend/src/api/client.ts`)**
    -   Add `getUserInfo` method to `libApi` to consume the new backend endpoint.
    -   Update `getLayout` to reflect the change in response structure.

2.  **Enhance Dashboard (`frontend/src/pages/Dashboard.tsx`)**
    -   Add a new section to display the User Profile.
    -   Fetch and show details like **Name (姓名)**, **Student ID (学号)**, **School (学校)**, **Last Login (上次登录)**, etc.
    -   Ensure all labels are in Chinese.

3.  **Fix Interactive Reserve (`frontend/src/pages/InteractiveReserve.tsx`)**
    -   Update `handleFloorChange` to use the unified `seats` list from the corrected API.
    -   Remove the artificial separation of "Monitor" vs "Regular" seats.
    -   Render all seats in the grid, using the provided status and name.

### Verification
-   I will verify the changes by checking if the User Info appears on the Dashboard.
-   I will verify that the Seat Map loads all seats correctly without the incorrect categorization.
