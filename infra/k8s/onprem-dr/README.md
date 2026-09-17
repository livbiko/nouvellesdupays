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
