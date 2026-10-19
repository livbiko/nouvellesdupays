# Runs one SQL file detached in postgres-0 and prints the result:  .\Sql.ps1 look.sql
# -Watch (batched apply/reverse/rehearse): psql runs as application_name=ndp-backfill, every poll prints progress
# and lock waiters, and watch.sh cancels the run if any session waits on a lock for over 30s.
param([Parameter(Mandatory)][string]$File, [switch]$Watch)
$ErrorActionPreference = "Continue"; Set-Location $PSScriptRoot
$ctx = @('--context', 'tunnel-context', '-n', 'nouvellesdupays')
# Retries tunnel blips on idempotent calls. exec is retried too (cat/wc/rm/watch.sh are safe to repeat),
# except the nohup call that starts psql: repeating that could run the SQL twice.
function K {
  $retryable = (@('cp', 'get', 'wait', 'logs', 'apply', 'delete') -contains $args[0]) -or
               ($args[0] -eq 'exec' -and ($args -join ' ') -notmatch 'nohup')
  for ($try = 1; ; $try++) {
    $out = & kubectl @ctx --request-timeout=90s @args 2>&1 | Where-Object { $_ -notmatch 'OCI_API_KEY|apisigningkey|increase security|removing leading' }
    if ($LASTEXITCODE -eq 0) { return $out }
    $transient = "$out" -match 'context deadline exceeded|connection refused|actively refused|EOF|TLS handshake timeout|i/o timeout|Timeout'
    # 2026-10-19: Bastion drops lasted longer than 3 x 10 s several times (kubectl cp timed out, releases stopped
    # before applying). Up to 5 retries with backoff ride out ~2.5 min.
    $waits = @(10, 20, 30, 45, 60)
    if (-not ($retryable -and $transient -and $try -le $waits.Count)) { throw "kubectl $($args -join ' ') failed:`n$($out -join "`n")" }
    Write-Host "  (kubectl $($args[0]) - tunnel blip, retry $try/$($waits.Count) in $($waits[$try - 1])s)" -ForegroundColor Yellow
    Start-Sleep $waits[$try - 1]
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
    # psql keeps running in the pod whatever happens here, so a poll that fails even after K's retries
    # is skipped, not fatal.
    try {
      if ($Watch) {
        $err = K exec postgres-0 '--' sh /tmp/watch.sh $tag
        Write-Host "  $(Get-Date -Format HH:mm:ss) $($err | Where-Object { $_ -match '^(progress|WATCHDOG)' })"
      } else { $err = K exec postgres-0 '--' cat "/tmp/$tag.err" }
    } catch { Write-Host "  (poll failed: $($_.Exception.Message.Split("`n")[0]) - trying again)" -ForegroundColor Yellow; continue }
    if ($err -match '__END__') {
      $res = @(K exec postgres-0 '--' cat "/tmp/$tag.out") + @($err | Where-Object { $_ -ne '__END__' -and $_ -notmatch '^progress\|' })
      # 2026-10-16 release 4: the tunnel dropped on this cleanup and the exception threw away psql's
      # output after the transaction had committed. Cleanup is best effort; the output always comes back.
      try { K exec postgres-0 '--' rm -f "/tmp/$tag.sql" "/tmp/$tag.out" "/tmp/$tag.err" | Out-Null }
      catch { Write-Host "  (cleanup failed - remove /tmp/$tag.* in postgres-0 by hand)" -ForegroundColor Yellow }
      return $res
    }
  }
  throw "$file did not finish within the polling window (still running in the pod as /tmp/$tag.sql, application_name=$app)"
}
RunSql $File
