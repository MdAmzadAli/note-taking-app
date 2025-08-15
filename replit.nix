
{ pkgs }: {
  deps = [
    pkgs.cairo
    pkgs.pango
    pkgs.libjpeg
    pkgs.giflib
    pkgs.librsvg
    pkgs.libpng
    pkgs.libuuid
    pkgs.pkg-config
    pkgs.pixman
  ];
}
