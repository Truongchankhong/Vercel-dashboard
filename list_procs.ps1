Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'powershell|cmd|excel' } | Select-Object ProcessId, Name, CommandLine | Format-Table -AutoSize
