#Requires -Version 5.1
# Dot-source from the other scripts. Finds Node on Windows and on pwsh.
# Record this file's directory at dot-source time. Windows PowerShell 5.1
# does not keep $PSScriptRoot for this file once the function is running.
$NodeScriptDir = $PSScriptRoot

function Invoke-NodeScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Script,
        [string[]]$ScriptArgs
    )
    $runner = Join-Path $NodeScriptDir $Script
    if ($null -eq $ScriptArgs) {
        $ScriptArgs = @()
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js 20 or newer is required. Install it from https://nodejs.org/ and leave Add to PATH enabled."
        exit 1
    }
    & node $runner @ScriptArgs
    if ($null -ne $LASTEXITCODE) {
        exit $LASTEXITCODE
    }
    exit 0
}
