$StopWatchAll = [System.Diagnostics.Stopwatch]::StartNew()

try {

    if (!(Test-Path -Path $PROFILE)) {
        New-Item -ItemType File -Path $PROFILE -Force
    }

    Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;
    
    $wc = New-Object net.WebClient # WebClient

    # ========== VSCode ==========

    # $wc.DownloadFile("https://code.visualstudio.com/sha/download?build=stable&os=win32-x64", "$HOME\Downloads\vscode.exe")
    # Start-Process -FilePath "$HOME\Downloads\vscode.exe" -ArgumentList '/verysilent /mergetasks=!runcode,desktopicon' -Wait
    # Remove-Item "$HOME\Downloads\vscode.exe"
    
    # ========== AWSCLI ==========

    $wc.DownloadFile("https://awscli.amazonaws.com/AWSCLIV2.msi", "$HOME\Downloads\AWSCLIV2.msi")
    Start-Process -FilePath "$HOME\Downloads\AWSCLIV2.msi" -ArgumentList '/quiet' -Wait
    Remove-Item "$HOME\Downloads\AWSCLIV2.msi"

    # ========== MetaTrader5 ==========

    $wc.DownloadFile("https://download.mql5.com/cdn/web/metaquotes.ltd/mt5/mt5setup.exe", "$HOME\Downloads\mt5.exe")
    Start-Process -FilePath "$HOME\Downloads\mt5.exe" -ArgumentList '/auto /path:"C:\Program Files\MetaTrader5"' -Wait
    Remove-Item "$HOME\Downloads\mt5.exe"

    # ========== Miniconda 3 ==========

    $wc.DownloadFile("https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe", "$HOME\Downloads\miniconda3.exe")
    Start-Process -FilePath "$HOME\Downloads\miniconda3.exe" -ArgumentList '/S /InstallationType=JustMe /AddToPath=1 /RegisterPython=1 /D=$HOME\miniconda3' -Wait
    Invoke-Expression "$HOME\miniconda3\condabin\conda init"
    Remove-Item "$HOME\Downloads\miniconda3.exe"

    # ========== Git ==========

    $wc.DownloadFile("https://github.com/git-for-windows/git/releases/download/v2.49.0.windows.1/Git-2.49.0-64-bit.exe", "$HOME\Downloads\git.exe")
    Start-Process -FilePath "$HOME\Downloads\git.exe" -ArgumentList '/SP- /VERYSILENT /SUPPRESSMSGBOXES /FORCECLOSEAPPLICATIONS /NORESTART /NOCANCEL /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext,ext\reg,ext\shellhere,ext\guihere,gitlfs,assoc,assoc_sh,autoupdate" /LOG="C:\git-for-windows.log"' -Wait 
    Remove-Item "$HOME\Downloads\git.exe"
    
    [Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'Machine'));C:\Program Files\Git\bin", 'Machine')
    [Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\Program Files\Git\bin", 'User')
    [Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\Program Files\Git\cmd", 'User')

    # ========== RClone ==========
    
    mkdir C:\rclone 

    $wc.DownloadFile("https://downloads.rclone.org/v1.69.1/rclone-v1.69.1-windows-amd64.zip", "C:\rclone\rclone.zip")
    Expand-Archive -path 'C:\rclone\rclone.zip' -destinationpath 'C:\rclone\'
    Copy-Item "C:\rclone\rclone-v1.69.1-windows-amd64\*.*" "C:\rclone\"

    [Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\rclone", 'User')

    # ========== Chocolatey ==========

    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

    # ========== WinFsp ==========

    choco install winfsp -y

    # ========== Reload Profile ==========

    Add-Content -Path $PROFILE -Value '$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")'

    . $PROFILE

    Write-Host The following software was installed:
    # Write-Host VSCode (code --version)
    Write-Host (conda --version)
    Write-Host (python --version)
    Write-Host (pip --version)
    Write-Host (git --version)
    Write-Host (rclone --version)
    Write-Host (aws --version)

    Start-Process PowerShell -Wait -WindowStyle Hidden -ArgumentList "-Command & {
        rclone config create general s3 provider=AWS env_auth=true region=eu-central-1 location_contraint=EU server_side_encryption=AES256 storage_class=STANDARD
        rclone mount general:general-cr3tu/ S: --vfs-cache-mode full --log-file='C:\rclone.log'
    }"

    if (!(Test-Path -Path $HOME\.projects)) {
        New-Item -ItemType Directory -Path $HOME\.projects -Force
    }
    
    Set-Location $HOME\.projects
    
    git clone "https://RazvanCretu:$env:GH_TOKEN@github.com/RazvanCretu/trader-bot.git"
    
    Set-Location $HOME\.projects\trader-bot
    
    git config --global user.name "RazvanCretu"
    git config --global user.email "razvan.cretu97@gmail.com"
    
    python -m venv env
    
    . ".\env\Scripts\activate.ps1"

    pip install -r requirements.txt

    Start-Process 'C:\Program Files\MetaTrader5\terminal64.exe' -WindowStyle Hidden -ArgumentList "/portable"

    Start-Sleep -Seconds 10

    $env:PYTHONBUFFERED = 1; python src\main.py

    Set-Location "C:\Windows\System32\config\systemprofile\AppData\Local\Temp"
    
    $current_date = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
    $logs = "S:\Trader Bot Logs\$current_date"
    
    New-Item -ItemType Directory -Path $logs
    
    Get-ChildItem . | Foreach-Object {
        if ($_.Attributes -match "Directory") {
            Copy-Item -Path "$($_.FullName)" -Destination $logs -Recurse
        }
    }

    [int]$ElapsedAll = $StopWatchAll.Elapsed.TotalSeconds

    "+++++ Script took $ElapsedAll seconds +++++"
}
catch {
    "Error: $($Error[0])"
}
finally {
    shutdown.exe /s
}
    
