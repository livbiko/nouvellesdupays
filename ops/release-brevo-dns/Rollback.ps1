# Rollback of the 2026-10-18 Brevo DNS window: removes the 4 records added for Brevo (records-remove.json).
# The zone's other 6 records (NS, SOA, wildcard A) are untouched either way; zone-before.json holds the pre-change state.
$env:PATH = "C:\tools\oci-cli\bin;$env:PATH"; $env:SUPPRESS_LABEL_WARNING = 'True'
Set-Location $PSScriptRoot
oci dns record zone patch --zone-name-or-id nouvellesdupays.com --items file://records-remove.json
