# ═══════════════════════════════════════════════════════════════
# ملف Nix لتحديد تبعيات النظام على Replit
# يضمن وجود Python وأدوات معالجة الصور
# ═══════════════════════════════════════════════════════════════

{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.python311Packages.pillow
    pkgs.python311Packages.requests
    pkgs.python311Packages.beautifulsoup4
  ];
}
