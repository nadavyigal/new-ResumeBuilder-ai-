# Kill Next.js dev servers
$ports = @(3000, 3001, 3002, 3003)

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $pid = $conn.OwningProcess
        Write-Host "Killing process $pid on port $port"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "All dev servers stopped"
