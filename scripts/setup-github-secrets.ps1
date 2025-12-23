# GitHub Secrets 配置脚本
# 用于自动设置部署所需的所有 GitHub Secrets

# ==========================================
# 配置参数 (请填入 GitHub Personal Access Token)
# ==========================================
$GITHUB_TOKEN = "YOUR_GITHUB_PAT_HERE"  # 需要 repo 权限
$REPO_OWNER = "leecyang"
$REPO_NAME = "fucklib"

# ==========================================
# Secrets 配置
# ==========================================
$secrets = @{
    "VERCEL_TOKEN" = "AB3c3x6B3XZ1YIxG9Z7J5Lr4"
    "VERCEL_ORG_ID" = "team_M1jX7zZdC3ZJGYhEpAnaIJuW"
    "VERCEL_PROJECT_ID" = "prj_Ka5VF6W67zzAOC7oweOmGXiM0ye8"
    "SUPABASE_ACCESS_TOKEN" = "sbp_77286d137a77161bfb07e58e0583eef285ee0db0"
    "SUPABASE_PROJECT_REF" = "vikmppovitscvjarhrqv"
    "SUPABASE_DB_PASSWORD" = "lcy@050426"
    "PRODUCTION_URL" = "https://fucklib.vercel.app"
    "VITE_API_URL" = "/api"
}

# ==========================================
# 函数: 获取仓库公钥
# ==========================================
function Get-RepoPublicKey {
    $headers = @{
        "Authorization" = "Bearer $GITHUB_TOKEN"
        "Accept" = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    
    $url = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/public-key"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    return $response
}

# ==========================================
# 函数: 加密 Secret 值 (使用 libsodium)
# ==========================================
function Encrypt-Secret {
    param(
        [string]$secretValue,
        [string]$publicKey
    )
    
    # 使用 Python 进行加密 (需要 pynacl 库)
    $pythonScript = @"
import base64
from nacl import encoding, public

def encrypt(public_key: str, secret_value: str) -> str:
    public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

print(encrypt('$publicKey', '''$secretValue'''))
"@
    
    $result = python -c $pythonScript 2>$null
    return $result
}

# ==========================================
# 函数: 设置 Secret
# ==========================================
function Set-GitHubSecret {
    param(
        [string]$secretName,
        [string]$encryptedValue,
        [string]$keyId
    )
    
    $headers = @{
        "Authorization" = "Bearer $GITHUB_TOKEN"
        "Accept" = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    
    $body = @{
        "encrypted_value" = $encryptedValue
        "key_id" = $keyId
    } | ConvertTo-Json
    
    $url = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/secrets/$secretName"
    
    try {
        Invoke-RestMethod -Uri $url -Headers $headers -Method Put -Body $body -ContentType "application/json"
        Write-Host "✅ Set secret: $secretName" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to set secret: $secretName - $_" -ForegroundColor Red
    }
}

# ==========================================
# 主程序
# ==========================================
Write-Host "🔐 GitHub Secrets 配置脚本" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

if ($GITHUB_TOKEN -eq "YOUR_GITHUB_PAT_HERE") {
    Write-Host "❌ 请先设置 GITHUB_TOKEN!" -ForegroundColor Red
    Write-Host "获取方式: https://github.com/settings/tokens/new" -ForegroundColor Yellow
    Write-Host "需要的权限: repo (Full control of private repositories)" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📦 需要设置的 Secrets:" -ForegroundColor Yellow
foreach ($secret in $secrets.Keys) {
    Write-Host "  - $secret" -ForegroundColor Gray
}

Write-Host "`n🔑 获取仓库公钥..." -ForegroundColor Yellow
try {
    $publicKeyInfo = Get-RepoPublicKey
    Write-Host "✅ 公钥获取成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 获取公钥失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n📝 设置 Secrets..." -ForegroundColor Yellow
foreach ($secretName in $secrets.Keys) {
    $secretValue = $secrets[$secretName]
    
    # 加密
    $encryptedValue = Encrypt-Secret -secretValue $secretValue -publicKey $publicKeyInfo.key
    
    if ($encryptedValue) {
        Set-GitHubSecret -secretName $secretName -encryptedValue $encryptedValue -keyId $publicKeyInfo.key_id
    } else {
        Write-Host "⚠️ 加密失败，尝试直接设置: $secretName" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ 配置完成!" -ForegroundColor Green
