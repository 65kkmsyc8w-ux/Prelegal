# Not "Stop": removing a container that is not running is a success for this
# script, and under $PSNativeCommandUseErrorActionPreference (PowerShell 7.4+)
# a non-zero exit from docker would otherwise terminate it.
$ErrorActionPreference = "Continue"

docker rm -f prelegal 2>$null | Out-Null

Write-Host "Prelegal stopped"
