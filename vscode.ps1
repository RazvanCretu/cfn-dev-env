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
    Write-Host Downloading VSCode
    Invoke-WebRequest -Uri $VSCodeUrl -OutFile $Destination # Install VS Code silently
    Write-Host Download finished

    # Install VSCode
    Write-Host Installing VSCode
    Start-Process -FilePath $Destination -ArgumentList $UnattendedArgs -Wait -Passthru
    Write-Host Installation finished

    # Remove installer
    Write-Host Removing installation file
    Remove-Item $Destination
    Write-Host Installation file removed

    # Create Shortcut
    if ($CreateShortCut -eq $true) {
        Add-Shortcut -ShortcutName 'Visual Studio Code' -TargetPath 'C:\Program Files\Microsoft VS Code\Code.exe'
    }
}

function Add-Shortcut {
    param (
        [Parameter()]
        [ValidateNotNull()]
        [string[]]$ShortcutName,

        [parameter()]
        [ValidateNotNull()]
        [string]$TargetPath
    )

    Write-Host Creating Shortcut
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$Home\Desktop\$ShortcutName.lnk")
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.Save()
    Write-Host Shortcut created
}

# Call the function
Install-VSC-Windows