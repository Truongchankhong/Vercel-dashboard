@echo off
wmic process where "name='powershell.exe' or name='cmd.exe' or name='excel.exe'" get ProcessId, CommandLine
