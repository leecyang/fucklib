import requests
import random
import time
from datetime import datetime
import json
import asyncio
import websockets
from typing import Optional, Dict, Any

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LibService:
    SERVERID = ['82967fec9605fac9a28c437e2a3ef1a4', 'b9fc7bd86d2eed91b23d7347e0ee995e',
                'e3fa93b0fb9e2e6d4f53273540d4e924', 'd3936289adfff6c3874a2579058ac651']
    
    BASE_URL = "https://wechat.v2.traceint.com/index.php/graphql/"
    WS_URL = "wss://wechat.v2.traceint.com/ws?ns=prereserve/queue"

    def __init__(self, cookie: str):
        self.cookie = cookie
        self.session = requests.Session()
        self._lib_layout_seen = set()
        self.headers = {
            'Host': 'wechat.v2.traceint.com',
            'Connection': 'keep-alive',
            'App-Version': '2.0.14',
            'Origin': 'https://web.traceint.com',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; M2012K11AC Build/RKQ1.200826.002; wv) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.99 XWEB/3149 MMWEBSDK/20211001 Mobile '
                          'Safari/537.36 MMWEBID/68 MicroMessenger/8.0.16.2040(0x28001053) Process/toolsmp '
                          'WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Referer': 'https://web.traceint.com/web/index.html',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        self._init_cookie()

    def _init_cookie(self):
        # Do not preset SERVERID to avoid hitting wrong backend node
        self.cookie = self.cookie + '; FROM_TYPE=weixin; v=5.5; Hm_lvt_7ecd21a13263a714793f376c18038a87=1713417820,1714277047,1714304621,1714376091; ' \
                               'Hm_lpvt_7ecd21a13263a714793f376c18038a87=' + str(int(time.time() - 1))
        self.headers['Cookie'] = self.cookie
        self.session.headers.update(self.headers)

    def _extract_serverid(self, set_cookie_header: Optional[str]) -> Optional[str]:
        if not set_cookie_header:
            return None
        idx = set_cookie_header.find('SERVERID=')
        if idx == -1:
            return None
        end = set_cookie_header.find(';', idx)
        if end == -1:
            end = len(set_cookie_header)
        return set_cookie_header[idx + len('SERVERID='):end]

    def _reset_serverid(self, serverid: str):
        if not serverid:
            return
        parts = self.cookie.split(';')
        found = False
        for i, p in enumerate(parts):
            t = p.strip()
            if t.startswith('SERVERID='):
                parts[i] = ' SERVERID=' + serverid
                found = True
                break
        if not found:
            parts.append(' SERVERID=' + serverid)
        self.cookie = ';'.join(parts)
        self.headers['Cookie'] = self.cookie
        self.session.headers['Cookie'] = self.cookie

    def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            r = self.session.post(self.BASE_URL, json=payload, timeout=10)
            r.raise_for_status()
            sc = r.headers.get('Set-Cookie')
            sid = self._extract_serverid(sc)
            if sid:
                self._reset_serverid(sid)
            data = r.json()
            if 'errors' in data:
                logger.error(f"GraphQL Error for {payload.get('operationName')}: {data['errors']}")
                try:
                    errs = data.get('errors') or []
                    for e in errs:
                        msg = e.get('msg') or e.get('message') or ''
                        code = e.get('code')
                        if code == 40001 or ('access denied' in str(msg).lower()):
                            raise Exception('Cookie失效或账号被临时限制(40001)')
                        if code == 40005 or '绑定学号' in str(msg):
                            raise Exception('需要绑定学号(40005)')
                except Exception as ex:
                    raise ex
            return data
        except Exception as e:
            logger.error(f"Request failed: {e}")
            if 'r' in locals() and r is not None:
                logger.error(f"Response content: {r.text}")
            raise

    # --- Crawl / Info ---
    def get_user_info(self):
        payload = {
            "operationName": "index",
            "query": "query index($pos: String!, $param: [hash]) {\n "
                     "userAuth {\n oftenseat {\n list {\n id\n info\n lib_id\n seat_key\n status\n }\n }\n "
                     "message {\n new(from: \"system\") {\n has\n from_user\n title\n num\n }\n indexMsg {\n "
                     "message_id\n title\n content\n isread\n isused\n from_user\n create_time\n }\n }\n "
                     "reserve {\n reserve {\n token\n status\n user_id\n user_nick\n sch_name\n lib_id\n "
                     "lib_name\n lib_floor\n seat_key\n seat_name\n date\n exp_date\n exp_date_str\n "
                     "validate_date\n hold_date\n diff\n diff_str\n mark_source\n isRecordUser\n isChooseSeat\n "
                     "isRecord\n mistakeNum\n openTime\n threshold\n daynum\n mistakeNum\n closeTime\n "
                     "timerange\n forbidQrValid\n renewTimeNext\n forbidRenewTime\n forbidWechatCancle\n }\n "
                     "getSToken\n }\n currentUser {\n user_id\n user_nick\n user_mobile\n user_sex\n "
                     "user_sch_id\n user_sch\n user_last_login\n user_avatar(size: MIDDLE)\n user_adate\n "
                     "user_student_no\n user_student_name\n area_name\n user_deny {\n deny_deadline\n }\n sch "
                     "{\n sch_id\n sch_name\n activityUrl\n isShowCommon\n isBusy\n }\n }\n }\n "
                     "ad(pos: $pos, param: $param) {\n name\n pic\n url\n }\n}",
            "variables": {"pos": "App-首页"}
        }
        data = self._post(payload)
        if 'errors' in data:
            raise Exception(data['errors'][0].get('message', 'Unknown API Error'))
        
        # Safe access to data.get('data') which might be None
        user_auth = (data.get('data') or {}).get('userAuth')
        if not user_auth:
            raise Exception('Failed to get user info')
            
        return user_auth

    def get_seat_info(self):
        user_auth = self.get_user_info()
        oftenseat = user_auth.get('oftenseat', {}).get('list', [])
        if not oftenseat:
            return []
        
        return oftenseat

    # --- Reserve ---
    def reserve_seat(self, lib_id: int, seat_key: str):
        if lib_id not in self._lib_layout_seen:
            lib_payload = {
                "operationName": "libLayout",
                "query": "query libLayout($libId: Int, $libType: Int) {\n userAuth {\n reserve {\n libs(libType: "
                         "$libType, libId: $libId) {\n lib_id\n }\n }\n }\n}",
                "variables": {"libId": lib_id}
            }
            self._post(lib_payload)
            self._lib_layout_seen.add(lib_id)

        reserve_payload = {
            "operationName": "reserueSeat",
            "query": "mutation reserueSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: "
                     "String!) {\n userAuth {\n reserve {\n reserueSeat(\n libId: $libId\n seatKey: "
                     "$seatKey\n captchaCode: $captchaCode\n captcha: $captcha\n )\n }\n }\n}",
            "variables": {
                "libId": lib_id,
                "seatKey": seat_key,
                "captchaCode": "",
                "captcha": ""
            }
        }
        res = self._post(reserve_payload)

        # Do not trust reserveSeat error messages. Always trust index status.
        time.sleep(0.5)
        reserve_info = self.get_reserve_info()
        if reserve_info:
            r_lib_id = reserve_info.get('lib_id')
            r_seat_key = reserve_info.get('seat_key')
            # Check if reserved seat matches requested (handle string/int conversion safely)
            if str(r_lib_id) == str(lib_id) and str(r_seat_key) == str(seat_key):
                return True

        if 'errors' in res:
            raise Exception(res['errors'][0].get('message', 'Reserve Failed'))
        
        raise Exception('预约失败：系统未确认座位，请稍后重试')

    def cancel_reserve(self):
        payload = {
            "operationName": "cancelReserve",
            "query": "mutation cancelReserve{cancelReserve{success msg}}",
            "variables": {}
        }
        res = self._post(payload)
        if 'errors' in res:
            # Fallback to withdraw logic if this API doesn't work as expected or is same as withdraw
            # The doc says "cancelReserve" (API 8).
            raise Exception(res['errors'][0].get('message', 'Cancel Failed'))
        return res.get('data', {}).get('cancelReserve')

    def get_reserve_info(self):
        # API 9 (getReserveInfo) is unreliable when pre-selected seat is occupied by others
        # User instructed to rely on index API (API 8) and check if data.userAuth.reserve.reserve is null
        try:
            # Use complete query structure to avoid schema issues
            index_payload = {
                "operationName": "index",
                "query": "query index { userAuth { reserve { reserve { token status user_id user_nick sch_name lib_id lib_name lib_floor seat_key seat_name date exp_date exp_date_str validate_date hold_date diff diff_str mark_source isRecordUser isChooseSeat isRecord mistakeNum openTime threshold daynum mistakeNum closeTime timerange forbidQrValid renewTimeNext forbidRenewTime forbidWechatCancle } getSToken } } }",
                "variables": {}
            }
            r = self._post(index_payload)
            reserve_data = ((r.get('data') or {}).get('userAuth') or {}).get('reserve', {}).get('reserve')
            
            # Comprehensive validation based on user feedback
            if not reserve_data:
                return None

            # 1. Check status (0 or None means no valid reservation)
            # Status: 0=None, 1=Reserved, 2=Signed In, 3=In Use, 4=Away, 5=Finished
            status = reserve_data.get('status')
            # Fix: Only allow active statuses. 5 (Finished) means seat is released.
            valid_statuses = [1, 2, 3, 4]
            if status not in valid_statuses:
                return None

            # 2. Check seat_key
            if not reserve_data.get('seat_key'):
                return None

            # 3. Check date (Ignore past reservations)
            # If the reservation date is strictly before today, it's a stale record.
            date_str = reserve_data.get('date')
            if not date_str or str(date_str).strip() == '':
                return None
            else:
                try:
                    res_date = datetime.strptime(str(date_str), "%Y-%m-%d").date()
                    today = datetime.now().date()
                    if res_date < today:
                        logger.info(f"Ignoring past reservation for {date_str} (Status: {status})")
                        return None
                except Exception as e:
                    logger.warning(f"Date parse failed: {e}")

            # Note: Do not check expiration locally. Trust the server's status.
            # If status is active, the seat is ours even if local time > exp_date.

            return reserve_data
        except Exception as e:
            logger.error(f"get_reserve_info failed: {e}")
            return None

    # --- Interactive Info ---
    def get_lib_list(self):
        payload = {
            "operationName": "list",
            "query": "query list { userAuth { reserve { libs { lib_id lib_name lib_floor is_open } } } }",
            "variables": {}
        }
        try:
            data = self._post(payload)
            libs = ((data.get('data') or {}).get('userAuth') or {}).get('reserve', {}).get('libs') or []
            result = []
            for lib in libs:
                result.append({
                    "id": lib.get('lib_id'),
                    "name": f"{lib.get('lib_name')} - {lib.get('lib_floor')}",
                    "status": 1 if lib.get('is_open') else 0
                })
            return result
        except Exception as e:
            logger.error(f"get_lib_list failed: {e}")
            return []

    def get_floor_list(self, lib_id: int):
        # Deprecated: get_lib_list now returns all rooms directly
        return []

    def get_lib_layout(self, lib_id: int):
        payload = {
            "operationName": "libLayout",
            "query": "query libLayout($libId: Int, $libType: Int) {\n userAuth {\n reserve {\n libs(libType: "
                     "$libType, libId: $libId) {\n lib_id\n is_open\n lib_floor\n lib_name\n lib_type\n "
                     "lib_layout {\n seats_total\n seats_booking\n seats_used\n max_x\n max_y\n seats "
                     "{\n x\n y\n key\n type\n name\n seat_status\n status\n }\n }\n }\n }\n }\n}",
            "variables": {"libId": lib_id}
        }
        data = self._post(payload)
        libs = ((data.get('data') or {}).get('userAuth') or {}).get('reserve', {}).get('libs') or []
        if libs:
            return libs[0]
        logger.warning(f"get_lib_layout returned no libs. Response: {data}")
        return None

    # --- Pre-reserve (Next Day) ---
    async def _wait_queue(self):
        socket_headers = self.headers.copy()
        socket_headers.update({
            'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Pragma': 'no-cache',
            'Cache-Control': 'no-cache', 'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits'
        })
        
        start = time.time()
        async with websockets.connect(self.WS_URL, extra_headers=socket_headers) as websocket:
            while True:
                await websocket.send('{"ns":"prereserve/queue","msg":""}')
                response = await websocket.recv()
                if 'u6392' in response or 'success' in response:
                    break
                await asyncio.sleep(0.8)
                if time.time() - start > 150:
                    raise Exception('队列等待超时')
    
    def prereserve_seat(self, lib_id: int, seat_key: str):
        # 1. Check Msg
        check_payload = {
            "operationName": "prereserveCheckMsg",
            "query": "query prereserveCheckMsg {\n userAuth {\n prereserve {\n prereserveCheckMsg\n }\n }\n}"
        }
        r = self._post(check_payload)
        msg = ((r.get('data') or {}).get('userAuth') or {}).get('prereserve', {}).get('prereserveCheckMsg')
        
        if msg == '':
            # Queue
            asyncio.run(self._wait_queue())
            
            # Save
            save_payload = {
                "operationName": "save",
                "query": "mutation save($key: String!, $libid: Int!, $captchaCode: String, $captcha: String) "
                         "{\n userAuth {\n prereserve {\n save(key: $key, libId: $libid, captcha: $captcha, "
                         "captchaCode: $captchaCode)\n }\n }\n}",
                "variables": {
                    "libid": lib_id,
                    "key": seat_key,
                    "captchaCode": "",
                    "captcha": ""
                }
            }
            res = self._post(save_payload)
            if 'errors' in res:
                 raise Exception(res['errors'][0].get('message', 'Prereserve Failed'))
            return True
        else:
            raise Exception(f"Prereserve Check Failed: {msg}")

    def refresh_page(self):
        try:
            self._post({
                "operationName": "index",
                "query": "query index { userAuth { currentUser { user_id } prereserve { prereserveCheckMsg } } }",
                "variables": {}
            })
        except Exception:
            pass

    # --- Check In (Integral) ---
    def check_in_integral(self):
        list_payload = {
            "operationName": "getList",
            "query": "query getList {\n userAuth {\n credit {\n tasks {\n id\n }\n }\n }\n}"
        }
        r = self._post(list_payload)
        tasks = r.get('data', {}).get('userAuth', {}).get('credit', {}).get('tasks', [])
        
        if tasks:
            task_id = tasks[0]['id']
            done_payload = {
                "operationName": "done",
                "query":"mutation done($user_task_id: Int!) {\n userAuth {\n credit {\n done(user_task_id: "
                        "$user_task_id)\n }\n }\n}",
                "variables": {"user_task_id": task_id}
            }
            self._post(done_payload)
            time.sleep(1)
            self._post(done_payload) # Double tap as in original code
            return True
        return False

    # --- Hold (Temporary Leave) ---
    def hold_seat(self):
        # Check status first
        index_payload = {
            "operationName": "index",
            "query": "query index { userAuth { reserve { reserve { status } } } }",
            "variables": {}
        }
        r = self._post(index_payload)
        status = r.get('data', {}).get('userAuth', {}).get('reserve', {}).get('reserve', {}).get('status')
        
        if status == 3: # Assuming 3 is "seated"
            hold_payload = {
                "operationName": "reserveHold",
                "query": "mutation reserveHold {\n userAuth {\n reserve {\n reserveHold\n }\n }\n}"
            }
            self._post(hold_payload)
            return True
        return False

    # --- Withdraw ---
    def withdraw_seat(self):
        index_payload = {
            "operationName": "index",
            "query": "query index { userAuth { reserve { getSToken } } }",
            "variables": {}
        }
        r = self._post(index_payload)
        token = r.get('data', {}).get('userAuth', {}).get('reserve', {}).get('getSToken')
        
        if token:
            withdraw_payload = {
                "operationName": "reserveCancle",
                "query": "mutation reserveCancle($sToken: String!) {\n userAuth {\n "
                         "reserve {\n reserveCancle(sToken: $sToken) {\n "
                         "timerange\n }\n }\n }\n}",
                "variables": {"sToken": token}
            }
            self._post(withdraw_payload)
            return True
        return False
