$supabaseUrl = "https://ixdtdrbytwdmnlqgunzu.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg"

try {
    # Try to select the column. If it doesn't exist, it might error or return nulls.
    # A better way is to try to filter by it, which definitely errors if missing.
    $result = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/supplement_tracking?select=pu_sheets&limit=1" `
        -Method Get `
        -Headers @{ 
        "apikey"        = "$supabaseKey"
        "Authorization" = "Bearer $supabaseKey"
    }
    Write-Host "EXISTS"
}
catch {
    Write-Host "MISSING"
}
