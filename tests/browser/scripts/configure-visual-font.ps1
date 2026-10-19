param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$expectedFamily = 'Microsoft YaHei UI'

# Chromium resolves system-ui through the Windows menu font. Keep the hosted
# runner aligned with the Chinese Windows environment used for the baselines.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class JhsVisualFont {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct LogFont {
        public int height, width, escapement, orientation, weight;
        public byte italic, underline, strikeOut, charSet;
        public byte outPrecision, clipPrecision, quality, pitchAndFamily;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string family;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct NonClientMetrics {
        public uint size;
        public int borderWidth, scrollWidth, scrollHeight, captionWidth, captionHeight;
        public LogFont captionFont;
        public int smallCaptionWidth, smallCaptionHeight;
        public LogFont smallCaptionFont;
        public int menuWidth, menuHeight;
        public LogFont menuFont, statusFont, messageFont;
        public int paddedBorderWidth;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool SystemParametersInfo(uint action, uint size,
        ref NonClientMetrics metrics, uint flags);

    private static NonClientMetrics Read() {
        var metrics = new NonClientMetrics();
        metrics.size = (uint)Marshal.SizeOf(typeof(NonClientMetrics));
        if (!SystemParametersInfo(0x0029, metrics.size, ref metrics, 0))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        return metrics;
    }

    public static string MenuFamily() { return Read().menuFont.family; }

    public static void SetMenuFamily(string family) {
        var metrics = Read();
        metrics.menuFont.family = family;
        // Apply to this disposable runner session without persisting a profile.
        if (!SystemParametersInfo(0x002A, metrics.size, ref metrics, 0))
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }
}
'@

$currentFamily = [JhsVisualFont]::MenuFamily()
Write-Output "Visual system-ui font: $currentFamily; expected: $expectedFamily"
if ($currentFamily -eq $expectedFamily) { return }
if ($CheckOnly) { throw 'The Windows menu font does not match the visual baseline environment.' }
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Font configuration is restricted to disposable GitHub Actions runners.' }

Add-Type -AssemblyName System.Drawing
$installed = [System.Drawing.Text.InstalledFontCollection]::new()
try {
    if ($expectedFamily -notin @($installed.Families.Name)) { throw "Required font is missing: $expectedFamily" }
} finally {
    $installed.Dispose()
}

[JhsVisualFont]::SetMenuFamily($expectedFamily)
if ([JhsVisualFont]::MenuFamily() -ne $expectedFamily) { throw 'Windows menu font configuration did not take effect.' }
Write-Output "Visual system-ui font configured: $expectedFamily"
