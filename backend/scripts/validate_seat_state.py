import sys
import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.append(BASE_DIR)
from app.services.lib_service import LibService


class MockLibService(LibService):
    def __init__(self):
        super().__init__(cookie="MOCK")

    def _post(self, payload):
        op = payload.get("operationName")
        if op == "index":
            return {"data": {"userAuth": {"reserve": {"reserve": self._mock_reserve}}}}
        if op == "libLayout":
            return {"data": {"userAuth": {"reserve": {"libs": [{"lib_id": 1, "lib_layout": {"seats": []}}]}}}}
        return {}

    def set_mock(self, status, date="2099-01-01", seat_key="A-001", lib_id=1):
        self._mock_reserve = {
            "status": status,
            "seat_key": seat_key,
            "lib_id": lib_id,
            "date": date,
            "token": "T123"
        }


def main():
    svc = MockLibService()
    for status in [1, 2, 3, 4, 5, 0, None]:
        svc.set_mock(status=status)
        res = svc.get_reserve_info()
        print(f"status={status} -> {res and res.get('selection_status')}")


if __name__ == "__main__":
    main()
