I will fix the issue where users with expired/stuck reservation records are incorrectly identified as having an active reservation.

The problem is that the `get_reserve_info` method retrieves reservation data from the API, which sometimes includes old, expired reservations (e.g., from previous days) that have not been cleared by the server. The official app likely filters these out on the client side (hence the user sees no "Current Reservation" module), but our backend code was treating them as valid active reservations.

My plan is to:
1.  Modify `backend/app/services/lib_service.py`.
2.  Import `datetime` module.
3.  Update `get_reserve_info` to parse the `date` field from the reservation data.
4.  Compare the reservation date with the current date (`today`).
5.  If the reservation date is strictly in the past, ignore it (return `None`), ensuring the system treats the user as having no seat.

This ensures that only reservations for today or the future are considered valid, resolving the issue for the affected user.