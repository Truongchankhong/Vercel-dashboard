
# Script to convert Excel to JSON and Sync to Supabase (No Node.js required)
# Usage: powershell -ExecutionPolicy Bypass -File sync-powerapp-direct.ps1

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$excelPath = "$PSScriptRoot\data\Powerapp.xlsx"
$jsonPath = "$PSScriptRoot\public\powerapp.json"
$supabaseUrl = "https://ixdtdrbytwdmnlqgunzu.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg"

# MAPPING (New Column -> Old Column)
$THANG_HOA = "TH" + [char]0x0102 + "NG HOA"

$mapping = @{
    'Index' = 'STT';
    'So' = 'SO';
    'PRO ORDER' = 'PRO ODER';
    'Brand' = 'Brand Code';
    'Customer' = 'CUSTOMERS';
    'Type Oder' = '#MOLDED';
    '#MOLDTYPE' = '#MOLD';
    'QtyOrder' = 'Total Qty';
    'Recieved Material' = 'RECEIVED (MATERIAL)';
    'Recieved Logo' = 'RECEIVED (LOGO)';
    'LAMINATION (PRO)' = 'Laminating (Pro)';
    'PRE (PRO)' = 'Prefitting (Pro)';
    'Slipting (PRO)' = 'Slipting (Pro)';
    'Sub Return' = $THANG_HOA;
    'Instruction Sub' = 'SUB';
    'MOLD_IN (PRO)' = 'Molding Pro (IN)';
    'MOLD_OUT (PRO)' = 'Molding Pro';
    'LEAN_IN (PRO)' = 'IN lean Line (Pro)';
    'LEAN_OUT (PRO)' = 'Out lean Line (Pro)';
    'LINE CODE' = 'IN lean Line (MACHINE)';
    'STORED' = 'STORED';
    'Finish Date (PPC)' = 'Finish date';
    'PPC CMF' = 'PPC Confirm';
    'Status' = 'STATUS';
    'BOM' = 'BOM';
    '#LAST' = '#Last';
    'Gender' = 'GENDER';
    'CODE PU1' = 'PU';
    'Description PU1' = 'PU DESCRIPTION';
    'DL PU1' = 'DL PU';
    'CODE PU2' = 'PU2';
    'Description PU2' = 'PU2 DESCRIPTION';
    'DL PU2' = 'DL PU2';
    'CODE PU3' = 'PU3';
    'Description PU3' = 'PU3 DESCRIPTION';
    'DL PU3' = 'DL PU3';
    'CODE FABRIC' = 'FB';
    'Description FB' = 'FB DESCRIPTION';
    'DL FB' = 'DL FB';
    'CODE LOGO1' = 'LOGO';
    'Description LOGO1' = 'LOGO DESCRIPTION';
    'DL LOGO1' = 'DL LOGO';
    'CODE LOGO2' = 'CODE LOGO2';
    'Description LOGO2' = 'Description LOGO2';
    'DL LOGO2' = 'DL LOGO2';
    'CODE LOGO3' = 'CODE LOGO3';
    'Description LOGO3' = 'Description LOGO3';
    'DL LOGO3' = 'DL LOGO3';
    'CODE LOGO4' = 'CODE LOGO4';
    'Description LOGO4' = 'Description LOGO4';
    'DL LOGO4' = 'DL LOGO4';
    'S3' = '3'; 'S3.5' = '3.5'; 'S4' = '4'; 'S4.5' = '4.5'; 'S5' = '5';
    'S5.5' = '5.5'; 'S6' = '6'; 'S6.5' = '6.5'; 'S7' = '7'; 'S7.5' = '7.5';
    'S8' = '8'; 'S8.5' = '8.5'; 'S9' = '9'; 'S9.5' = '9.5'; 'S10' = '10';
    'S10.5' = '10.5'; 'S11' = '11'; 'S11.5' = '11.5'; 'S12' = '12'; 'S12.5' = '12.5';
    'S13' = '13'; 'S13.5' = '13.5'; 'S14' = '14'; 'S14.5' = '14.5'; 'S15' = '15';
    'S15.5' = '15.5'; 'S16' = '16'; 'S16.5' = '16.5'; 'S17' = '17'; 'S17.5' = '17.5';
    'S18' = '18'; 'S18.5' = '18.5'; 'S19' = '19'; 'S19.5' = '19.5'; 'S20' = '20';
    'S20.5' = '20.5'; 'S21' = '21'; 'S21.5' = '21.5'; 'S22' = '22'; 'S22.5' = '22.5';
    'S23' = '23'; 'S23.5' = '23.5'; 'S24' = '24'; 'S24.5' = '24.5'; 'S25' = '25';
    'S25.5' = '25.5'; 'S26' = '26'; 'S26.5' = '26.5'; 'S27' = '27'; 'S27.5' = '27.5';
    'S28' = '28'; 'S28.5' = '28.5'; 'S29' = '29'; 'S29.5' = '29.5'; 'S30' = '30';
    'S30.5' = '30.5'; 'S31' = '31'; 'S31.5' = '31.5'; 'S32' = '32'; 'S32.5' = '32.5';
    'S33' = '33'; 'S33.5' = '33.5'; 'S34' = '34'; 'S34.5' = '34.5'; 'S35' = '35';
    'S35.5' = '35.5'; 'S36' = '36'; 'S36.5' = '36.5'; 'S37' = '37'; 'S37.5' = '37.5';
    'S38' = '38'; 'S38.5' = '38.5'; 'S39' = '39'; 'S39.5' = '39.5'; 'S40' = '40';
    'S40.5' = '40.5'; 'S41' = '41'; 'S41.5' = '41.5'; 'S42' = '42'; 'S42.5' = '42.5';
    'S43' = '43'; 'S43.5' = '43.5'; 'S44' = '44'; 'S44.5' = '44.5'; 'S45' = '45';
    'S45.5' = '45.5'; 'S46' = '46'; 'S46.5' = '46.5'; 'S47' = '47'; 'S47.5' = '47.5';
    'S48' = '48'; 'S48.5' = '48.5'; 'S49' = '49'; 'S49.5' = '49.5'; 'S50' = '50';
    'M.LAM (PLAN)' = 'LAMINATION MACHINE (PLAN)';
    'M. LEANLINE(PLAN)' = 'LEANLINE PLAN';
    'LAMINATION MACHINE (REALTIME)' = 'LAMINATION MACHINE (REALTIME)';
    'LEANLINE (REALTIME)' = 'LEANLINE (REALTIME)';
    'DL-XG' = 'Delay-Urgent';
}

Write-Host ">>> Starting Sync Powerapp Direct..."

# 1. READ EXCEL
if (-not (Test-Path $excelPath)) {
    $files = Get-ChildItem "$PSScriptRoot\data\Powerapp*.xlsx"
    if ($files.Count -gt 0) {
        $excelPath = $files[0].FullName
    }
    else {
        Write-Error "!!! Excel file not found in data folder."
        exit 1
    }
}
Write-Host "--- Reading Excel: $excelPath"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    # Open(FileName, UpdateLinks, ReadOnly) -> Set ReadOnly = $true to avoid access errors if file is open
    $wb = $excel.Workbooks.Open($excelPath, 0, $true)
    $ws = $wb.Sheets.Item("Data Power app")
    
    $range = $ws.UsedRange
    $data = $range.Value2 
    $rowCount = $range.Rows.Count
    $colCount = $range.Columns.Count
    
    Write-Host "--- Found $rowCount rows and $colCount columns."
    
    $headers = @()
    for ($c = 1; $c -le $colCount; $c++) {
        $val = $data[1, $c]
        if ($null -eq $val) { $val = "" }
        $headers += $val.ToString().Trim()
    }
    


    Write-Host "--- DETECTED HEADERS (First 10): $($headers[0..9] -join ', ')"
    
    $mappedHeaders = @()
    $headerIndices = @{} # Map old header name to column index (1-based)
    
    # Collect all valid target column names
    $targetCols = $mapping.Values | Select-Object -Unique

    for ($i = 0; $i -lt $headers.Count; $i++) {
        $h = $headers[$i]
        
        if ($mapping.ContainsKey($h)) {
            $oldH = $mapping[$h]
            $mappedHeaders += $oldH
            $headerIndices[$oldH] = $i + 1 
        }
        elseif ($targetCols -contains $h) {
            # Identity Mapping: Header is already a target column name
            $mappedHeaders += $h
            $headerIndices[$h] = $i + 1
        }
        # Handle specific Delay case seen in logs
        elseif ($h -eq "Delay/Urgent") {
            $target = "Delay-Urgent"
            $mappedHeaders += $target
            $headerIndices[$target] = $i + 1
        }
    }
    
    if (-not $headerIndices.ContainsKey('STT')) {
        Write-Warning "!!! 'Index' (mapped to STT) NOT FOUND in Excel headers. Check column name."
        Write-Host "All Headers Found: $($headers -join ', ')"
    }
    else {
        Write-Host "--- STT Column Index: $($headerIndices['STT'])"
    }
    
    $jsonData = @()
    for ($r = 2; $r -le $rowCount; $r++) {
        $idxVal = $data[$r, 1]
        if ($null -eq $idxVal) { continue; }
        
        $rowObj = @{}
        foreach ($oldH in $mappedHeaders) {
            $colIdx = $headerIndices[$oldH]
            $val = $data[$r, $colIdx]
            
            # --- NUMERIC SANITIZATION ---
            # Identify numeric columns: STT, Total Qty, all 'DL *', and Size columns (numbers)
            $isNumericCol = ($oldH -eq "STT") -or 
            ($oldH -eq "Total Qty") -or 
            ($oldH -like "DL *") -or
            ($oldH -match "^\d+(\.\d+)?$") # Matches size keys like '3', '3.5'

            if ($isNumericCol) {
                # If null, empty, or "NONE" (case-insensitive), or not a number -> set to null
                if ($null -eq $val -or $val -eq "" -or "$val" -eq "NONE") {
                    $rowObj[$oldH] = $null
                }
                else {
                    # Try to parse as double to verify it's a number
                    $num = 0
                    if ([double]::TryParse("$val", [ref]$num)) {
                        $rowObj[$oldH] = $val
                    }
                    else {
                        # Valid string but not a number (e.g. some text comment) -> set to null
                        $rowObj[$oldH] = $null
                    }
                }
            }
            else {
                # Normal Text/Date Columns
                if ($null -eq $val) { 
                    $rowObj[$oldH] = $null
                }
                else {
                    $rowObj[$oldH] = $val
                }
            }
        }
        
        if ([string]::IsNullOrWhiteSpace($rowObj['STT'])) {
            if ($r -le 5) { Write-Host "--- Row $r SKIPPED because STT is null/empty. (Raw Val: '$($data[$r, $headerIndices['STT']])')" }
            continue;
        }

        $jsonData += $rowObj
    }
    
    Write-Host "--- Processed $($jsonData.Count) rows."

}
finally {
    try {
        if ($wb) { $wb.Close($false) }
        if ($excel) { $excel.Quit() }
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        Remove-Variable excel -ErrorAction SilentlyContinue
    }
    catch {
        Write-Warning "Warning closing Excel: $_"
    }
}

# 2. UPLOAD TO SUPABASE

# Use temp file for upload to avoid command line limits and encoding issues
$tempFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Send-BatchToSupabase {
    param($chunk)
    
    # Force array structure even if single item
    $jsonBody = ConvertTo-Json -InputObject $chunk -Depth 10 -Compress
    
    # Write to temp file with UTF-8 No BOM
    [System.IO.File]::WriteAllText($tempFile, $jsonBody, $utf8NoBom)
    
    $maxRetries = 5
    $retryCount = 0
    $success = $false

    while (-not $success -and $retryCount -lt $maxRetries) {
        try {
            # Use Upsert (resolution=merge-duplicates) to avoid 409 Conflict
            $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/powerapp" `
                -Method Post `
                -Headers @{ 
                "apikey"        = "$supabaseKey"; 
                "Authorization" = "Bearer $supabaseKey"; 
                "Content-Type"  = "application/json; charset=utf-8";
                "Prefer"        = "resolution=merge-duplicates"
            } `
                -InFile $tempFile
            $success = $true
        }
        catch {
            $retryCount++
            $errBody = $_.ErrorDetails.Message
            if (-not $errBody) { 
                # Try to read response stream if available
                if ($_.Exception.Response) {
                    $stream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errBody = $reader.ReadToEnd()
                    $reader.Close() 
                }
            }
            Write-Warning "!!! Upload failed (Attempt $retryCount/$maxRetries): $_ Details: $errBody"
            Start-Sleep -Seconds 2
        }
    }

    if (-not $success) {
        Write-Error "!!! Failed to upload chunk after $maxRetries attempts."
    }
}

Write-Host "--- Clearing existing data..."
try {
    # Delete ALL data (STT is not null) using standard PostgREST syntax
    Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/powerapp?STT=not.is.null" `
        -Method Delete `
        -Headers @{ 
        "apikey"        = "$supabaseKey"; 
        "Authorization" = "Bearer $supabaseKey" 
    } | Out-Null
}
catch {
    Write-Warning "!!! Clear data warning: $_"
}

$chunkSize = 1000
for ($i = 0; $i -lt $jsonData.Count; $i += $chunkSize) {
    Write-Host "--- Uploading chunk starting at $i..."
    $end = [Math]::Min($i + $chunkSize - 1, $jsonData.Count - 1)
    $chunk = $jsonData[$i..$end]
    Send-BatchToSupabase -chunk $chunk
}

# 3. WRITE METADATA (Last Updated)
Write-Host "--- Writing metadata..."
$metadata = @{
    "STT"         = -1;
    "PRO ODER"    = "METADATA_LAST_UPDATE";
    "Finish date" = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}
# Wrap in array for the generic function or sending logic
$metaChunk = @($metadata)
Send-BatchToSupabase -chunk $metaChunk

# Cleanup
if (Test-Path $tempFile) { Remove-Item $tempFile }

Write-Host "--- Sync Complete, Everything OK!"
exit 0
