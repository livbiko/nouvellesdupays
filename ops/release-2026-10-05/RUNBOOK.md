# NDP release — Meta tracking fixes (branch `fix/meta-tracking-audit`, commit 1e77875)

Risk: MEDIUM (approved). Changes `apps/api` + `apps/web` only. No DB migration.
Run everything in **PowerShell on BikoDC**. Total time ~30–40 min.

```powershell
cd C:\inetpub\wwwroot\nouvellesdupays\ops\release-2026-10-05
$k = "kubectl --context tunnel-context -n nouvellesdupays"   # used as: iex "$k get pods"
```

## Step 1 — Open the cluster tunnel
```powershell
.\Start-OkeTunnel.ps1
kubectl --context tunnel-context get nodes        # must list nodes
```
✅ Nodes listed. ❌ "actively refused" → the SSH window closed; wait 30 s, re-run the `Start-Process ssh ...` line from the script.

## Step 2 — Run the test suite (isolated pod, own Postgres)
```powershell
kubectl --context tunnel-context apply -f .\ci-test-pod.yaml
kubectl --context tunnel-context -n ndp-ci wait pod/ndp-api-tests --for=jsonpath='{.status.phase}'=Succeeded --timeout=1200s
kubectl --context tunnel-context -n ndp-ci logs ndp-api-tests -c tests
```
(If the tests fail, the `wait` just runs until it times out. Check sooner with `kubectl --context tunnel-context -n ndp-ci get pod`; `Error` means it has finished, so go straight to `logs`.)
✅ Last line `TESTS EXIT CODE: 0` and `# fail 0`. ❌ Anything else → **stop**, paste me the log.
Clean up (always):
```powershell
kubectl --context tunnel-context delete namespace ndp-ci
```

## Step 3 — Recovery point + record current images (rollback targets)
```powershell
cd ..\scripts; .\New-RecoveryPoint.ps1 -Description "Before: Meta tracking fixes 1e77875"; cd ..\release-2026-10-05
iex "$k get pods -l app=nouvellesdupays-api -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'" | Tee-Object old-api-image.txt
iex "$k get pods -l app=nouvellesdupays-web -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'" | Tee-Object old-web-image.txt
```
✅ Both files contain `lhr.ocir.io/...@sha256:...`. If they're empty, run `iex "$k get pods --show-labels"` and send me the output.
⚠ Today the recovery script hung at `[4/5] Triggering on-demand off-cluster Postgres backup`. If it sits there > 5 min, press Ctrl+C. The release doesn't touch the DB, and last night's 03:00 backup + the image IDs above are enough to roll back.

## Step 4 — Merge to main
```powershell
cd C:\inetpub\wwwroot\nouvellesdupays
git checkout main; git pull --ff-only
git merge --ff-only fix/meta-tracking-audit
git push origin main
cd ops\release-2026-10-05
```
✅ Push succeeds. ❌ "Not possible to fast-forward" → stop, tell me.

## Step 5 — Build images (Kaniko, builds from GitHub main)
```powershell
iex "$k delete job kaniko-build-nouvellesdupays-api kaniko-build-nouvellesdupays-web --ignore-not-found"
kubectl --context tunnel-context apply -f ..\..\infra\k8s\ci\kaniko-build-api.yaml -f ..\..\infra\k8s\ci\kaniko-build-web.yaml
iex "$k wait --for=condition=complete job/kaniko-build-nouvellesdupays-api job/kaniko-build-nouvellesdupays-web --timeout=1200s"
```
✅ Both `condition met`. ❌ Timeout/failure → `iex "$k logs job/kaniko-build-nouvellesdupays-web --tail=60"` and send me the log. Nothing is live yet at this point, so it's safe to stop.

## Step 6 — Deploy
```powershell
iex "$k rollout restart deployment/nouvellesdupays-api deployment/nouvellesdupays-web"
iex "$k rollout status deployment/nouvellesdupays-api --timeout=300s"
iex "$k rollout status deployment/nouvellesdupays-web --timeout=300s"
iex "$k get pods"
```
✅ Both "successfully rolled out", api/web pods `1/1 Running`, 0 restarts.

## Step 7 — Verify (Phase 3)
```powershell
cd ..\scripts; .\Test-Build.ps1; cd ..\release-2026-10-05
curl.exe -s https://nouvellesdupays.com/api/tracking/config
```
✅ Test-Build all pass; config JSON contains `"meta_test_mode":false`.

Browser checks (Chrome, **Incognito**, DevTools → Network, filter `facebook`):
1. Open `https://nouvellesdupays.com/?ndp_debug=1` → **0** facebook requests before you click anything.
2. Click **Tout accepter** → still **0** `facebook.com/tr` requests (test traffic is now kept out of Meta). The Console shows `[ndp-track] ... Pixel suppressed: debug traffic`.
3. Close Incognito, open a new one, go to `https://nouvellesdupays.com/` (no `ndp_debug`), click **Tout accepter** → `facebook.com/tr?...ev=PageView` appears. Click it: the query has `eid=` and `ud[external_id]=` (64 hex chars). (This counts as one real visit; that's fine.)
4. Click a country on the globe → a `ev=ViewContent` request with `cd[country]=`.
5. Regression: the globe spins and opens countries, the video rail plays, `/contact` loads, and the Console shows no red errors.

✅ All OK → mark it known good:
```powershell
cd ..\scripts; .\Set-KnownGood.ps1 -BuildNote "Meta tracking fixes 1e77875: debug kept out of Meta, Pixel params=CAPI, external_id"
```

## Step 8 — Close the tunnel
```powershell
cd ..\release-2026-10-05; .\Stop-OkeTunnel.ps1
```
Then tell me the results. I'll write the MAINTENANCE_LOG entry and commit it.

---
## ROLLBACK (if Step 6 or 7 fails)
```powershell
$api = Get-Content .\old-api-image.txt; $web = Get-Content .\old-web-image.txt
$apiC = iex "$k get deploy nouvellesdupays-api -o jsonpath='{.spec.template.spec.containers[0].name}'"
$webC = iex "$k get deploy nouvellesdupays-web -o jsonpath='{.spec.template.spec.containers[0].name}'"
iex "$k set image deployment/nouvellesdupays-api $apiC=$api"
iex "$k set image deployment/nouvellesdupays-web $webC=$web"
iex "$k rollout status deployment/nouvellesdupays-api --timeout=300s"; iex "$k rollout status deployment/nouvellesdupays-web --timeout=300s"
cd ..\scripts; .\Test-Build.ps1
```
After a rollback, also revert main so the next nightly/other build doesn't redeploy the change: `git revert 1e77875; git push origin main` (I can do this part).
