param(
    [Alias("l")]
    [ValidateSet(1, 2, 3)]
    [int]$Level = 2
)

$ProgName = "chant.ps1"
$Model = "claude-opus-4-8"
$ApiUrl = "https://api.anthropic.com/v1/messages"

# 응원가 가사에 포함되면 안 되는 금지 표현 (비속어 등). 필요하면 이 목록만 수정/확장하면 됨.
$ForbiddenWords = @("씨발", "씨발놈", "개새끼", "병신", "지랄", "좆", "썅")

function Show-Usage {
    @"
사용법: .\$ProgName [-Level 1|2|3] < 가사파일.txt

옵션:
  -Level   변환 강도 (1=약하게, 2=보통, 3=강하게, 기본값 2)

사전 준비:
  ANTHROPIC_API_KEY 환경 변수를 설정하세요. (예: setx ANTHROPIC_API_KEY "발급받은 키")

표준 입력으로 원본 가사를 전달하세요. 예시:

  "너를 처음 만난 그날부터 내 마음은 떨리기 시작했어" | .\$ProgName -Level 2

또는 파일로 전달:

  Get-Content lyrics.txt | .\$ProgName -Level 3
"@
}

function Test-Forbidden {
    param([string]$Text)
    foreach ($word in $ForbiddenWords) {
        if ($Text.Contains($word)) {
            Write-Error "오류: 금지 표현이 포함되어 있습니다: $word"
            exit 1
        }
    }
}

if (-not [Console]::IsInputRedirected) {
    Show-Usage
    exit 0
}

$lyrics = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($lyrics)) {
    Show-Usage
    exit 0
}

Test-Forbidden -Text $lyrics

if (-not $env:ANTHROPIC_API_KEY) {
    Write-Error "오류: ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다."
    exit 1
}

switch ($Level) {
    1 { $Instruction = "원곡의 분위기와 가사 구조를 최대한 유지하면서, 응원가 느낌의 감탄사와 표현을 가볍게 섞어 넣어줘." }
    2 { $Instruction = "응원가 특유의 후렴구(예: '이겨라', '나아가자')와 어휘를 적당히 사용해서 절반 정도는 응원가 스타일로 바꿔줘." }
    3 { $Instruction = "원곡의 흔적이 거의 남지 않을 정도로 강렬하게, 응원가 후렴구와 함성, 감탄사를 적극적으로 사용해서 완전히 응원가로 다시 써줘." }
}

$ForbiddenList = $ForbiddenWords -join ", "
$SystemPrompt = @"
당신은 노래 가사를 한국 대학 응원가 스타일로 개사하는 전문가입니다.
$Instruction
다음 표현은 결과에 절대 포함하지 마세요: $ForbiddenList
개사한 가사만 출력하고, 다른 설명이나 인사말은 덧붙이지 마세요.
"@

$body = @{
    model      = $Model
    max_tokens = 1024
    system     = $SystemPrompt
    messages   = @(@{ role = "user"; content = $lyrics })
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType "application/json" -Headers @{
        "x-api-key"         = $env:ANTHROPIC_API_KEY
        "anthropic-version" = "2023-06-01"
    } -Body $body
}
catch {
    Write-Error "오류: API 요청이 실패했습니다: $($_.Exception.Message)"
    exit 1
}

$result = ($response.content | Where-Object { $_.type -eq "text" }).text

Test-Forbidden -Text $result

Write-Output $result
