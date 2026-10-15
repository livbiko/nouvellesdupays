# Runs one SQL file detached in postgres-0 and prints the result:  .\Sql.ps1 look.sql
# -Watch (batched apply/reverse/rehearse): psql runs as application_name=ndp-backfill, every poll prints progress
# and lock waiters, and watch.sh cancels the run if any session waits on a lock for over 30s.
param([Parameter(Mandatory)][string]$File, [switch]$Watch)
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
function K {
  $retryable = @('cp', 'get', 'wait', 'logs', 'apply', 'delete') -contains $args[0]
  for ($try = 1; ; $try++) {
    $out = & kubectl @ctx --request-timeout=90s @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security|removing leading' }
    if ($LASTEXITCODE -eq 0) { return $out }
    $transient = "$out" -match 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout|Timeout'
    if (-not ($retryable -and $transient -and $try -lt 4)) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }
    Write-Host "  (kubectl $($args[0]) - tunnel blip, retry $try/3 in 10s)" -ForegroundColor Yellow
    Start-Sleep 10
  }
}
function RunSql($file) {
  $tag = [IO.Path]::GetFileNameWithoutExtension($file) + '-' + (Get-Date -Format 'HHmmss')
  K cp $file "postgres-0:/tmp/$tag.sql" | Out-Null
  $local = (Get-Item $file).Length
  $remote = (K exec postgres-0 '--' sh -c "wc -c < /tmp/$tag.sql") -as [int]
  if ($remote -ne $local) { throw "copy of $file is $remote bytes, expected $local" }
  $app = 'psql'
  if ($Watch) { K cp watch.sh postgres-0:/tmp/watch.sh | Out-Null; $app = 'ndp-backfill' }
  K exec postgres-0 '--' sh -c "nohup sh -c 'PGAPPNAME=$app psql -U `$POSTGRES_USER -d `$POSTGRES_DB -At -f /tmp/$tag.sql -o /tmp/$tag.out > /tmp/$tag.err 2>&1; echo __END__ >> /tmp/$tag.err' > /dev/null 2>&1 &" | Out-Null
  Write-Host "  running /tmp/$tag.sql in postgres-0"
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep 5
    if ($Watch) {
      $err = K exec postgres-0 '--' sh /tmp/watch.sh $tag
      Write-Host "  $(Get-Date -Format HH:mm:ss) $($err | Where-Object { $_ -match '^(progress|WATCHDOG)' })"
    } else { $err = K exec postgres-0 '--' cat "/tmp/$tag.err" }
    if ($err -match '__END__') {
      $res = @(K exec postgres-0 '--' cat "/tmp/$tag.out") + @($err | Where-Object { $_ -ne '__END__' -and $_ -notmatch '^progress\|' })
      K exec postgres-0 '--' rm -f "/tmp/$tag.sql" "/tmp/$tag.out" "/tmp/$tag.err" | Out-Null
      return $res
    }
  }
  throw "$file did not finish within the polling window (still running in the pod as /tmp/$tag.sql, application_name=$app)"
}
RunSql $File
