import json
import os
import urllib.parse
import requests
from pymemcache.client.base import Client
import base64
from Crypto.Cipher import PKCS1_v1_5 as Cipher_pksc1_v1_5
from Crypto.PublicKey import RSA
from crawldata import Crawl


def get_cookie(url, flag):
    query = urllib.parse.urlparse(url).query
    codes = urllib.parse.parse_qs(query).get('code')
    if codes:
        code = codes.pop()
    else:
        return None
    data = {"r": "https://web.traceint.com/web/index.html", "code": code, "state": 1}
    session = requests.Session()
    if flag:
        r = session.get("http://wechat.v2.traceint.com/index.php/urlNew/auth.html", params=data, allow_redirects=False)
        authorization = r.cookies.get('Authorization')
        if authorization:
            cookie_string = 'Authorization=' + authorization
            return cookie_string
        else:
            return '-1'
    else:
        r = session.get("https://wechat.v2.traceint.com/index.php/wxApp/wechatAuth.html", params=data, allow_redirects=False)
        wechatSESS_ID = r.cookies.get('wechatSESS_ID')
        if wechatSESS_ID:
            cookie_string = 'wechatSESS_ID=' + wechatSESS_ID
            return cookie_string
        else:
            return '-1'



def encrpt(password, public_key):
    rsakey = RSA.importKey(public_key)
    cipher = Cipher_pksc1_v1_5.new(rsakey)
    cipher_text = base64.b64encode(cipher.encrypt(password.encode()))
    return cipher_text.decode()


def sign_in(sess_id, major, minor):
    # key是公钥，需要修改成自己的之后再进行加密
    key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0dmmkW4xPa+HhBTyaa0dgAb0fVZRS67jK4y15BQthjJ/ZuUZQmrbGqhG7rwnxfm7g+nFH9zEyRU5KLX3ty9jpNrPjyg7FBF9OvBDYHEt83b77W3mfBjpmoTJOt27E7RZ4InHqJQjqSEo4bw1PDz2OBmtlNIlXMu0VA8I0Bh39hBBnm0oouRV7FdqEzAp8nsF7a3VuBYpx9xek+cRVip0pMXI1AXM6bmyWWNzV0oikQW4ZIbutgDziTMeW28zl/hRbW9Ht34w0sWYyxumuLr1qweW3qnxycn3zn47weFYe6nJp71z+lgVtNTGtowNPPqBLXqusvwf+uNhSy1wKQFpUwIDAQAB'
    public_key = '-----BEGIN PUBLIC KEY-----\n' + key + '\n-----END PUBLIC KEY-----'
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
    
    try:
        # 获取时间戳也加上 headers，防止被拦截
        r_time = requests.get('https://wechat.v2.traceint.com/index.php/wxApp/getTime.html', headers=headers)
        password = encrpt(r_time.text, public_key)
    except Exception as e:
        print(f'[sign_in] 获取时间戳失败: {e}')
        return f'获取时间戳失败: {str(e)}'
    
    try:
        sign_url = 'https://wechat.v2.traceint.com/index.php/wxApp/sign.html'
        
        # 使用 JSON 格式构建 devices 数据
        # 注意：UUID 改为小写，proximity=2 (Near) 匹配 RSSI -68
        device_info = [{
            "minor": int(minor),
            "rssi": -68,
            "major": int(major),
            "proximity": 2,
            "accuracy": 1.4677992676220695,
            "uuid": "fda50693-a4e2-4fb1-afcf-c6eb07647825"
        }]
        
        datas = {
            't': sess_id,
            'devices': json.dumps(device_info),
            'pass': password
        }
        
        print(f'[sign_in] 请求参数: t={sess_id[:10]}..., major={major}, minor={minor}')
        
        r = requests.post(url=sign_url, data=datas, headers=headers)
        print(f'[sign_in] 响应: {r.text}')
        
        msg = json.loads(r.text)
        return msg.get('msg', f'未知响应: {r.text}')
    except ValueError as e:
        print(f'[sign_in] Major/Minor 必须是数字: {e}')
        return 'Major/Minor 必须是纯数字'
    except Exception as e:
        print(f'[sign_in] 打卡请求失败: {e}')
        return f'打卡请求失败: {str(e)}'


def cookie_task():
    """Cookie保活任务 - 定期刷新cookie防止过期"""
    memcached_host = os.getenv('MEMCACHED_HOST', 'localhost')
    memcached_port = int(os.getenv('MEMCACHED_PORT', '11211'))
    client = Client((memcached_host, memcached_port))
    
    try:
        authorization = client.get('authorization').decode('utf-8')
        sess_id = client.get('sess_id').decode('utf-8')
        
        if authorization != '-1':
            new_cookie = Crawl(authorization).cookie_update()
            if new_cookie and 'Authorization' in new_cookie:
                authorization = 'Authorization=' + new_cookie['Authorization']
                client.set('authorization', authorization)
                print('[CookieTask] Authorization已刷新')
        
        if sess_id != '-1':
            Crawl(sess_id).wechat_update()
            print('[CookieTask] Session已刷新')
            
    except Exception as e:
        print(f'[CookieTask] Cookie保活失败: {str(e)}')
    finally:
        client.close()


