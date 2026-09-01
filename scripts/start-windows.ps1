$ErrorActionPreference = "Stop"

$image = "prelegal"
$container = "prelegal"
$port = 4000
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
    docker build -t $image .
    docker rm -f $container 2>$null | Out-Null

    # No volume. The database is built inside the container, so removing and
    # recreating it here is what gives every start a database from scratch.
    docker run -d --name $container -p "${port}:8000" $image | Out-Null

    # docker run -d exits once the container is created, which says nothing
    # about whether it stayed up.
    $started = $false
    foreach ($attempt in 1..30) {
        try {
            Invoke-WebRequest -Uri "http://localhost:$port/api/health" `
                -UseBasicParsing -TimeoutSec 2 | Out-Null
            $started = $true
            break
        }
        catch {
            if (-not (docker ps -q -f "name=$container")) { break }
            Start-Sleep -Seconds 1
        }
    }

    if (-not $started) {
        Write-Host "Prelegal failed to start. Last log lines:"
        docker logs --tail 20 $container
        exit 1
    }

    Write-Host "Prelegal running at http://localhost:$port"
}
finally {
    Pop-Location
}
