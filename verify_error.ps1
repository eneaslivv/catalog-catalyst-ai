
try {
    $body = '{"rowIds": ["a978cf31-8f5e-49d8-b6ff-bea699b98c8e"]}'
    $response = Invoke-RestMethod -Uri "https://mhzpwpnjucrymblvjeno.supabase.co/functions/v1/normalize-product" -Method POST -ContentType "application/json" -Body $body -ErrorAction Stop
    if ($response.results[0].error) {
        $response.results[0].error | Out-File "real_error.txt" -Encoding utf8
    } else {
        "Success!" | Out-File "real_error.txt"
    }
} catch {
    $_.Exception.Response.GetResponseStream() | %{ [System.IO.StreamReader]::new($_).ReadToEnd() } | Out-File "error_output.txt"
}
