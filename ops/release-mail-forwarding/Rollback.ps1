# Rollback of the 2026-10-18 mail-forwarding window: removes the 2 forwardemail.net MX, the forward-email TXT and the SPF TXT
# (records-remove.json). The Brevo records from the earlier window are untouched. zone-before.json holds the pre-change state.
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"; $env:SUPPRESS_LABEL_WARNING = 'True'
Set-Location $PSScriptRoot
oci dns record zone patch --zone-name-or-id nouvellesdupays.com --items file://records-remove.json
