# =======================================================
# GLENDA ERP - TALLY SYNC AGENT (POWERSHELL)
# =======================================================

param(
    [string]$ErpUrl = "http://localhost:8000",
    [string]$AgentKey = "glenda-tally-secret",
    [string]$TallyUrl = "http://localhost:9000",
    [int]$PollInterval = 3
)

# Clean URLs
$ErpUrl = $ErpUrl.TrimEnd('/')
$TallyUrl = $TallyUrl.TrimEnd('/')

# Configure TLS 1.2 for HTTPS connections
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls

$Host.UI.RawUI.WindowTitle = "Glenda ERP - Tally Sync Agent"
Clear-Host

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "            GLENDA ERP - TALLY SYNC AGENT              " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " ERP Cloud Server : $ErpUrl" -ForegroundColor White
Write-Host " Local Tally Prime: $TallyUrl" -ForegroundColor White
Write-Host " Poll Interval    : $PollInterval seconds" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Helper to query active company from Tally Prime
function Get-TallyActiveCompany {
    $companyXml = @"
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>`$CoreFormat`</SVEXPORTFORMAT>
    </STATICVARIABLES>
    <TDL>
     <TDLMESSAGE>
      <COLLECTION NAME="CompCol">
       <TYPE>Company</TYPE>
       <FETCH>NAME</FETCH>
      </COLLECTION>
     </TDLMESSAGE>
    </TDL>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>
"@
    try {
        $response = Invoke-WebRequest -Uri $TallyUrl -Method Post -Body $companyXml -ContentType "text/xml; charset=utf-8" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        $content = [System.Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
        if ($content -match '<NAME>([^<]+)</NAME>') {
            return $matches[1].Trim()
        }
        return "Connected"
    } catch {
        return $null
    }
}

# 1. Connect to local Tally Prime
Write-Host "[1/2] Connecting to local Tally Prime on $TallyUrl..." -ForegroundColor Yellow
$activeCompany = $null
while (-not $activeCompany) {
    $activeCompany = Get-TallyActiveCompany
    if (-not $activeCompany) {
        Write-Host "  [!] Cannot reach Tally Prime on $TallyUrl." -ForegroundColor Red
        Write-Host "      Please make sure Tally Prime is running and company is opened at Gateway of Tally." -ForegroundColor DarkYellow
        Write-Host "      Retrying in 5 seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
}
Write-Host "  [OK] Connected to Tally Prime! Active Company: $activeCompany" -ForegroundColor Green
Write-Host ""

# 2. Register Heartbeat with Glenda ERP Cloud
Write-Host "[2/2] Linking with Glenda ERP on $ErpUrl..." -ForegroundColor Yellow
$headers = @{
    "Content-Type" = "application/json"
    "X-Tally-Agent-Key" = $AgentKey
}

$heartbeatPayload = @{
    company_name = $activeCompany
    tally_status = "active"
    agent_key = $AgentKey
} | ConvertTo-Json

try {
    $hbRes = Invoke-RestMethod -Uri "$ErpUrl/api/sales/tally/agent/heartbeat/" -Method Post -Body $heartbeatPayload -Headers $headers -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "  [OK] Successfully linked with Glenda ERP Cloud!" -ForegroundColor Green
    Write-Host "       Current pending vouchers in queue: $($hbRes.total_pending)" -ForegroundColor Cyan
} catch {
    Write-Host "  [!] Heartbeat failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "      Please check your ERP URL and internet connection." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " STATUS: LISTENING FOR SYNC REQUESTS..." -ForegroundColor Green
Write-Host " (You can minimize this window while working)" -ForegroundColor DarkGray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$loopCounter = 0

# Main Sync Loop
while ($true) {
    $loopCounter++
    
    # Send periodic heartbeat every 30 seconds (10 loops if interval=3)
    if ($loopCounter % 10 -eq 0) {
        try {
            $company = Get-TallyActiveCompany
            if ($company) { $activeCompany = $company }
            $hb = @{ company_name = $activeCompany; tally_status = "active"; agent_key = $AgentKey } | ConvertTo-Json
            $null = Invoke-RestMethod -Uri "$ErpUrl/api/sales/tally/agent/heartbeat/" -Method Post -Body $hb -Headers $headers -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        } catch { }
    }

    # Poll for next pending item (voucher or import command)
    try {
        $pollUri = "$ErpUrl/api/sales/tally/agent/poll/?agent_key=$AgentKey"
        $pollRes = Invoke-RestMethod -Uri $pollUri -Method Get -Headers $headers -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop

        if ($pollRes.has_item -eq $true) {

            # ── Branch A: Import Command (fetch_ledgers / fetch_stock) ──────────
            if ($pollRes.command_type) {
                $time = Get-Date -Format "HH:mm:ss"
                $cmd = $pollRes.command_type
                $xmlReq = $pollRes.xml_request

                $cmdLabel = if ($cmd -eq 'fetch_ledgers') { "Ledgers" } else { "Stock Items" }
                Write-Host "[$time] [IMPORT] Fetching $cmdLabel from Tally Prime..." -ForegroundColor Cyan -NoNewline

                $importResultPayload = $null
                $fetchError = $null

                try {
                    $fetchRes = Invoke-WebRequest -Uri $TallyUrl -Method Post -Body $xmlReq -ContentType "text/xml; charset=utf-8" -TimeoutSec 120 -UseBasicParsing -ErrorAction Stop
                    $xmlData = [System.Text.Encoding]::UTF8.GetString($fetchRes.RawContentStream.ToArray())
                    $fetchRes = $null
                    [System.GC]::Collect()
                    $importResultPayload = @{
                        command_type = $cmd
                        xml_data     = $xmlData
                        agent_key    = $AgentKey
                    } | ConvertTo-Json -Depth 3
                } catch {
                    $fetchError = $_.Exception.Message
                    $importResultPayload = @{
                        command_type  = $cmd
                        xml_data      = ""
                        error_message = $fetchError
                        agent_key     = $AgentKey
                    } | ConvertTo-Json -Depth 3
                }

                try {
                    $importRes = Invoke-RestMethod -Uri "$ErpUrl/api/sales/tally/agent/import-result/" -Method Post -Body $importResultPayload -Headers $headers -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
                    if ($importRes.status -eq 'done') {
                        Write-Host " DONE! ($($importRes.new_count) new, $($importRes.update_count) updated)" -ForegroundColor Green
                    } else {
                        Write-Host " FAILED! $($importRes.message)" -ForegroundColor Red
                    }
                } catch {
                    Write-Host " ERROR reporting to ERP: $($_.Exception.Message)" -ForegroundColor Red
                }

                # Immediately check if there are more items
                continue
            }

            # ── Branch B: Voucher Push (Sales Order / Invoice / Return) ─────────
            $time = Get-Date -Format "HH:mm:ss"
            $vType = $pollRes.voucher_type
            $vNo = $pollRes.voucher_no
            $vId = $pollRes.voucher_id
            $xml = $pollRes.xml_payload

            Write-Host "[$time] [INCOMING] $($vType): $vNo -> Posting to Tally Prime..." -ForegroundColor Yellow -NoNewline

            $tallyResponseText = ""
            $postError = $null

            try {
                $postRes = Invoke-WebRequest -Uri $TallyUrl -Method Post -Body $xml -ContentType "text/xml; charset=utf-8" -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
                $tallyResponseText = [System.Text.Encoding]::UTF8.GetString($postRes.RawContentStream.ToArray())
                $postRes = $null
                [System.GC]::Collect()
            } catch {
                $postError = $_.Exception.Message
            }

            # Send result back to ERP
            $resultPayload = @{
                voucher_type   = $vType
                voucher_id     = $vId
                tally_response = $tallyResponseText
                error_message  = $postError
                xml_payload    = $xml
                agent_key      = $AgentKey
            } | ConvertTo-Json

            try {
                $resultRes = Invoke-RestMethod -Uri "$ErpUrl/api/sales/tally/agent/result/" -Method Post -Body $resultPayload -Headers $headers -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop

                if ($resultRes.status -eq 'synced') {
                    Write-Host " SUCCESS!" -ForegroundColor Green
                    Write-Host "         Result: $($resultRes.message)" -ForegroundColor DarkGreen
                } else {
                    Write-Host " FAILED!" -ForegroundColor Red
                    Write-Host "         Reason: $($resultRes.message)" -ForegroundColor DarkRed
                }
            } catch {
                Write-Host " FAILED TO REPORT TO ERP!" -ForegroundColor Red
                Write-Host "         $($_.Exception.Message)" -ForegroundColor DarkRed
            }

            # If an item was processed, immediately check if there are more
            continue
        }
    } catch {
        # Silent retry on transient network errors
    }

    Start-Sleep -Seconds $PollInterval
}
