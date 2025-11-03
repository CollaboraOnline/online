# Building the CODA-M

The following instructions depend heavily on using Homebrew, as that makes the
managing the build requirements much easier. It is of course possible to avoid
it, and only depend on eg. self-built libpng, etc.

## Setup

* Instal node.js
    * brew install node
* Install poco
    * brew install poco
* zstd
    * brew install zstd
* for ./configure
    * brew install libtool
* zlib
    * brew install zlib
* libpng
    * brew install libpng
* cppunit
    * brew install cppunit

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

## Configure Collabora Online

    ./autogen.sh && ./configure \
    --enable-macosapp \
    --enable-experimental \
    --with-app-name="Collabora Office" \
    --with-app-package-name=com.yourpackage.name \
    --with-vendor="Your Name" \
    --with-poco-includes=/opt/homebrew/opt/poco/include \
    --with-poco-libs=/opt/homebrew/opt/poco/lib \
    --with-zstd-includes=/opt/homebrew/include \
    --with-zstd-libs=/opt/homebrew/lib \
    --with-libpng-includes=/opt/homebrew/include \
    --with-libpng-libs=/opt/homebrew/lib \
    --with-lo-path=path-to-lo-core/instdir/your-built-lo.app \
    --with-lokit-path=path-to-lo-core/include

Obbiously you need to change the path-to-lo-core and your-built-lo above to
match what you have. Also, on Intel Macs homebrew gets installed in
/usr/local, not /opt/homebrew; but you may prefer your own built versions of
POCO, libpng and zstd.

## Install branding (OPTIONAL)

Checkout online-branding, and install the branding like the following (please
update the paths to the core instdir and online repo):

./brand.sh ~/Projects/lo/core/instdir ../online/browser/dist 1

## Build the JavaScipt bits

Just run 'make' from the terminal.

## Build the Desktop Edition

Open the macos/coda/coda.xcodeproj project in Xcode and choose 'Build and Run current scheme'.

That's it!
