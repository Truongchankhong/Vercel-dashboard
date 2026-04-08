Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = projectDir
WshShell.Run chr(34) & "auto-sync-loop.bat" & chr(34), 0
Set WshShell = Nothing
Set fso = Nothing
