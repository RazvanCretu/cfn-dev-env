function Add-Shortcut {
    param (
        [Parameter()]
        [ValidateNotNull()]
        [string[]]$ShortcutName,

        [parameter()]
        [ValidateNotNull()]
        [string]$TargetPath
    )

    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$Home\Desktop\$ShortcutName.lnk")
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.Save()
}

function Install-VSC-Windows {
    param (
        [Parameter()]
        [ValidateSet('local', 'global')]
        [string[]]$Scope = 'global',

        [parameter()]
        [ValidateSet($true, $false)]
        [string]$CreateShortCut = $true
    )

    # Windows Version x64
    # Define the download URL and the destination
    $Destination = "$env:TEMP\vscode_installer.exe"
    $VSCodeUrl = "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64"

    # User Installation
    if ($Scope -eq 'local') {
        $VSCodeUrl = $VSCodeUrl + '-user'
    }

    $UnattendedArgs = '/verysilent /mergetasks=!runcode'

    # Download VSCode installer
    Invoke-WebRequest -Uri $VSCodeUrl -OutFile $Destination # Install VS Code silently

    # Install VSCode
    Start-Process -FilePath $Destination -ArgumentList $UnattendedArgs -Wait

    # Remove installer
    Remove-Item $Destination

    # Create Shortcut
    if ($CreateShortCut -eq $true) {
        if ($Scope -eq 'global') {
            Add-Shortcut -ShortcutName 'VS Code' -TargetPath "$env:ProgramFiles\Microsoft VS Code\Code.exe"
        }
        else {
            Add-Shortcut -ShortcutName 'VS Code' -TargetPath "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
        }
    }
}

if (!(Test-Path -Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force
}

Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072;

### VSCode

Install-VSC-Windows

### MetaTrader5

Invoke-WebRequest -Uri "https://download.mql5.com/cdn/web/metaquotes.ltd/mt5/mt5setup.exe?utm_source=www.metatrader5.com&utm_campaign=download" -OutFile "$env:USERPROFILE\Downloads\mt5.exe"
Start-Process -FilePath "$env:USERPROFILE\Downloads\mt5.exe" -ArgumentList '/auto /path:"C:\Program Files\MetaTrader5"' -Wait
Remove-Item "$env:USERPROFILE\Downloads\mt5.exe"

### Miniconda3

Invoke-WebRequest -Uri "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe" -OutFile "$env:USERPROFILE\Downloads\miniconda3.exe"
Start-Process -FilePath "$env:USERPROFILE\Downloads\miniconda3.exe" -ArgumentList '/S /InstallationType=JustMe /AddToPath=1 /RegisterPython=1 /D=$env:USERPROFILE\miniconda3' -Wait
Remove-Item "$env:USERPROFILE\Downloads\miniconda3.exe"
Invoke-Expression "$env:USERPROFILE\miniconda3\condabin\conda init"

### GIT

Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe" -OutFile "$env:USERPROFILE\Downloads\git.exe"
Start-Process -FilePath "$env:USERPROFILE\Downloads\git.exe" -ArgumentList '/SP- /VERYSILENT /SUPPRESSMSGBOXES /FORCECLOSEAPPLICATIONS /NORESTART /NOCANCEL /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext,ext\reg,ext\shellhere,ext\guihere,gitlfs,assoc,assoc_sh,autoupdate" /LOG="C:\git-for-windows.log"' -Wait 
Remove-Item "$env:USERPROFILE\Downloads\git.exe"

[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'Machine'));C:\Program Files\Git\bin", 'Machine')
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\Program Files\Git\bin", 'User')
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\Program Files\Git\cmd", 'User')

### Rclone 

mkdir c:\rclone
Set-Location c:\rclone
Invoke-WebRequest -Uri "https://downloads.rclone.org/v1.67.0/rclone-v1.67.0-windows-amd64.zip" -OutFile "c:\rclone\rclone.zip"
Expand-Archive -path 'c:\rclone\rclone.zip' -destinationpath '.\'
cp C:\rclone\rclone-v1.67.0-windows-amd64\*.* C:\rclone\

[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path', 'User'));C:\rclone", 'User')

### Choco

Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

### Winfsp

choco install winfsp -y

### Reload Profile
Add-Content -Path $PROFILE.CurrentUserAllHosts -Value '$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")'

. $PROFILE.CurrentUserAllHosts
Write-Host The following software was installed:
Write-Host (conda --version)
Write-Host (python --version)
Write-Host (pip --version)
Write-Host (git --version)
Write-Host (rclone --version)

if (!(Test-Path -Path $env:USERPROFILE\.projects)) {
    New-Item -ItemType Directory -Path $env:USERPROFILE\.projects -Force
}

Set-Location $env:USERPROFILE\.projects

git clone https://github.com/RazvanCretu/trader-bot.git

Set-Location $env:USERPROFILE\.projects\trader-bot

git config --global user.name "RazvanCretu"
git config --global user.email "razvan.cretu97@gmail.com"

python -m venv env

Invoke-Expression ".\env\Scripts\activate.ps1"

pip install -r requirements.txt

python src\main.py

rclone config create general s3 provider=AWS env_auth=true region=eu-central-1 location_contraint=EU server_side_encryption=AES256 storage_class=STANDARD

Start-Process powershell "rclone mount general:general-cr3tu/ S: --vfs-cache-mode full --log-file='C:\rclone.log' -v --no-console"

Write-Output 'start powershell "rclone mount general:general-cr3tu/ S: --vfs-cache-mode full --log-file=C:\rclone.log -v --no-console"' >> "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\mount-s3.cmd"