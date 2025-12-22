I will modify the `reserve_seat` method in `backend/app/services/lib_service.py` to implement the double-check logic requested.

**Plan:**

1.  **Modify `backend/app/services/lib_service.py`**:
    *   Update `reserve_seat` method.
    *   After sending the reservation request (`reserve_payload`), instead of immediately trusting the response or its errors:
        1.  Add a short delay (0.5s) to allow the system to process.
        2.  Call `self.get_reserve_info()` (which uses the `index` API) to fetch the actual reservation status.
        3.  **Verify Success**: If `get_reserve_info()` returns a valid reservation that matches the requested `lib_id` and `seat_key`, return `True` (Success), regardless of whether the reservation API returned an error (e.g., "Repeated reservation").
        4.  **Verify Failure**: If `get_reserve_info()` returns no reservation (or a different one), consider it a failure.
            *   If the reservation API had returned an error, raise that error.
            *   If the reservation API returned success (False Positive), raise a generic "Reservation failed" exception.

This ensures that the system state relies entirely on the `index` interface, as requested, and avoids "False Positive" or "Misleading Error" scenarios where the system incorrectly believes the user has a seat.