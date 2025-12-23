#!/usr/bin/env python3
"""
GitHub Secrets 自动配置脚本
用于设置部署 Vercel + Supabase 所需的所有 GitHub Actions Secrets
"""

import base64
import json
import sys
from nacl import encoding, public
import urllib.request
import urllib.error

# ==========================================
# 配置参数
# ==========================================
GITHUB_TOKEN = None  # 将在运行时提示输入
REPO_OWNER = "leecyang"
REPO_NAME = "fucklib"

# 要设置的 Secrets
SECRETS = {
    "VERCEL_TOKEN": "AB3c3x6B3XZ1YIxG9Z7J5Lr4",
    "VERCEL_ORG_ID": "team_M1jX7zZdC3ZJGYhEpAnaIJuW",
    "VERCEL_PROJECT_ID": "prj_Ka5VF6W67zzAOC7oweOmGXiM0ye8",
    "SUPABASE_ACCESS_TOKEN": "sbp_77286d137a77161bfb07e58e0583eef285ee0db0",
    "SUPABASE_PROJECT_REF": "vikmppovitscvjarhrqv",
    "SUPABASE_DB_PASSWORD": "lcy@050426",
    "PRODUCTION_URL": "https://fucklib.vercel.app",
    "VITE_API_URL": "/api",
}


def encrypt_secret(public_key: str, secret_value: str) -> str:
    """使用仓库公钥加密 secret 值"""
    public_key_bytes = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key_bytes)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def github_request(method: str, endpoint: str, data: dict = None):
    """发送 GitHub API 请求"""
    url = f"https://api.github.com{endpoint}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "FuckLib-Setup-Script",
    }
    
    body = json.dumps(data).encode('utf-8') if data else None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f"HTTP {e.code}: {error_body}")


def get_repo_public_key():
    """获取仓库的公钥用于加密 secrets"""
    return github_request("GET", f"/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/public-key")


def set_secret(name: str, encrypted_value: str, key_id: str):
    """设置一个 GitHub Secret"""
    github_request("PUT", f"/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/{name}", {
        "encrypted_value": encrypted_value,
        "key_id": key_id
    })


def main():
    global GITHUB_TOKEN
    
    print("🔐 GitHub Secrets 自动配置脚本")
    print("=" * 50)
    print()
    
    # 获取 GitHub Token
    print("请输入 GitHub Personal Access Token")
    print("(需要 repo 权限，获取地址: https://github.com/settings/tokens/new)")
    print()
    GITHUB_TOKEN = input("GitHub Token: ").strip()
    
    if not GITHUB_TOKEN:
        print("❌ Token 不能为空!")
        sys.exit(1)
    
    print()
    print("📦 将要设置的 Secrets:")
    for name in SECRETS.keys():
        print(f"  • {name}")
    print()
    
    # 获取公钥
    print("🔑 获取仓库公钥...")
    try:
        key_info = get_repo_public_key()
        print(f"✅ 公钥获取成功 (Key ID: {key_info['key_id'][:8]}...)")
    except Exception as e:
        print(f"❌ 获取公钥失败: {e}")
        sys.exit(1)
    
    print()
    print("📝 设置 Secrets...")
    
    success_count = 0
    for name, value in SECRETS.items():
        try:
            encrypted = encrypt_secret(key_info['key'], value)
            set_secret(name, encrypted, key_info['key_id'])
            print(f"  ✅ {name}")
            success_count += 1
        except Exception as e:
            print(f"  ❌ {name}: {e}")
    
    print()
    print("=" * 50)
    print(f"✅ 设置完成! 成功: {success_count}/{len(SECRETS)}")
    print()
    print("下一步: 推送代码到 deploy/vercel-supabase 分支触发部署")
    print("  git add .")
    print('  git commit -m "feat: add deployment workflow"')
    print("  git push origin deploy/vercel-supabase")


if __name__ == "__main__":
    main()
