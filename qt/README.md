This is the CODA Linux app, built on Qt6 WebEngine is intended to work similarly
 to similary to CODA apps for Windows (windows/) and MacOS (macos/) apps.

## Build
Use a separate tree of "online". Do NOT use one where you build a
normal Online.

Requires what Collabora Online already requires and the additionally following Qt
libraries: Qt6Core Qt6Widgets Qt6Gui Qt6WebEngineCore Qt6WebChannel Qt6WebEngineWidgets.

Run `./autogen.sh`, then configure
```sh
./configure --enable-qtapp --with-lo-path=/path/to/core/instdir --with-lokit-path=/path/to/core/include --enable-debug
```
Adjust the paths to `--with-lo-path` and `--with-lokit-path`.

Then run `make -j$(nproc)` on the **top directory**. This will result in `coda-qt` 
executable in this directory.

## Run

Usage: `./qt/coda-qt DOCUMENT [DOCUMENT...]`

e.g.
`./coda-qt ../test/data/hello.odt`

## Flatpak

### Building flatpak

There is a flatpak manifest under `flatpak/com.collabora.Office.json`.

Install following dependencies for building the flatpak.

```sh
flatpak install org.kde.Sdk//6.9 \
                org.kde.Platform//6.9 \
                org.freedesktop.Sdk.Extension.node20//24.08 \
                org.freedesktop.Sdk.Extension.openjdk21//24.08 \
                io.qt.qtwebengine.BaseApp//6.9
```

Use flatpak-builder to create a flatpak.

- Build and install user level:
`flatpak-builder build-dir com.collabora.Office.json --install --user --force-clean --ccache`

- Create a bundle from the build-dir:
`flatpak build-bundle .flatpak-builder/cache CODA-Q.bundle com.collabora.Office`