# NDP release — headline cleanup (branch `fix/headline-cleanup`, commit 77adb63)

Risk: HIGH per `Get-ChangeRisk.ps1` (api + worker code) — run only inside the approved window.
No schema change, no data change, no web change. ~30–35 min. PowerShell on BikoDC.

```powershell
cd C:\inetpub\wwwroot\nouvellesdupays\ops\release-headline-cleanup
$k = "kubectl --context tunnel-context -n nouvellesdupays"
```

## 1. Tunnel (reuse if already up)
```powershell
kubectl --context tunnel-context get nodes
```
If refused: `cd ..\release-africa-voices; .\Start-OkeTunnel.ps1; cd ..\release-headline-cleanup`, then retry. **Tell Claude "tunnel up"** — Claude checks each next step from its side.

## 2. Tests (isolated pod)
```powershell
kubectl --context tunnel-context apply -f .\ci-test-pod.yaml
kubectl --context tunnel-context -n ndp-ci wait pod/ndp-api-tests --for=jsonpath='{.status.phase}'=Succeeded --timeout=1200s
kubectl --context tunnel-context -n ndp-ci logs ndp-api-tests -c tests --tail=15
kubectl --context tunnel-context delete namespace ndp-ci
```
✅ first line `77adb63 Clean article headlines…`, then `# tests 97`, `# fail 0`.

## 3. Rollback targets (current images)
```powershell
iex "$k get pods -l app=nouvellesdupays-api -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'" | Tee-Object old-api-image.txt
iex "$k get pods --sort-by=.metadata.creationTimestamp --no-headers -o custom-columns=NAME:.metadata.name,IMAGE:.status.containerStatuses[0].imageID" | Select-String "nouvellesdupays-worker-" | Select-Object -Last 1 | ForEach-Object { ($_.Line -split '\s+')[1] } | Tee-Object old-worker-image.txt
```
✅ both files contain `...@sha256:...`. (No DB change in this release, so no DB backup step; the nightly 03:00 backup exists.)

## 4. Merge
```powershell
cd C:\inetpub\wwwroot\nouvellesdupays
git checkout main; git pull --ff-only
git log --oneline origin/main..origin/fix/headline-cleanup     # must list exactly 2 commits: 77adb63 + the runbook commit
git merge --ff-only origin/fix/headline-cleanup; git push origin main
cd ops\release-headline-cleanup
```

## 5. Build api + worker, roll out api
```powershell
iex "$k delete job kaniko-build-nouvellesdupays-api kaniko-build-nouvellesdupays-worker --ignore-not-found"
kubectl --context tunnel-context apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml -f ..\..\infra\k8s\ci\kaniko-build-worker.yaml
iex "$k wait --for=condition=complete job/kaniko-build-nouvellesdupays-api job/kaniko-build-nouvellesdupays-worker --timeout=1200s"
iex "$k rollout restart deployment/nouvellesdupays-api"
iex "$k rollout status deployment/nouvellesdupays-api --timeout=300s"
```
The worker CronJob pulls `:latest` on its next 5-minute run — nothing to restart.

## 6. Verify
```powershell
cd ..\scripts; .\Test-Build.ps1; cd ..\release-headline-cleanup
```
Then tell Claude "deployed" — it checks Ghana/France headlines via the API and the next worker run's log.

---
## ROLLBACK
```powershell
$apiC = iex "$k get deploy nouvellesdupays-api -o jsonpath='{.spec.template.spec.containers[0].name}'"
iex "$k set image deployment/nouvellesdupays-api $apiC=$(Get-Content .\old-api-image.txt)"
iex "$k set image cronjob/nouvellesdupays-worker worker=$(Get-Content .\old-worker-image.txt)"
```
Then `git revert` the merge on main (Claude can do this). Articles ingested meanwhile keep their cleaned headlines — harmless.
