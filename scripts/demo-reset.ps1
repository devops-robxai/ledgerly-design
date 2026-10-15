#Requires -Version 5.1
# Restore the planted baseline. Removes .cursor/mcp.json in the repo root only.
# Does not touch the global ~/.cursor/mcp.json. Does not change RUNBOOK.md.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_node.ps1")
Invoke-NodeScript -Script "workshop.mjs" -ScriptArgs @("demo-reset")
