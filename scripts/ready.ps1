#Requires -Version 5.1
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_node.ps1")
Invoke-NodeScript -Script "workshop.mjs" -ScriptArgs @("ready")
