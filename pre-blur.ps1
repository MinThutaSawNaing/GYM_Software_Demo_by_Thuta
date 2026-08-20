# Pre-blur public/gym.jpg into public/gym-blurred.jpg at build-prep time.
# Downscale -> upscale gives a smooth gaussian-like blur so the page no longer
# needs the expensive full-viewport `filter: blur()` in CSS.
Add-Type -AssemblyName System.Drawing

$src = Join-Path $PWD 'public\gym.jpg'
$dst = Join-Path $PWD 'public\gym-blurred.jpg'

if (-not (Test-Path $src)) {
  Write-Error "Source image not found: $src"
  exit 1
}

$img = [System.Drawing.Image]::FromFile($src)
$w = $img.Width
$h = $img.Height

# Downscale factor (4x => soft blur comparable to a few px radius).
$factor = 4
$smallW = [Math]::Max(16, [int]($w / $factor))
$smallH = [Math]::Max(16, [int]($h / $factor))

$small = New-Object System.Drawing.Bitmap($smallW, $smallH)
$g1 = [System.Drawing.Graphics]::FromImage($small)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.DrawImage($img, 0, 0, $smallW, $smallH)
$g1.Dispose()

$result = New-Object System.Drawing.Bitmap($w, $h)
$g2 = [System.Drawing.Graphics]::FromImage($result)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.DrawImage($small, 0, 0, $w, $h)
$g2.Dispose()

$small.Dispose()
$img.Dispose()

$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]80)
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$result.Save($dst, $jpegCodec, $encoderParams)
$result.Dispose()

Write-Output "Blurred image written: $dst ($w x $h)"
