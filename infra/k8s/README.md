# Deploying to the Livbiko OKE cluster

## Prerequisites (not done in this pass — see notes below)

1. OCIR repos for the 3 images (`nouvellesdupays-web`, `nouvellesdupays-api`, `nouvellesdupays-worker`), mirroring how `tekeche-web`/`livbiko-web` repos were created.
2. Images built and pushed. Build contexts differ:
   - `apps/api/Dockerfile` and `apps/worker/Dockerfile` — build context is the **repo root** (they need `packages/shared` and, for api, `db/`).
   - `apps/web/Dockerfile` — build context is **`apps/web`** itself (self-contained Next.js app), and needs `--build-arg NEXT_PUBLIC_API_URL=https://nouvellesdupays.com` at build time (Next.js inlines `NEXT_PUBLIC_*` vars into the client bundle at build time, not runtime).
3. A Bastion tunnel to the OKE API endpoint (per `[[reference_oke_bastion_access]]` memory — not auto-connected, needs a fresh tunnel each session).
4. Confirm the cluster's actual PVC storage class name (`kubectl get storageclass`) matches `oci-bv` as assumed in `03-postgres.yaml` — not verified against the live cluster from this session.

## Apply order

```
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-configmap.yaml
pwsh 02-create-secret.ps1
kubectl apply -f 03-postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n nouvellesdupays --timeout=120s
kubectl apply -f 04-migrate-job.yaml
kubectl wait --for=condition=complete job/nouvellesdupays-migrate -n nouvellesdupays --timeout=60s
kubectl apply -f 05-api.yaml
kubectl apply -f 06-worker-cronjob.yaml
kubectl apply -f 07-web.yaml
kubectl apply -f 09-ocir-refresh-cronjob.yaml
kubectl apply -f 10-pdb-hpa.yaml
```

`08-ingress.yaml` is deliberately **not** in the sequence above — see its own header comment. Getting `nouvellesdupays.com` to actually reach this cluster (DNS + the shared OCI LB's backend routing to ingress-nginx's NodePort) is a change against shared production LB/DNS infrastructure, which per this project's change-management rules needs its own proposed maintenance window and explicit sign-off, not something to bundle silently into the app's own deploy. Apply it once that's been separately approved and scheduled.

## Re-running migrations after a schema change

```
kubectl delete job nouvellesdupays-migrate -n nouvellesdupays
kubectl apply -f 04-migrate-job.yaml
```
