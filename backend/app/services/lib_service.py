import requests
import random
import time
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
        # Add required cookie fields
        self.cookie = self.cookie + '; FROM_TYPE=weixin; v=5.5; Hm_lvt_7ecd21a13263a714793f376c18038a87=1713417820,1714277047,1714304621,1714376091; ' \
                               'Hm_lpvt_7ecd21a13263a714793f376c18038a87=' + str(int(time.time() - 1)) + '; SERVERID=' + \
                      random.choice(self.SERVERID) + '|' + str(int(time.time() - 1)) + '|1714376087'
        self.headers['Cookie'] = self.cookie

    def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # logger.info(f"Sending request: {payload.get('operationName')}")
            r = requests.post(self.BASE_URL, json=payload, headers=self.headers, timeout=10)
            r.raise_for_status()
            data = r.json()
            if 'errors' in data:
                logger.error(f"GraphQL Error for {payload.get('operationName')}: {data['errors']}")
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
        
        user_auth = data.get('data', {}).get('userAuth')
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
        # 1. Lib Layout (Check if needed?)
        lib_payload = {
            "operationName": "libLayout",
            "query": "query libLayout($libId: Int, $libType: Int) {\n userAuth {\n reserve {\n libs(libType: "
                     "$libType, libId: $libId) {\n lib_id\n }\n }\n }\n}",
            "variables": {"libId": lib_id}
        }
        self._post(lib_payload) # Just call it as in original code

        # 2. Reserve
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
        if 'errors' in res:
            raise Exception(res['errors'][0].get('message', 'Reserve Failed'))
        return True

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
        # First try API 9
        try:
            payload = {
                "operationName": "getReserveInfo",
                "query": "query getReserveInfo{reserveInfo{libId seatKey date status}}",
                "variables": {}
            }
            res = self._post(payload)
            if res.get('data', {}).get('reserveInfo'):
                return res.get('data', {}).get('reserveInfo')
            logger.info("getReserveInfo returned empty, falling back to index query.")
        except Exception as e:
            logger.warning(f"getReserveInfo failed: {e}")
            
        # Fallback to index query
        try:
            index_payload = {
                "operationName": "index",
                "query": "query index($pos: String!) { userAuth { reserve { reserve { status lib_id seat_key } } } }",
                "variables": {"pos": "App-首页"}
            }
            r = self._post(index_payload)
            return r.get('data', {}).get('userAuth', {}).get('reserve', {}).get('reserve')
        except Exception as e:
            logger.error(f"Fallback get_reserve_info failed: {e}")
            return None

    # --- Interactive Info ---
    def get_lib_list(self):
        payload = {
            "operationName": "queryLibList",
            "query": "query queryLibList{libList{id name status}}",
            "variables": {}
        }
        # Note: The doc says queryLibList. Current code calls 'index' to get some info.
        # If this fails, we might need to check how to get lib list.
        # But let's assume the doc is correct for the "Future" upgrade.
        # If the API endpoint is the same /graphql, it should work.
        # However, looking at legacy code, there is no get_lib_list.
        # I'll implement it trusting the doc.
        try:
            data = self._post(payload)
            lib_list = data.get('data', {}).get('libList', [])
            if not lib_list:
                logger.warning(f"get_lib_list returned empty. Response: {data}")
            return lib_list
        except Exception as e:
            logger.error(f"get_lib_list failed: {e}")
            return []

    def get_floor_list(self, lib_id: int):
        payload = {
            "operationName": "queryFloorList",
            "query": "query queryFloorList($libId:Int!){floorList(libId:$libId){id name}}",
            "variables": {"libId": lib_id}
        }
        try:
             data = self._post(payload)
             return data.get('data', {}).get('floorList', [])
        except Exception as e:
             logger.error(f"get_floor_list failed: {e}")
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
        libs = data.get('data', {}).get('userAuth', {}).get('reserve', {}).get('libs', [])
        if libs:
            lib_data = libs[0]
            # Categorize seats
            seats = lib_data.get('lib_layout', {}).get('seats', [])
            regular = []
            monitor = []
            for seat in seats:
                if seat.get('name', '').upper().startswith('Y'):
                    monitor.append(seat)
                else:
                    regular.append(seat)
            lib_data['seats_regular'] = regular
            lib_data['seats_monitor'] = monitor
            return lib_data
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
        
        async with websockets.connect(self.WS_URL, extra_headers=socket_headers) as websocket:
            while True:
                await websocket.send('{"ns":"prereserve/queue","msg":""}')
                response = await websocket.recv()
                if 'u6392' in response: # "排队" unicode?
                    break
    
    def prereserve_seat(self, lib_id: int, seat_key: str):
        # 1. Check Msg
        check_payload = {
            "operationName": "prereserveCheckMsg",
            "query": "query prereserveCheckMsg {\n userAuth {\n prereserve {\n prereserveCheckMsg\n }\n }\n}"
        }
        r = self._post(check_payload)
        msg = r.get('data', {}).get('userAuth', {}).get('prereserve', {}).get('prereserveCheckMsg')
        
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
            "query": "query index($pos: String!) { userAuth { reserve { reserve { status } } } }",
            "variables": {"pos": "App-首页"}
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
            "query": "query index($pos: String!) { userAuth { reserve { getSToken } } }",
            "variables": {"pos": "App-首页"}
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
