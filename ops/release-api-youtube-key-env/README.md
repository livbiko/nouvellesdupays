# Build #218 - YOUTUBE_API_KEY on the on-prem API deployment

The on-prem `nouvellesdupays-api` deployment mapped only DATABASE_URL, ADMIN_PASSWORD_HASH and ADMIN_TOKEN_SECRET, so the
API never saw YOUTUBE_API_KEY: `/admin/creators` kept reporting the YouTube agent as blocked and refused to resume it
(apps/api/src/creators.js AGENT_BLOCKER; also admin.js `api_key_configured`). The worker CronJobs already map the key.

There is no on-prem API manifest in the repo (infra/k8s/05-api.yaml is the old OKE one), so the change is this JSON patch:

    kubectl -n nouvellesdupays patch deployment nouvellesdupays-api --type json -p "$(cat patch.json)"

`optional: true`: the API starts normally if the key is missing. The patch changes the pod template, so it rolls the
API (1 replica: a few seconds of errors). Rollback: re-apply the saved definition in the recovery point
(`api-deployment-before.yaml`, strip status/resourceVersion) or remove the env entry with a JSON patch `remove`.
