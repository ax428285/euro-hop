# 發佈新版給朋友玩：把 main 推到 GitHub 的 live 分支，Netlify 會自動做「分支部署」。
#
# 為什麼不用 netlify deploy --prod：
#   Netlify 免費方案每個月 300 credits，正式部署（production deploy）每次扣 15，
#   一個月改 20 次就用光了。分支部署（branch deploy）不扣 credits。
#
# 朋友玩的網址（固定不變）：https://live--effervescent-cucurucho-40f89f.netlify.app
# 舊的正式網址 https://effervescent-cucurucho-40f89f.netlify.app 會自動轉到上面那個（redirect 分支）。
#
# 用法：powershell -ExecutionPolicy Bypass -File tools/deploy.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# winget 剛裝好 git 時，舊的終端機還沒有新的 PATH
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

# 先在本機打包一次：打包壞了就不要推上去（Netlify 那邊會用同一支腳本再打包）
python tools/build-single.py
if ($LASTEXITCODE -ne 0) { throw '打包失敗' }

# 還有沒 commit 的改動就停下來：推上去的會是舊的 commit，朋友拿不到最新的
$dirty = git status --porcelain
if ($dirty) {
  Write-Host $dirty
  throw '還有沒 commit 的改動，先 commit 再發佈'
}

git push origin main
if ($LASTEXITCODE -ne 0) { throw '推送 main 失敗' }
git push origin main:live
if ($LASTEXITCODE -ne 0) { throw '推送 live 失敗' }

Write-Host ''
Write-Host '已推到 live 分支，Netlify 大約 30 秒～1 分鐘後部署完成：'
Write-Host 'https://live--effervescent-cucurucho-40f89f.netlify.app'
