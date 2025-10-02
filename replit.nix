{ pkgs }: {
  deps = [
    pkgs.eas-cli
    pkgs.python312Full
    pkgs.python312Packages.pip
    pkgs.python312Packages.brotli
    pkgs.nodejs_20
    pkgs.cairo
    pkgs.pango
    pkgs.libjpeg
    pkgs.giflib
    pkgs.librsvg
    pkgs.pixman
    pkgs.pkg-config
    pkgs.python312Packages.pillow
  ];
}