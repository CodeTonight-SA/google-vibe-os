Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:NODE_ENV = "development"
Start-Process -FilePath "$PSScriptRoot\node_modules\electron\dist\electron.exe" -ArgumentList "." -WorkingDirectory $PSScriptRoot
