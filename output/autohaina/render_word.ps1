$ErrorActionPreference = 'Stop'
$docPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'AutoHaina_Справочник_данных_автомобилей.docx')).Path
$qaFolder = Join-Path $PSScriptRoot 'render'
New-Item -ItemType Directory -Path $qaFolder -Force | Out-Null
$pdfPath = Join-Path $qaFolder 'document.pdf'
$wordInstance = $null
$wordDocument = $null
try {
    $wordInstance = New-Object -ComObject Word.Application
    $wordInstance.Visible = $false
    $wordInstance.DisplayAlerts = 0
    $wordDocument = $wordInstance.Documents.Open($docPath, $false, $true)
    $wordDocument.ExportAsFixedFormat($pdfPath, 17)
    Write-Output $pdfPath
} finally {
    if ($null -ne $wordDocument) { $wordDocument.Close(0); [Runtime.InteropServices.Marshal]::ReleaseComObject($wordDocument) | Out-Null }
    if ($null -ne $wordInstance) { $wordInstance.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($wordInstance) | Out-Null }
}
