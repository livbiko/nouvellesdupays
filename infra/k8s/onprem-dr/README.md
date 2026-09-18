# On-prem DR mirror (dr-rke2, 192.168.1.51)

A standby copy of nouvellesdupays.com running on a single-node RKE2 cluster
on-prem (same subnet as BikoDC, `192.168.1.0/24`), built 2026-08-25 to give
the site somewhere to fail over to if OCI/OKE goes down -- which it has,
more than once (see `project_onprem_dr_mirror_stack.md` and
`project_oci_mass_instance_outage_2026_09.md` in the ops memory system).

This directory exists because the stack itself was originally built via
direct SSH + `kubectl apply` sessions that never got committed anywhere --
the exact failure mode this README is meant to stop happening again.

**These manifests are not part of the OKE CI/CD pipeline** (no kaniko build,
no ArgoCD) -- they describe the on-prem cluster's own resources and are
applied by hand over SSH:
```
ssh -i ~/.ssh/dr-rke2 ubuntu@192.168.1.51
sudo KUBECONFIG=/etc/rancher/rke2/rke2.yaml /var/lib/rancher/rke2/bin/kubectl apply -f -   # paste manifest, or scp it first
```

## Files

- `dr-postgres-sync-cronjob.yaml` -- nightly job (04:00 UTC, an hour after
  OCI's own 03:00 UTC backup) that pulls the latest `nouvellesdupays-*.sql.gz`
  from the `nouvellesdupays-db-backups` OCI bucket via a read-only
  Pre-Authenticated Request (no OCI credentials needed on-prem, and it
  avoids the BikoFW-SRX<->OCI VPN entirely -- that tunnel is chronically
  flaky, see `project_srx_oci_vpn.md`) and restores it into `dr-postgres`
  (192.168.1.52). Since `pg_dump` output carries full schema DDL, this also
  keeps the mirror's schema current with every migration run on OCI --
  no separate migration step needed here.
- `dr-sync-script-configmap.yaml` -- the restore script itself, as a
  ConfigMap mounted into the CronJob.

- `dr-image-sync-cronjobs.yaml` -- three staggered nightly CronJobs (04:10,
  04:20, 04:40 UTC) that rebuild `nouvellesdupays-api`/`-web` from the same
  git `main` + Dockerfiles the OKE kaniko builds use, but push to dr-rke2's
  own in-cluster registry (`192.168.1.51:30500`, anonymous/insecure HTTP)
  instead of OCIR, then force both Deployments to roll onto the fresh image.
  Requires `imagePullPolicy: Always` on both Deployments (see below) --
  they were `IfNotPresent` when this was found, which would silently keep
  serving the old image forever since the tag (`:local`) never changes.

**One-time fix applied 2026-09-18, not captured in any committed manifest**
(the Deployments themselves predate this directory and aren't tracked in
git anywhere): `kubectl patch deployment nouvellesdupays-api
nouvellesdupays-web -n nouvellesdupays -p
'{"spec":{"template":{"spec":{"containers":[{"name":"api-or-web","imagePullPolicy":"Always"}]}}}}'`
-- both changed from `IfNotPresent` to `Always`.

## TLS (fixed 2026-09-18, not scripted -- see below for why)

The `nouvellesdupays` Ingress here had `cert-manager.io/cluster-issuer:
letsencrypt-prod` set, and cert-manager's ingress-shim controller kept
recreating a `Certificate`/`Order`/`Challenge` + `cm-acme-http-solver-*`
pods/ingresses/services for it, retrying forever -- Let's Encrypt's HTTP-01
challenge can never succeed here because `nouvellesdupays.com`'s public DNS
points at OCI, not this mirror, during normal standby operation (mirrors
aren't reachable at the real domain unless something has already failed
over, which is exactly backwards for issuing the cert in the first place).
This had been silently stuck for 18 days before it was found and fixed.

**Fix**: removed the `cert-manager.io/cluster-issuer` annotation from the
Ingress (`kubectl annotate ingress nouvellesdupays -n nouvellesdupays
cert-manager.io/cluster-issuer-`) so cert-manager stops trying entirely,
deleted the stuck `Certificate` and leftover ACME solver pods/ingresses/
services, then created the `nouvellesdupays-tls` secret the Ingress expects
directly from OCI's own real, currently-valid Let's Encrypt cert (exported
from the OKE `nouvellesdupays-tls` secret, same name coincidentally) rather
than trying to get this cluster to issue its own:
```
kubectl -n nouvellesdupays get secret nouvellesdupays-tls -o jsonpath='{.data.tls\.crt}' | base64 -d > tls.crt
kubectl -n nouvellesdupays get secret nouvellesdupays-tls -o jsonpath='{.data.tls\.key}' | base64 -d > tls.key
# copy tls.crt/tls.key to dr-rke2, then:
kubectl create secret tls nouvellesdupays-tls -n nouvellesdupays --cert=tls.crt --key=tls.key
```
Verified: `https://nouvellesdupays.com/` (via `curl --resolve
nouvellesdupays.com:443:192.168.1.50`) returns 200 with a fully
chain-validated cert (no `-k` needed).

**Not automated on purpose, for now**: OCI's cert renews (via cert-manager
on OKE) roughly every ~60-90 days; this on-prem copy will go stale after
that and need re-exporting by hand using the commands above. Automating
this (e.g. a CronJob alongside the DB/image sync ones) is a reasonable
future addition once there's a lower-risk way to hand this cluster access
to the OKE secret than embedding another credential on-prem -- deliberately
left as a manual step for now rather than solving that today.

## DNS failover (discovered 2026-09-18, built by someone/some session on 2026-09-11, never documented until now)

**Real, automatic, already-working DNS-layer failover for `nouvellesdupays.com`
and `www.nouvellesdupays.com` already exists** -- an OCI DNS FAILOVER steering
policy (`nouvellesdupays-failover`, `ocid1.dnspolicy.oc1.uk-london-1.aaaaaaaappz5dmfndsdqrew3it4vbritqa2rtug52onobmnbzm7ngyplnznq`),
attached to both hostnames, health-checking both `132.145.79.46` (OCI NLB,
priority 1) and `81.130.238.41` (on-prem, via BikoDC's IIS reverse proxy to
dr-haproxy, priority 99) every 30s from 3 external vantage points
(azr-iad1/aws-sfo/goo-cbf), 30s TTL. Exactly the same proven pattern as
`project_public_dns_failover_tekeche_livbiko.md`'s tekeche/livbiko/kendebabi
work, but for this domain -- and completely absent from that memory file
and everywhere else, same undocumented-SSH-and-forget failure mode as the
rest of this on-prem stack.

**Confirmed via the health-check probe history that it correctly detected
2026-09-18's real OCI outage in real time** (OCI target: `TRANSPORT`/i-o-
timeout on every probe from the moment both OKE nodes stopped; on-prem
target: consistently healthy `200`s throughout) -- this is almost
certainly why the site's homepage kept returning 200 during that outage
while `/api/.../video-channels` 404'd: DNS had already silently failed
over to the on-prem mirror, whose code at the time predated that route
entirely (Phase 2's nightly rebuild didn't exist yet). **The missing piece
this whole project was never the failover mechanism -- it was the
failover *target* being weeks stale and TLS-broken**, which Phases 1-3
above now fix.

**Verified end-to-end 2026-09-18** using the same zero-registrar-risk
`is_disabled`-toggle technique documented in the tekeche memory: disabled
the `oci-nlb` answer, confirmed OCI's own nameservers (`ns1.p201.dns.oraclecloud.net`)
started answering `81.130.238.41`, confirmed the site AND the API both
serve real, current content through that path (including this session's
own RT International work) -- not stale or broken -- then re-enabled the
answer and confirmed it reverted (allow ~30s for the health-check's own
re-evaluation cycle before it flips back to priority 1).

**Nothing to build for Phase 4** -- it already exists and now actually
works end-to-end. Re-run the same toggle test after any future change to
either target's IP or the on-prem stack, to keep confidence current.

## PAR rotation

The PAR (`dr-sync-par` Secret, key `PAR_URL`) expires 2027-09-18. Regenerate
before then:
```
oci os preauth-request create --bucket-name nouvellesdupays-db-backups \
  --namespace lr14abpkfrxj --name onprem-dr-sync-readonly \
  --access-type AnyObjectRead --bucket-listing-action ListObjects \
  --time-expires <new date>
```
then update the `dr-sync-par` Secret on dr-rke2 with the new URL.
