# Generates the Open Graph image, PWA icons and PNG favicons used by the SEO tags.
# Run from the repo root: powershell -ExecutionPolicy Bypass -File scripts/generate-seo-assets.ps1
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root 'public'
New-Item -ItemType Directory -Force -Path $public | Out-Null

function New-RoundedPath {
  param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $R * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LinearBrush {
  param([System.Drawing.Rectangle]$Rect, [string]$From, [string]$To, [float]$Angle)
  $c1 = [System.Drawing.ColorTranslator]::FromHtml($From)
  $c2 = [System.Drawing.ColorTranslator]::FromHtml($To)
  return [System.Drawing.Drawing2D.LinearGradientBrush]::new($Rect, $c1, $c2, $Angle)
}

function Add-Glow {
  param($Graphics, [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Color, [int]$Alpha)
  $c = [System.Drawing.ColorTranslator]::FromHtml($Color)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($Alpha, $c.R, $c.G, $c.B))
  $Graphics.FillEllipse($brush, $X, $Y, $W, $H)
  $brush.Dispose()
}

function Draw-Mark {
  param($Graphics, [float]$X, [float]$Y, [float]$Size)
  $radius = $Size * 0.24
  $path = New-RoundedPath $X $Y $Size $Size $radius
  $brush = New-LinearBrush ([System.Drawing.Rectangle]::new([int]$X, [int]$Y, [int]$Size, [int]$Size)) '#7c3aed' '#c026d3' 45
  $Graphics.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()

  $barHeight = $Size * 0.085
  $barRadius = $barHeight / 2

  $bar1 = New-RoundedPath ($X + $Size * 0.22) ($Y + $Size * 0.55) ($Size * 0.56) $barHeight $barRadius
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $Graphics.FillPath($white, $bar1)
  $bar1.Dispose()
  $white.Dispose()

  $bar2 = New-RoundedPath ($X + $Size * 0.31) ($Y + $Size * 0.70) ($Size * 0.38) $barHeight $barRadius
  $semi = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(178, 255, 255, 255))
  $Graphics.FillPath($semi, $bar2)
  $bar2.Dispose()
  $semi.Dispose()
}

function Draw-Pill {
  param(
    $Graphics,
    [float]$X,
    [float]$Y,
    [float]$W,
    [float]$H,
    [string]$Text,
    [float]$FontSize,
    [string]$Fill,
    [string]$Border,
    [string]$TextColor
  )
  $path = New-RoundedPath $X $Y $W $H ($H / 2)
  $fillColor = [System.Drawing.ColorTranslator]::FromHtml($Fill)
  $brush = [System.Drawing.SolidBrush]::new($fillColor)
  $Graphics.FillPath($brush, $path)
  $brush.Dispose()

  if ($Border) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Border), 2)
    $Graphics.DrawPath($pen, $path)
    $pen.Dispose()
  }
  $path.Dispose()

  $font = [System.Drawing.Font]::new('Segoe UI', $FontSize, [System.Drawing.FontStyle]::Bold)
  $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($TextColor))
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = 'Center'
  $format.LineAlignment = 'Center'
  $Graphics.DrawString($Text, $font, $textBrush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $format.Dispose()
  $textBrush.Dispose()
  $font.Dispose()
}

# ------------------------------ Open Graph ------------------------------
$og = [System.Drawing.Bitmap]::new(1200, 630)
$g = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$rect = [System.Drawing.Rectangle]::new(0, 0, 1200, 630)
$bg = New-LinearBrush $rect '#07070c' '#1b0b33' 30
$g.FillRectangle($bg, $rect)
$bg.Dispose()

Add-Glow $g -240 -220 900 700 '#7c3aed' 70
Add-Glow $g 820 -260 650 620 '#d946ef' 55
Add-Glow $g 260 470 900 520 '#7c3aed' 32

Draw-Mark $g 84 74 104

$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$violet = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#c4b5fd'))
$muted = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#a1a1b5'))

$brandFont = [System.Drawing.Font]::new('Segoe UI', 33, [System.Drawing.FontStyle]::Bold)
$g.DrawString('AutoCaption Studio', $brandFont, $white, 214, 76)

$tagFont = [System.Drawing.Font]::new('Segoe UI', 14, [System.Drawing.FontStyle]::Regular)
$g.DrawString('FREE AI CAPTION GENERATOR', $tagFont, $violet, 218, 140)

$headlineFont = [System.Drawing.Font]::new('Segoe UI', 40, [System.Drawing.FontStyle]::Bold)
$g.DrawString('Turn any video into', $headlineFont, $white, 84, 232)
$g.DrawString('viral captions in seconds', $headlineFont, $white, 84, 300)

$subFont = [System.Drawing.Font]::new('Segoe UI', 20, [System.Drawing.FontStyle]::Regular)
$g.DrawString('Hindi, Hinglish, English and 25+ languages', $subFont, $violet, 88, 378)

# Caption preview card
$cardPath = New-RoundedPath 84 432 1032 88 22
$cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 13, 13, 21))
$g.FillPath($cardBrush, $cardPath)
$cardBrush.Dispose()
$cardPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 58, 45, 85), 2)
$g.DrawPath($cardPen, $cardPath)
$cardPen.Dispose()
$cardPath.Dispose()

$captionFont = [System.Drawing.Font]::new('Segoe UI', 21, [System.Drawing.FontStyle]::Bold)
$g.DrawString('AI captions that', $captionFont, $white, 118, 460)
Draw-Pill $g 352 452 96 48 'pop' 20 '#7c3aed' '' '#ffffff'
$g.DrawString('on every scroll', $captionFont, $white, 468, 460)

# Feature chips
Draw-Pill $g 84 552 268 52 'Word-by-word timing' 13 '#161625' '#2f2f45' '#d4d4e0'
Draw-Pill $g 368 552 268 52 'Animated styles' 13 '#161625' '#2f2f45' '#d4d4e0'
Draw-Pill $g 652 552 230 52 'MP4 + SRT export' 13 '#161625' '#2f2f45' '#d4d4e0'

$siteFont = [System.Drawing.Font]::new('Segoe UI', 13, [System.Drawing.FontStyle]::Regular)
$g.DrawString('caption-generator-9ch5.onrender.com', $siteFont, $muted, 900, 566)

$og.Save((Join-Path $public 'og-image.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$brandFont.Dispose(); $tagFont.Dispose(); $headlineFont.Dispose(); $subFont.Dispose()
$captionFont.Dispose(); $siteFont.Dispose(); $white.Dispose(); $violet.Dispose(); $muted.Dispose()
$g.Dispose(); $og.Dispose()

# -------------------------------- Icons --------------------------------
function New-Icon {
  param([int]$Size, [string]$FileName)
  $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = 'AntiAlias'
  $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $iconRect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
  $iconBg = New-LinearBrush $iconRect '#7c3aed' '#c026d3' 45
  $rounded = New-RoundedPath 0 0 $Size $Size ($Size * 0.22)
  $gfx.FillPath($iconBg, $rounded)
  $rounded.Dispose()
  $iconBg.Dispose()

  $barHeight = [Math]::Max(2.0, $Size * 0.085)
  $barRadius = $barHeight / 2

  $bar1 = New-RoundedPath ($Size * 0.22) ($Size * 0.55) ($Size * 0.56) $barHeight $barRadius
  $barWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $gfx.FillPath($barWhite, $bar1)
  $bar1.Dispose()
  $barWhite.Dispose()

  $bar2 = New-RoundedPath ($Size * 0.31) ($Size * 0.70) ($Size * 0.38) $barHeight $barRadius
  $barSemi = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(178, 255, 255, 255))
  $gfx.FillPath($barSemi, $bar2)
  $bar2.Dispose()
  $barSemi.Dispose()

  $bmp.Save((Join-Path $public $FileName), [System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose()
  $bmp.Dispose()
}

New-Icon 512 'icon-512.png'
New-Icon 192 'icon-192.png'
New-Icon 180 'apple-touch-icon.png'
New-Icon 32 'favicon-32.png'

Write-Host "Generated og-image.png, icon-512.png, icon-192.png, apple-touch-icon.png and favicon-32.png in $public"
