$ErrorActionPreference = 'Stop'

function Install-Mesh {
    $repo = 'Dielldev/genpact-ag-hack'
    $base = if ($env:MESH_RELEASE_URL) { $env:MESH_RELEASE_URL } else { "https://github.com/$repo/releases/latest/download" }
    $root = if ($env:MESH_HOME) { $env:MESH_HOME } else { $HOME }
    $bin = Join-Path $root '.mesh\bin'

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host 'Mesh needs Node.js 20 or newer. Install it with: winget install OpenJS.NodeJS.LTS' -ForegroundColor Yellow
        return
    }
    $major = [int](& node -p "process.versions.node.split('.')[0]")
    if ($major -lt 20) {
        Write-Host "Mesh needs Node.js 20 or newer, found $major. Update it with: winget upgrade OpenJS.NodeJS.LTS" -ForegroundColor Yellow
        return
    }

    Write-Host 'Downloading Mesh...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    New-Item -ItemType Directory -Force $bin | Out-Null
    foreach ($file in 'cli.mjs', 'hook.mjs', 'SHA256SUMS') {
        Invoke-WebRequest -UseBasicParsing -Uri "$base/$file" -OutFile (Join-Path $bin $file)
    }

    foreach ($line in Get-Content (Join-Path $bin 'SHA256SUMS')) {
        $parts = $line.Trim() -split '\s+'
        if ($parts.Count -lt 2) { continue }
        $name = $parts[1].TrimStart('*')
        $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $bin $name)).Hash
        if ($actual -ne $parts[0].ToUpper()) {
            Remove-Item -Recurse -Force $bin
            throw "Checksum mismatch for $name. Nothing was installed."
        }
    }

    $initArgs = @('init')
    if ($env:MESH_SERVER) { $initArgs += @('--server', $env:MESH_SERVER) }
    if ($env:MESH_WORKSPACE) { $initArgs += @('--workspace', $env:MESH_WORKSPACE) }
    if ($env:MESH_CLIENTS) { $initArgs += @('--clients', $env:MESH_CLIENTS) }

    & node (Join-Path $bin 'cli.mjs') @initArgs
    if ($LASTEXITCODE -eq 0) {
        Write-Host ''
        Write-Host "Done. Check it any time with: node `"$bin\cli.mjs`" status" -ForegroundColor Green
    }
}

Install-Mesh
