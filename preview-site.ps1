
# Simple Local Static Web Server (PowerShell - TCP Listener)
# This version does NOT require Administrator privileges.
# Usage: Right-click > Run with PowerShell

$ErrorActionPreference = "Stop"
$port = 8080
$rootPath = "$PSScriptRoot\public"

try {
    Write-Host "[INFO] Starting server on port $port..."
    Write-Host "[INFO] Serving files from: $rootPath"

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $listener.Start()
        
    Write-Host "[INFO] Server running at http://localhost:$port/"
    Write-Host "Press Ctrl+C to stop..."
    Write-Host "--------------------------------------------------"

    # Open Browser
    Start-Process "http://localhost:$port"

    $buffer = New-Object byte[] 65536

    while ($true) {
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            
            # Read Request
            if ($stream.DataAvailable) {
                $read = $stream.Read($buffer, 0, $buffer.Length)
                $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
                
                # Parse GET line, e.g., "GET /index.html HTTP/1.1"
                $lines = $requestText -split "\r\n"
                $firstLine = $lines[0]
                $parts = $firstLine -split " "
                
                if ($parts.Length -ge 2) {
                    $url = $parts[1]
                    if ($url -eq "/") { $url = "/index.html" }
                    
                    # Remove query string if any
                    $url = $url.Split('?')[0]
                    
                    # Fix slashes
                    $safePath = $url.TrimStart("/").Replace("/", "\")
                    $filePath = Join-Path $rootPath $safeLocalPath
                    
                     # Ensure we are looking for a file inside rootPath
                    $fullPath = Join-Path $rootPath $safePath
                    
                    $responseHeader = ""
                    $responseBody = $null
                    
                    if (Test-Path $fullPath -PathType Leaf) {
                        $responseBody = [System.IO.File]::ReadAllBytes($fullPath)
                        $status = "200 OK"
                        
                        $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
                        $contentType = switch ($ext) {
                            ".html" { "text/html; charset=utf-8" }
                            ".js"   { "application/javascript" }
                            ".css"  { "text/css" }
                            ".json" { "application/json" }
                            ".png"  { "image/png" }
                            ".jpg"  { "image/jpeg" }
                            Default { "application/octet-stream" }
                        }
                    } else {
                        $status = "404 Not Found"
                        $responseBody = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found</h1>")
                        $contentType = "text/html"
                        Write-Warning "404: $url"
                    }
                    
                    # Send Headers
                    $headerText = "HTTP/1.1 $status`r`n" +
                                  "Content-Type: $contentType`r`n" +
                                  "Content-Length: $($responseBody.Length)`r`n" +
                                  "Connection: close`r`n`r`n"
                                  
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    
                    # Send Body
                    if ($responseBody) {
                        $stream.Write($responseBody, 0, $responseBody.Length)
                    }
                }
            }
            
            $client.Close()
        }
        
        Start-Sleep -Milliseconds 10
    }

} catch {
    Write-Error "[ERROR] Critical error: $_"
    Write-Host "Details: $($_.Exception.Message)"
} finally {
    if ($listener) { $listener.Stop() }
    Write-Host ""
    Write-Host "=== PROGRAM FINISHED ==="
    Read-Host "Press Enter to exit..."
}
