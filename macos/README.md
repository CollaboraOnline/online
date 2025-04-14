# Building the CODA-M

## Setup

* Instal node.js
    * brew install node
* Install poco
    * brew install poco
* zstd
    * brew install zstd
* missing from the iOS build instructions (needed for online.git)
    * brew install libtool

* install dependencies for the canvas@next
    * brew install cairo
    * brew install pango
    * /opt/homebrew/bin/pip3 install --break-system-packages lxml
    * /opt/homebrew/bin/pip3 install --break-system-packages polib

* install canvas to avoid error during build (complains about node-pre-gyp)
    * NB. version 3.0 needed, it upgrades the API to fit the new node.js
    * npm install canvas@next
        * It might be that you should run the above in the browser subdirectory
	  of your online directory: (cd browser && npm install canvas@next)

* Install and/or update the Command Line Tools for Xcode:
    * xcode-select --install
    * After that you might need to update them in System Settings > General > Software Updates
        * For some reason for me it lists both 15.3 and 16.0 there. As I have Xcode 16.0, I choose just that one.

## Build LO

You need the 'coda' branch for that, and have to use the following
autogen.input.

NOTE: I build with stuff installed via 'brew', and not via 'lode'; if you have
too many things installed via 'brew', compilation may fail for you due to
incompatible stuff.

autogen.input:

    # Distro
    --with-distro=CPMacOS-LOKit
    --enable-headless
    --disable-mergelibs

    # Overrides for the debug builds
    --enable-debug
    #--enable-dbgutil

    --enable-werror
    --enable-symbols
    --without-lang
    --without-system-dicts
    --without-myspell-dicts

Configure Collabora Online

    ./autogen.sh && ./configure \
    --enable-macosapp \
    --enable-experimental \
    --with-app-name="Collabora Office" \
    --with-vendor="Collabora Productivity" \
    --with-poco-includes=/opt/homebrew/opt/poco/include \
    --with-poco-libs=/opt/homebrew/opt/poco/lib \
    --with-zstd-includes=/opt/homebrew/include \
    --with-zstd-libs=/opt/homebrew/lib \
    --with-lo-path=/Users/kendy/Projects/lo/core/instdir/CollaboraOffice.app \
    --with-lokit-path=/Users/kendy/Projects/lo/core/include

Obbiously you need to change the /Users/kendy/... above to match what
you have. Also, on Intel Macs homebrew gets installed in /usr/local,
not /opt/homebrew.

If you find an instance of /Users/kendy hardcoded somewhere, please
report that, it's a mistake and should be fixed.

## Then you can build CODA-M:

* ( cd browser ; gmake )
* open Xcode's project macos/coda/coda.xcodeproj & build from there

# Building and debugging coolwsd directly in Xcode

There is an additional Xcode project for easy building and debugging of
coolwsd on macOS directly in Xcode. Configure everything as above, but use
a slightly different ./configure (particularly notice the
missing --enable-macosapp):

    ./autogen.sh && ./configure \
    --with-app-name="Collabora Office" \
    --enable-experimental \
    --enable-debug \
    --with-vendor="Collabora Productivity" \
    --with-poco-includes=/opt/homebrew/opt/poco/include \
    --with-poco-libs=/opt/homebrew/opt/poco/lib \
    --with-zstd-includes=/opt/homebrew/include \
    --with-zstd-libs=/opt/homebrew/lib \
    --with-lo-path=/Users/kendy/Projects/lo/core/instdir/CollaboraOffice.app \
    --with-lokit-path=/Users/kendy/Projects/lo/core/include

Then open the macos/coolwsd.xcodeproj project in Xcode and you can build, run
and debug directly from Xcode.

# TODO

* configure.ac
    * add sanity check for the lo builddir when configuring with —enable-macosapp
    * MACOSAPP_FONTS
