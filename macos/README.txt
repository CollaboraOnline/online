Building the CODA-M

Setup

* Instal node.js
    * brew install node
* Install poco
    * brew install poco
* zstd
    * brew install zstd
* missing from the iOS build instructions (needed for online.git)
    * brew install libtool
* install canvas to avoid error during build
    * NB. version 3.0 needed, it upgrades the API to fit the new node.js
    * npm install canvas@next

* Install and/or update the Command Line Tools for Xcode:
    * xcode-select --install
    * After that you might need to update them in System Settings > General > Software Updates
        * For some reason for me it lists both 15.3 and 16.0 there. As I have Xcode 16.0, I choose just that one.

Build LO

autogen.input:

    # Distro
    --with-distro=CPMacOS-LOKit
    
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
    --with-app-name="Collabora Office" \
    --enable-experimental \
    --with-vendor="Collabora Productivity" \
    --with-poco-includes=/opt/homebrew/opt/poco/include \
    --with-poco-libs=/opt/homebrew/opt/poco/lib \
    --with-zstd-includes=/opt/homebrew/include \
    --with-zstd-libs=/opt/homebrew/lib \
    --with-lo-path=/Users/kendy/Projects/lo/core/instdir \
    --with-lokit-path=/Users/kendy/Projects/lo/core/include

Build Collabora Online

* ( cd browser ; make )
* open Xcode's project macos/coda/coda.xcodeproj & build from there

TODO

* configure.ac
    * add sanity check for the lo builddir when configuring with —enable-macosapp
    * MACOSAPP_FONTS
