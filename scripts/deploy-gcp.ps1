param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [switch]$SeedData
)

$ErrorActionPreference = "Stop"

Set-Location -Path (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created .env.local from .env.example"
  Write-Host "Fill .env.local and run again"
  exit 1
}

if (-not (Test-Path ".firebaserc")) {
  $firebaserc = "{`n  `"projects`": {`n    `"default`": `"$ProjectId`"`n  }`n}"
  Set-Content -Path ".firebaserc" -Value $firebaserc -Encoding UTF8
}

npm install
npm run typecheck
npx firebase login
npx firebase use $ProjectId
npm run deploy:rules

if ($SeedData.IsPresent) {
  npm run seed
}

npm run deploy:app

Write-Host "DONE"
