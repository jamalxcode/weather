$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
while ($l.IsListening) {
  $c = $l.GetContext()
  $b = [System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'index.html'))
  $c.Response.ContentType = 'text/html; charset=utf-8'
  $c.Response.OutputStream.Write($b, 0, $b.Length)
  $c.Response.Close()
}
