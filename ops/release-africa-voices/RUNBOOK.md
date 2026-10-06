# NDP release — Africa Voices + data cleanup (branch `feat/africa-voices-data-cleanup`)

Risk: **HIGH** (schema migration 014 + bulk data changes) → run ONLY inside the approved maintenance window.
PowerShell on BikoDC, one window, ~60–75 min. Review package: `docs/media-discovery/phase1-review/`.

```powershell
cd C:\inetpub\wwwroot\nouvellesdupays\ops\release-africa-voices
$k = "kubectl --context tunnel-context -n nouvellesdupays"
```

## 1. Tunnel
```powershell
.\Start-OkeTunnel.ps1
kubectl --context tunnel-context get nodes
```
✅ nodes listed. (Session lasts 3 h. If "actively refused" later: `$id = Get-Content .\.bastion-session-id` then re-run the `Start-Process ssh ...` line.)

## 2. Tests (isolated pod)
```powershell
kubectl --context tunnel-context apply -f .\ci-test-pod.yaml
kubectl --context tunnel-context -n ndp-ci wait pod/ndp-api-tests --for=jsonpath='{.status.phase}'=Succeeded --timeout=1200s
kubectl --context tunnel-context -n ndp-ci logs ndp-api-tests -c tests --tail=15
kubectl --context tunnel-context delete namespace ndp-ci
```
✅ `# tests 99`, `# fail 0`, `TESTS EXIT CODE: 0` — otherwise STOP.

## 3. Backups (do not skip — HIGH risk)
**3a. Full DB backup** (the recovery script's 200 s wait is too short — use this instead):
```powershell
iex "$k create job ndp-backup-pre-africa-voices --from=cronjob/nouvellesdupays-db-backup"
iex "$k wait --for=condition=complete job/ndp-backup-pre-africa-voices --timeout=900s"
```
✅ `condition met`. Tell Claude — it verifies the new object in the `nouvellesdupays-db-backups` bucket.

**3b. Table backups for the targeted rollback** (small CSVs, kept in the pod AND copied here):
```powershell
kubectl --context tunnel-context -n nouvellesdupays exec postgres-0 -- mkdir -p /tmp/ndp-backup
kubectl --context tunnel-context cp .\backup_tables.sql nouvellesdupays/postgres-0:/tmp/ndp-backup/backup_tables.sql
kubectl --context tunnel-context -n nouvellesdupays exec postgres-0 -- sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/ndp-backup/backup_tables.sql'
kubectl --context tunnel-context cp nouvellesdupays/postgres-0:/tmp/ndp-backup/video_channels.csv .\video_channels.csv
kubectl --context tunnel-context cp nouvellesdupays/postgres-0:/tmp/ndp-backup/publishers_cols.csv .\publishers_cols.csv
```
✅ the psql step prints the two row counts (about 1,000+ video channels, 563 publishers) and both CSVs now exist in this folder.

**3c. Current images (image rollback targets)**
```powershell
iex "$k get pods -l app=nouvellesdupays-api -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'" | Tee-Object old-api-image.txt
iex "$k get pods -l app=nouvellesdupays-web -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'" | Tee-Object old-web-image.txt
```

## 4. Merge
```powershell
cd C:\inetpub\wwwroot\nouvellesdupays
git checkout main; git pull --ff-only
git log --oneline origin/main..feat/africa-voices-data-cleanup     # must list ONLY this release's commits
git merge --ff-only feat/africa-voices-data-cleanup; git push origin main
cd ops\release-africa-voices
```

## 5. Build api → migrate → data
```powershell
iex "$k delete job kaniko-build-nouvellesdupays-api --ignore-not-found"
kubectl --context tunnel-context apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml
iex "$k wait --for=condition=complete job/kaniko-build-nouvellesdupays-api --timeout=1200s"

iex "$k delete job nouvellesdupays-migrate --ignore-not-found"
kubectl --context tunnel-context apply -f ..\..\infra\k8s\04-migrate-job.yaml
iex "$k wait --for=condition=complete job/nouvellesdupays-migrate --timeout=600s"
iex "$k logs job/nouvellesdupays-migrate" | Select-String "014|Migrations complete|Seed complete"
```
✅ shows `Applying 014_africa_voices.sql...`, `Migrations complete.`, `Seed complete.` (Old api pods keep working against the new schema — 014 only relaxes constraints.)

```powershell
kubectl --context tunnel-context cp ..\..\docs\media-discovery\phase1-review\apply_data_cleanup.sql nouvellesdupays/postgres-0:/tmp/ndp-backup/apply_data_cleanup.sql
kubectl --context tunnel-context -n nouvellesdupays exec postgres-0 -- sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -q -f /tmp/ndp-backup/apply_data_cleanup.sql'
```
✅ no `ERROR` lines (it is one transaction: on any error **nothing** is applied — STOP and send Claude the output; the site is unaffected).

## 6. Build web → roll out
```powershell
iex "$k delete job kaniko-build-nouvellesdupays-web --ignore-not-found"
kubectl --context tunnel-context apply -f ..\..\infra\k8s\ci\kaniko-build-web.yaml
iex "$k wait --for=condition=complete job/kaniko-build-nouvellesdupays-web --timeout=1200s"
iex "$k rollout restart deployment/nouvellesdupays-api deployment/nouvellesdupays-web"
iex "$k rollout status deployment/nouvellesdupays-api --timeout=300s"
iex "$k rollout status deployment/nouvellesdupays-web --timeout=300s"
```

## 7. Verify
```powershell
cd ..\scripts; .\Test-Build.ps1; cd ..\release-africa-voices
```
Then tell Claude "deployed" — it checks the API (Africa Voices = 7 for CI/NG, empty for FR, CI Voices without the pan-African 7, TZ shows TBC, etc.). Browser (Incognito): click **Côte d'Ivoire** → Voices box shows tabs **Côte d'Ivoire Voices / Africa Voices**, both play; click **Nigeria** → opens on Africa Voices, country tab greyed; click **France** → "France Voices", no tabs. Globe still renders.

## 8. Close tunnel
```powershell
.\Stop-OkeTunnel.ps1
```

---
## ROLLBACK
**Data** (restores video_channels + touched publisher columns exactly — tested):
```powershell
kubectl --context tunnel-context cp .\rollback_data.sql nouvellesdupays/postgres-0:/tmp/ndp-backup/rollback_data.sql
kubectl --context tunnel-context -n nouvellesdupays exec postgres-0 -- sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -q -f /tmp/ndp-backup/rollback_data.sql'
```
(If the pod restarted and /tmp was lost: `kubectl cp` the local `video_channels.csv` / `publishers_cols.csv` from step 3b back to `/tmp/ndp-backup/` first.)

**Images**:
```powershell
$apiC = iex "$k get deploy nouvellesdupays-api -o jsonpath='{.spec.template.spec.containers[0].name}'"
$webC = iex "$k get deploy nouvellesdupays-web -o jsonpath='{.spec.template.spec.containers[0].name}'"
iex "$k set image deployment/nouvellesdupays-api $apiC=$(Get-Content .\old-api-image.txt)"
iex "$k set image deployment/nouvellesdupays-web $webC=$(Get-Content .\old-web-image.txt)"
```
Schema 014 stays (harmless to old code). Then `git revert` the merge on main (Claude can do this).
