Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "START_LEANLINE_DC_SYNC.bat" & Chr(34), 0
Set WshShell = Nothing
