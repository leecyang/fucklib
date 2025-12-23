import requests
import json
import base64
import urllib.parse
from Crypto.Cipher import PKCS1_v1_5 as Cipher_pksc1_v1_5
from Crypto.PublicKey import RSA

class AuthService:
    PUBLIC_KEY_STR = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0dmmkW4xPa+HhBTyaa0dgAb0fVZRS67jK4y15BQthjJ/ZuUZQmrbGqhG7rwnxfm7g+nFH9zEyRU5KLX3ty9jpNrPjyg7FBF9OvBDYHEt83b77W3mfBjpmoTJOt27E7RZ4InHqJQjqSEo4bw1PDz2OBmtlNIlXMu0VA8I0Bh39hBBnm0oouRV7FdqEzAp8nsF7a3VuBYpx9xek+cRVip0pMXI1AXM6bmyWWNzV0oikQW4ZIbutgDziTMeW28zl/hRbW9Ht34w0sWYyxumuLr1qweW3qnxycn3zn47weFYe6nJp71z+lgVtNTGtowNPPqBLXqusvwf+uNhSy1wKQFpUwIDAQAB'

    @staticmethod
    def get_cookie_from_url(url: str, is_auth_url: bool = True) -> str:
        query = urllib.parse.urlparse(url).query
        codes = urllib.parse.parse_qs(query).get('code')
        if not codes:
            raise Exception("No code found in URL")
        
        code = codes.pop()
        data = {"r": "https://web.traceint.com/web/index.html", "code": code, "state": 1}
        session = requests.Session()
        
        if is_auth_url:
            # For Authorization cookie
            r = session.get("http://wechat.v2.traceint.com/index.php/urlNew/auth.html", params=data, allow_redirects=False)
            authorization = r.cookies.get('Authorization')
            if authorization:
                return 'Authorization=' + authorization
        else:
            # For wechatSESS_ID
            r = session.get("https://wechat.v2.traceint.com/index.php/wxApp/wechatAuth.html", params=data, allow_redirects=False)
            wechatSESS_ID = r.cookies.get('wechatSESS_ID')
            if wechatSESS_ID:
                return 'wechatSESS_ID=' + wechatSESS_ID
        
        raise Exception("Failed to get cookie")

    @staticmethod
    def _encrypt(password: str, public_key_str: str) -> str:
        key = '-----BEGIN PUBLIC KEY-----\n' + public_key_str + '\n-----END PUBLIC KEY-----'
        rsakey = RSA.importKey(key)
        cipher = Cipher_pksc1_v1_5.new(rsakey)
        cipher_text = base64.b64encode(cipher.encrypt(password.encode()))
        return cipher_text.decode()

    @staticmethod
    def sign_in(sess_id: str, major: int, minor: int) -> str:
        headers = {
            'Host': 'wechat.v2.traceint.com',
            'Connection': 'keep-alive',
            'charset': 'utf-8',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G977B Build/QP1A.190711.020; wv) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.99 XWEB/3195 MMWEBSDK/20220105 Mobile '
                          'Safari/537.36 MMWEBID/3552 MicroMessenger/8.0.19.2080(0x2800133D) Process/appbrand2 '
                          'WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64 MiniProgramEnv/android',
            'content-type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'gzip,compress,br,deflate',
            'Referer': 'https://servicewechat.com/wx3b9352e6b254ed2b/11/page-frame.html',
        }
        
        # Get Time
        try:
            r_time = requests.get('https://wechat.v2.traceint.com/index.php/wxApp/getTime.html', headers=headers)
            password = AuthService._encrypt(r_time.text, AuthService.PUBLIC_KEY_STR)
        except Exception as e:
            raise Exception(f"Failed to get timestamp: {e}")

        # Sign In
        sign_url = 'https://wechat.v2.traceint.com/index.php/wxApp/sign.html'
        device_info = [{
            "minor": int(minor),
            "rssi": -68,
            "major": int(major),
            "proximity": 2,
            "accuracy": 1.4677992676220695,
            "uuid": "fda50693-a4e2-4fb1-afcf-c6eb07647825"
        }]
        
        # clean sess_id if it contains prefix
        clean_sess_id = sess_id.replace('wechatSESS_ID=', '')
        
        datas = {
            't': clean_sess_id,
            'devices': json.dumps(device_info),
            'pass': password
        }
        
        try:
            r = requests.post(url=sign_url, data=datas, headers=headers)
            if r.status_code == 403:
                raise Exception('Forbidden(403) 打卡被阻止')
            msg = {}
            try:
                msg = r.json()
            except Exception:
                pass
            code = msg.get('code')
            if code == 403 or str(code) == '403':
                raise Exception('Forbidden(403) 打卡被阻止')
            # Treat non-zero code as failure
            if code is not None and str(code) not in ('0', '200'):
                detail = msg.get('msg') or msg.get('message') or r.text
                raise Exception(f"Sign in failed: {detail}")
            return msg.get('msg', r.text)
        except Exception as e:
            raise Exception(f"Sign in request failed: {e}")
