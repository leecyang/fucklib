import os
import time
from pywebio import *
from crawldata import Crawl
from check import Check
from hold import Hold
from withdraw import Withdraw
import utils
from pymemcache.client.base import PooledClient
from prereserve import Prereserve
from reserve import Reserve
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor


# ==================== UI 工具函数 ====================

def show_header(title, subtitle=None):
    """显示页面标题"""
    output.put_markdown(f'# 📚 {title}')
    if subtitle:
        output.put_markdown(f'*{subtitle}*')
    output.put_html('<hr style="margin: 15px 0; border-color: #eee;">')


def show_error(msg):
    """显示错误提示（红色）"""
    output.toast(f'❌ {msg}', position='center', color='#dc3545', duration=4)


def show_success(msg):
    """显示成功提示（绿色）"""
    output.toast(f'✅ {msg}', position='center', color='#28a745', duration=2)


def show_warning(msg):
    """显示警告提示（黄色）"""
    output.toast(f'⚠️ {msg}', position='center', color='#ffc107', duration=3)


def show_info(msg):
    """显示信息提示（蓝色）"""
    output.toast(f'ℹ️ {msg}', position='center', color='#2188ff', duration=2)


def check_cookie_status():
    """检查cookie状态
    返回: (is_valid, seat_info_or_message)
    """
    try:
        cookie = client.get('authorization').decode('utf-8')
        if cookie == '-1':
            return False, '未配置 - 请先扫码获取'
        
        # 尝试获取座位信息验证cookie
        result = Crawl(cookie).get_info()
        if result:
            return True, result
        else:
            return False, 'Cookie已失效 - 请重新扫码'
    except Exception as e:
        return False, f'检查失败: {str(e)}'


def get_task_status_text():
    """获取当前任务状态文本"""
    try:
        task = client.get('task').decode('utf-8')
        moment = client.get('time').decode('utf-8')
        delay = client.get('delay').decode('utf-8')
        
        if task == '1':
            return f'✅ 定时选座 - {moment} (延迟{delay}秒)'
        elif task == '2':
            return f'✅ 明日预约 - {moment} (延迟{delay}秒)'
        else:
            return '⭕ 未启用'
    except:
        return '❓ 状态未知'


def get_daily_tasks_status():
    """获取日常任务状态"""
    try:
        signin = client.get('signin').decode('utf-8')
        check = client.get('check').decode('utf-8')
        hold = client.get('hold').decode('utf-8')
        withdraw = client.get('withdraw').decode('utf-8')
        
        tasks = []
        if signin != '00:00':
            tasks.append(f'蓝牙打卡 {signin}')
        if check != '00:00':
            tasks.append(f'自动签到 {check}')
        if hold == '1':
            tasks.append('自动暂离')
        if withdraw != '00:00':
            tasks.append(f'自动退座 {withdraw}')
        
        if tasks:
            return '✅ ' + ' | '.join(tasks)
        else:
            return '⭕ 未配置'
    except:
        return '❓ 状态未知'


# ==================== 主要功能函数 ====================

def set_seat_time():
    """设置座位和时间"""
    def check_url(urlparse):
        if 'wechat.v2.traceint.com/index.php/graphql/?operationName=index&query=' not in urlparse:
            return '❌ 链接格式错误！请仔细看教程，复制正确的链接'

    show_header('设置位置及时间', '配置常用座位和选座时间')
    
    cookie = client.get('authorization').decode('utf-8')
    task = client.get('task').decode('utf-8')
    moment = client.get('time').decode('utf-8')
    delay = client.get('delay').decode('utf-8')
    
    # 获取座位信息
    seat_info = None
    try:
        if cookie != '-1':
            seat_info = Crawl(cookie).get_info()
    except Exception as e:
        show_error(f'获取座位信息失败: {str(e)}')
    
    # 如果cookie无效，提示用户扫码
    while not seat_info:
        output.put_markdown('### 📱 扫码获取授权')
        output.put_markdown('> 请使用微信扫描下方二维码，长按识别后复制网页链接')
        
        try:
            img = open('./qr.png', 'rb').read()
            output.put_image(img, width='280px')
        except FileNotFoundError:
            show_error('二维码图片 qr.png 未找到！')
            output.put_markdown('❌ 二维码图片丢失，请检查项目文件')
            time.sleep(3)
            session.go_app('index', new_window=False)
            return
        
        show_info('请使用微信扫一扫复制链接并填写')
        url = input.textarea(label='📋 粘贴链接', 
                            placeholder='将复制的链接粘贴到这里...',
                            type=input.TEXT, 
                            validate=check_url, 
                            required=True)
        
        try:
            cookie = utils.get_cookie(url, True)
            if not cookie or cookie == '-1':
                show_error('链接已过期或无效，请重新获取！')
            else:
                client.set('authorization', cookie)
                seat_info = Crawl(cookie).get_info()
                if not seat_info:
                    show_error('未设置常用座位！请先在公众号设置常用座位后重试')
        except Exception as e:
            show_error(f'处理链接失败: {str(e)}')
        
        output.clear()
        show_header('设置位置及时间', '配置常用座位和选座时间')
    
    # 显示座位信息和设置表单
    output.put_markdown('### 📍 当前座位信息')
    output.put_markdown(f'**{seat_info["info"]}**')
    output.put_html('<br>')
    
    infor = input.input_group('⚙️ 选座设置', [
        input.radio(label='选座任务', 
                   name='task', 
                   inline=True, 
                   options=[
                       ('🕐 定时选座', '1'), 
                       ('📅 明日预约', '2'), 
                       ('❌ 不启用', '0')
                   ],
                   required=True, 
                   value=task),
        input.input(label='选座时间', 
                   name='time', 
                   type=input.TIME, 
                   value=moment, 
                   required=True,
                   help_text='选座开始执行的时间'),
        input.slider(label='延迟秒数', 
                    name='delay', 
                    min_value=0, 
                    max_value=59, 
                    value=int(delay), 
                    required=True,
                    help_text='选座时间后延迟的秒数，用于错开高峰')
    ])
    
    try:
        h, m = int(infor['time'].split(':')[0]), int(infor['time'].split(':')[1])
        s = int(infor['delay'])
        
        if infor['task'] != '0':
            scheduler.add_job(id='task', func=process_task, trigger='cron', hour=h, minute=m, second=s,
                              args=[infor['task'], seat_info['lib_id'], seat_info['seat_key']], replace_existing=True)
            task_name = '定时选座' if infor['task'] == '1' else '明日预约'
            show_success(f'{task_name} 任务已设置为 {infor["time"]}:{s:02d}')
        else:
            if scheduler.get_job(job_id='task'):
                scheduler.remove_job(job_id='task')
            show_info('选座任务已关闭')
        
        client.set('delay', infor['delay'])
        client.set('task', infor['task'])
        client.set('time', infor['time'])
        
    except Exception as e:
        show_error(f'保存设置失败: {str(e)}')
    
    time.sleep(1.5)
    session.go_app('index', new_window=False)


def set_sign():
    """设置远程打卡"""
    def check_url(urlparse):
        if 'wechat.v2.traceint.com/index.php/graphql/?operationName=index&query=' not in urlparse:
            return '❌ 链接格式错误！请仔细看教程，复制正确的链接'

    show_header('远程打卡', '蓝牙签到远程操作')
    
    sess_id = client.get('sess_id').decode('utf-8')
    major = client.get('major').decode('utf-8')
    minor = client.get('minor').decode('utf-8')
    
    # 显示当前配置状态
    output.put_markdown('### 📡 当前配置')
    
    sess_status = '✅ 已配置' if sess_id and sess_id != '-1' else '❌ 未配置'
    major_display = major if major else '未设置'
    minor_display = minor if minor else '未设置'
    
    output.put_table([
        ['Session ID', sess_status],
        ['Major', major_display],
        ['Minor', minor_display],
    ])
    output.put_html('<br>')
    
    act = input.actions('请选择操作', [
        ('🔔 立即打卡', 'sign'),
        ('📝 更新 Major/Minor', 'update'),
        ('🔑 更新授权', 'auth'),
        ('🏠 返回主页', 'back')
    ])
    
    if act == 'sign':
        # 检查是否已配置所有必要信息
        if not sess_id or sess_id == '-1':
            show_error('未配置打卡授权！请点击"更新授权"扫码获取')
            time.sleep(2)
            session.go_app('index', new_window=False)
            return
        
        if not major or not minor:
            show_error('未配置蓝牙信息！请先更新 Major/Minor')
            time.sleep(2)
            session.go_app('index', new_window=False)
            return
        
        try:
            output.put_markdown('⏳ 正在打卡...')
            output.put_markdown(f'> 使用 Major: `{major}`, Minor: `{minor}`')
            
            # 确保 Major 和 Minor 是纯数字
            major_clean = major.strip()
            minor_clean = minor.strip()
            
            msg = utils.sign_in(sess_id[14:], major_clean, minor_clean)
            if msg:
                if '成功' in msg or 'success' in msg.lower():
                    show_success(f'打卡结果: {msg}')
                else:
                    show_warning(f'打卡结果: {msg}')
            else:
                show_warning('打卡返回为空，请检查配置')
        except Exception as e:
            show_error(f'打卡失败: {str(e)}')
        
        time.sleep(2)
        
    elif act == 'update':
        output.clear()
        show_header('更新打卡信息', '配置蓝牙 Major 和 Minor')
        
        output.put_markdown('''
> **如何获取 Major 和 Minor？**
> 
> 📱 **安卓**: 下载 nRF Connect 应用，靠近图书馆打卡机器扫描 iBeacon
> 
> 🍎 **苹果**: 下载 Beacon服务 应用，添加 UUID: `FDA50693-A4E2-4FB1-AFCF-C6EB07647825`
''')
        
        infor = input.input_group('📡 蓝牙参数', [
            input.input(label='Major', 
                       name='major', 
                       type=input.TEXT, 
                       value=major, 
                       required=True,
                       placeholder='例如: 10001'),
            input.input(label='Minor', 
                       name='minor', 
                       type=input.TEXT, 
                       value=minor, 
                       required=True,
                       placeholder='例如: 12345')
        ])
        
        try:
            client.set('major', infor['major'])
            client.set('minor', infor['minor'])
            show_success('Major 和 Minor 已更新')
        except Exception as e:
            show_error(f'保存信息失败: {str(e)}')
        
        time.sleep(1.5)
    
    elif act == 'auth':
        output.clear()
        show_header('更新授权', '扫码获取 Session ID')
        
        output.put_markdown('### 📱 扫码获取授权')
        try:
            img = open('./qr.png', 'rb').read()
            output.put_image(img, width='280px')
        except FileNotFoundError:
            show_error('二维码图片未找到！')
            time.sleep(2)
            session.go_app('index', new_window=False)
            return
        
        show_info('请使用微信扫一扫复制链接并填写')
        url = input.textarea(label='📋 粘贴链接', 
                            placeholder='将复制的链接粘贴到这里...',
                            type=input.TEXT, 
                            validate=check_url, 
                            required=True)
        
        try:
            wechatSESS_ID = utils.get_cookie(url, False)
            if not wechatSESS_ID or wechatSESS_ID == '-1':
                show_error('获取 Session ID 失败，请重试')
            else:
                client.set('sess_id', wechatSESS_ID)
                show_success('打卡授权已更新，会自动保活')
        except Exception as e:
            show_error(f'处理链接失败: {str(e)}')
        
        time.sleep(1.5)
    
    session.go_app('index', new_window=False)


def set_integral():
    """设置日常任务"""
    show_header('日常任务设置', '配置自动化任务')
    
    try:
        signin = client.get('signin').decode('utf-8')
        check = client.get('check').decode('utf-8')
        hold = client.get('hold').decode('utf-8')
        start = client.get('start').decode('utf-8')
        numbers = client.get('numbers').decode('utf-8')
        withdraw = client.get('withdraw').decode('utf-8')
    except Exception as e:
        show_error(f'读取配置失败: {str(e)}')
        time.sleep(2)
        session.go_app('index', new_window=False)
        return
    
    output.put_markdown('''
> **提示**: 时间设为 `00:00` 表示不启用该功能
''')
    
    infor = input.input_group('⚙️ 任务配置', [
        input.input(label='🔔 自动蓝牙打卡', 
                   name='signin', 
                   type=input.TIME, 
                   value=signin,
                   required=True, 
                   help_text='设为 00:00 则不启动'),
        input.input(label='✅ 自动签到', 
                   name='check', 
                   type=input.TIME, 
                   value=check,
                   required=True, 
                   help_text='积分签到时间，设为 00:00 则不启动'),
        input.radio(label='⏸️ 自动暂离', 
                   name='hold', 
                   inline=True, 
                   options=[('启用', '1'), ('关闭', '0')],
                   required=True, 
                   value=hold, 
                   help_text='从开始时间起每隔2小时执行一次'),
        input.input(label='⏸️ 暂离开始时间', 
                   name='start', 
                   type=input.TIME, 
                   value=start,
                   required=True),
        input.select(label='⏸️ 暂离执行次数', 
                    name='numbers', 
                    options=['1', '2', '3', '4', '5'], 
                    value=numbers,
                    required=True),
        input.input(label='🚪 自动退座', 
                   name='withdraw', 
                   type=input.TIME, 
                   value=withdraw,
                   required=True, 
                   help_text='设为 00:00 则不启动')
    ])
    
    try:
        # 配置蓝牙打卡任务
        if infor['signin'] != '00:00':
            h, m = int(infor['signin'].split(':')[0]), int(infor['signin'].split(':')[1])
            scheduler.add_job(id='signin', func=process_signin, trigger='cron', hour=h, minute=m, second=1,
                              replace_existing=True)
        else:
            if scheduler.get_job(job_id='signin'):
                scheduler.remove_job(job_id='signin')
        
        # 配置自动签到任务
        if infor['check'] != '00:00':
            h, m = int(infor['check'].split(':')[0]), int(infor['check'].split(':')[1])
            scheduler.add_job(id='check', func=process_check, trigger='cron', hour=h, minute=m, second=1,
                              replace_existing=True)
        else:
            if scheduler.get_job(job_id='check'):
                scheduler.remove_job(job_id='check')
        
        # 配置自动暂离任务
        if infor['hold'] == '1':
            h, m = int(infor['start'].split(':')[0]), int(infor['start'].split(':')[1])
            for i in range(int(infor['numbers'])):
                scheduler.add_job(id='hold_' + str(i), func=process_hold, trigger='cron', hour=h, minute=m, second=1,
                                  replace_existing=True)
                h += 2
        else:
            for i in range(5):
                if scheduler.get_job(job_id='hold_' + str(i)):
                    scheduler.remove_job(job_id='hold_' + str(i))
        
        # 配置自动退座任务
        if infor['withdraw'] != '00:00':
            h, m = int(infor['withdraw'].split(':')[0]), int(infor['withdraw'].split(':')[1])
            scheduler.add_job(id='withdraw', func=process_withdraw, trigger='cron', hour=h, minute=m, second=1,
                              replace_existing=True)
        else:
            if scheduler.get_job(job_id='withdraw'):
                scheduler.remove_job(job_id='withdraw')
        
        # 保存配置
        client.set('signin', infor['signin'])
        client.set('check', infor['check'])
        client.set('hold', infor['hold'])
        client.set('start', infor['start'])
        client.set('numbers', infor['numbers'])
        client.set('withdraw', infor['withdraw'])
        
        show_success('日常任务设置完成')
        
    except Exception as e:
        show_error(f'保存设置失败: {str(e)}')
    
    time.sleep(1.5)
    session.go_app('index', new_window=False)


def index():
    """主页 - 显示系统状态和操作菜单"""
    show_header('我去图书馆选座', '自动化选座脚本 v2.0')
    
    # 检查cookie状态
    is_valid, cookie_result = check_cookie_status()
    
    # 状态显示
    output.put_markdown('### 📊 系统状态')
    
    if is_valid:
        cookie_display = output.put_html(f'<span style="color:#28a745">● 有效</span> - {cookie_result["info"]}')
    else:
        cookie_display = output.put_html(f'<span style="color:#dc3545">● {cookie_result}</span>')
    
    output.put_table([
        ['🎫 Cookie状态', cookie_display],
        ['🎯 选座任务', get_task_status_text()],
        ['📋 日常任务', get_daily_tasks_status()],
    ])
    
    output.put_html('<br>')
    
    # 操作菜单
    output.put_markdown('### 🎛️ 操作菜单')
    
    act = input.actions('', [
        ('📍 设置位置及时间', 'seat'),
        ('🔔 设置打卡', 'sign'),
        ('📋 设置日常任务', 'integral')
    ])
    
    output.clear()
    
    if act == 'seat':
        set_seat_time()
    elif act == 'sign':
        set_sign()
    elif act == 'integral':
        set_integral()


# ==================== 后台任务处理函数 ====================

def process_task(task, floor, seat):
    """处理选座任务"""
    try:
        cookie = client.get('authorization').decode('utf-8')
        if cookie == '-1':
            print('[Error] Cookie未配置，无法执行选座任务')
            return
        
        if task == '1':
            reserve = Reserve(cookie)
            for i in range(5):
                if reserve.choose_seat(floor, seat):
                    print('[Success] 选座成功')
                    break
            else:
                print('[Failed] 选座失败，已重试5次')
        else:
            result = Prereserve(cookie).prereserve(floor, seat)
            if result:
                print('[Success] 明日预约成功')
            else:
                print('[Failed] 明日预约失败')
    except Exception as e:
        print(f'[Error] 选座任务执行失败: {str(e)}')


def process_signin():
    """处理蓝牙打卡任务"""
    try:
        major = client.get('major').decode('utf-8')
        minor = client.get('minor').decode('utf-8')
        if major and minor:
            sess_id = client.get('sess_id').decode('utf-8')
            result = utils.sign_in(sess_id[14:], major, minor)
            print(f'[Signin] 打卡结果: {result}')
        else:
            print('[Signin] Major/Minor 未配置')
    except Exception as e:
        print(f'[Error] 打卡任务失败: {str(e)}')


def process_check():
    """处理自动签到任务"""
    try:
        cookie = client.get('authorization').decode('utf-8')
        if cookie == '-1':
            print('[Error] Cookie未配置，无法执行签到')
            return
        Check(cookie).check_in()
        print('[Check] 签到执行完成')
    except Exception as e:
        print(f'[Error] 签到任务失败: {str(e)}')


def process_hold():
    """处理自动暂离任务"""
    try:
        cookie = client.get('authorization').decode('utf-8')
        if cookie == '-1':
            print('[Error] Cookie未配置，无法执行暂离')
            return
        Hold(cookie).hold()
        print('[Hold] 暂离执行完成')
    except Exception as e:
        print(f'[Error] 暂离任务失败: {str(e)}')


def process_withdraw():
    """处理自动退座任务"""
    try:
        cookie = client.get('authorization').decode('utf-8')
        if cookie == '-1':
            print('[Error] Cookie未配置，无法执行退座')
            return
        Withdraw(cookie).withdraw()
        print('[Withdraw] 退座执行完成')
    except Exception as e:
        print(f'[Error] 退座任务失败: {str(e)}')


# ==================== 主程序入口 ====================

if __name__ == '__main__':
    executors = {
        'default': ThreadPoolExecutor(20)
    }
    scheduler = BackgroundScheduler(timezone='Asia/Shanghai', executors=executors)
    scheduler.start()
    
    # 从环境变量读取memcached配置（支持Docker Compose）
    memcached_host = os.getenv('MEMCACHED_HOST', 'localhost')
    memcached_port = int(os.getenv('MEMCACHED_PORT', '11211'))
    print(f'[Init] 连接 Memcached: {memcached_host}:{memcached_port}')
    
    client = PooledClient((memcached_host, memcached_port), max_pool_size=20, timeout=3)
    
    # 初始化默认配置
    client.set('authorization', '-1')
    client.set('sess_id', '-1')
    client.set('task', '0')
    client.set('time', '00:00')
    client.set('delay', '0')
    client.set('major', '')
    client.set('minor', '')
    client.set('signin', '00:00')
    client.set('check', '00:00')
    client.set('hold', '0')
    client.set('start', '00:00')
    client.set('numbers', '1')
    client.set('withdraw', '00:00')
    
    # Cookie自动保活任务
    scheduler.add_job(id='cookie_task', func=utils.cookie_task, trigger='interval', minutes=1, seconds=47)
    
    # 启动Web服务器
    config(title='我去图书馆选座', theme='minty')  # 使用minty主题，更清新
    start_server(index, port=80, cdn=False)
