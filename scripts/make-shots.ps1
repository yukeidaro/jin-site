Add-Type -AssemblyName System.Drawing

$src   = 'C:\Users\yuasano\.copilot\workspaces\b095e45d-de7a-4f86-863b-779b15b28ec0\attachments'
$light = Join-Path $src 'd65c9fea-cf6d-4cf0-87aa-cab5b06aaece-2ccc068e-7fe2-4974-bcbf-dbfc356bcf24-clipboard.png'
$dark  = Join-Path $src '73e249dc-fa35-4c13-9a72-d4435c9fef41-d03c7381-6326-4288-b19c-fb881b8b0d0e-clipboard.png'
$out   = 'C:\Users\yuasano\Documents\OneDrive\For Github\jin-site\shots'

function Save-Crop {
  param([string]$Source, [string]$Target, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Quality)

  $image = [System.Drawing.Image]::FromFile($Source)
  $rect  = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
  $crop  = New-Object System.Drawing.Bitmap($W, $H)
  $g     = [System.Drawing.Graphics]::FromImage($crop)
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($image, (New-Object System.Drawing.Rectangle(0, 0, $W, $H)), $rect, [System.Drawing.GraphicsUnit]::Pixel)

  $codec  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
  $crop.Save($Target, $codec, $params)

  $g.Dispose(); $crop.Dispose(); $image.Dispose()
  [pscustomobject]@{ File = (Split-Path $Target -Leaf); W = $W; H = $H; KB = [math]::Round((Get-Item $Target).Length / 1KB, 1) }
}

# Full light app shot for the hero.
Save-Crop -Source $light -Target (Join-Path $out 'app-hero-en.jpg')     -X 0   -Y 0 -W 1624 -H 968 -Quality 90

# Left panes: local files plus the project structure.
Save-Crop -Source $light -Target (Join-Path $out 'app-workspace-en.jpg') -X 0   -Y 0 -W 844  -H 968 -Quality 92

# The document pane, from the same light screenshot so the page never mixes themes.
Save-Crop -Source $light -Target (Join-Path $out 'app-page-en.jpg')      -X 780 -Y 0 -W 844  -H 968 -Quality 92
