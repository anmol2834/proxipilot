# Stops any previous ProxiPilot backend still holding port 8000, so a fresh start actually
# receives the requests. Needed on Windows: when a `uvicorn --reload` window is closed, its
# worker process can survive as an orphan that keeps a copy of the :8000 socket and silently
# accepts (but never answers) connections - every API call then hangs (e.g. Google sign-in).
$ErrorActionPreference = 'SilentlyContinue'
$port = 8000
$targets = @{}

# 1) Previous backend reloaders started for this port, plus their worker children.
Get-CimInstance Win32_Process -Filter "name like 'python%'" |
  Where-Object { $_.CommandLine -match 'uvicorn\s+app\.main:app' -and $_.CommandLine -match "--port\s+$port" } |
  ForEach-Object {
    $targets[$_.ProcessId] = 'previous backend'
    $parentId = $_.ProcessId
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$parentId" | ForEach-Object { $targets[$_.ProcessId] = 'previous backend worker' }
  }

# 2) Orphaned workers: the socket owner (their dead parent) no longer exists, but a
#    multiprocessing child spawned by it (cmdline "parent_pid=<owner>") still does.
$owners = Get-NetTCPConnection -LocalPort $port | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($owner in $owners) {
  if (-not (Get-Process -Id $owner)) {
    Get-CimInstance Win32_Process -Filter "name like 'python%'" |
      Where-Object { $_.CommandLine -match "parent_pid=$owner\b" } |
      ForEach-Object { $targets[$_.ProcessId] = 'orphaned backend worker' }
  }
}

foreach ($id in $targets.Keys) {
  Write-Host ("Stopping {0} (PID {1})" -f $targets[$id], $id)
  Stop-Process -Id $id -Force
}
if ($targets.Count -eq 0) { Write-Host "Port $port is free of stale backends." }
