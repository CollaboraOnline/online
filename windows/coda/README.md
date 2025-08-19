# Building CODA-W

## Requirements

For starters, the same requirements as for building LibreOffice, see
https://wiki.documentfoundation.org/Development/BuildingOnWindows as
you will do that as part of building CODA-W. Make sure to use Visual
Studio 2022. Using other Visual Studio versions for building the
online bits has not been tested.

In Visual Studio 2022, also install the .NET desktop development
components.

## Setup

Turn on WSL, the Windows Subsystem for Linux, and install a distro.
I use the default, Ubuntu, others presumably work, too. In an
administrator Command Prompt:
  
	wsl --install Ubuntu
  
In that Ubuntu, install various things that will be needed later. Most
of this is needed just to run the configure script in online. That
configure script checks for tons of things that are completely
irrelevant for CODA, but oh well. Patches welcome.

This is not necessarily a comprehensive list, you might notice more
missing things as you go along.
  
	sudo apt install libtool python3-lxml python3-polib g++ pkg-config 
	sudo apt install libpng-dev libzstd-dev libcppunit-dev libpam-dev

The following things are more essential, for bulding the JavaScript
stuff. This is the main reason we are using WSL.

	sudo apt install nodejs npm

## Build LibreOffice

Clone the git@gitlab.collabora.com:productivity/libreoffice/core.git
repo, the coda-25.04 branch.

Using an autogen.input like this is known to work:

```
--with-distro=CODAWindows
--with-visual-studio=2022
--enable-debug
--enable-msvc-debug-runtime
--enable-headless
--disable-ccache
--disable-opencl
--disable-pch
--without-doxygen
--without-lang
--without-lxml
```

The --with-distro, --with-visual-studio, and --enable-headless options
are essential. The other ones you can play with. Note that if you
build the CODA project in Visual Studio in the Debug configuration,
you *must* use a LibreOffice build with either --enable-dbgutil or
--enable-msvc-debug-runtime.

The LibreOffice build should proceed fairly normally. Note that you
will not end up with a runnable normal desktop LibreOffice. Attempting
to run instdir/program/soffice.exe will just produce the message "no
suitable windowing system found, exiting".

You can attempt to run "make check" but that will probably run into
some false positives.

The above is for a debug build, for a release build, a known to work autogen.input is:

```
--with-distro=CODAWindows
--with-visual-studio=2022
--enable-headless
--enable-mergelibs
--enable-symbols
--disable-ccache
--disable-opencl
--disable-pch
--without-doxygen
--without-galleries
--without-lang
--without-lxml
```

(The use of --disable-gallaries in the latter is not essential, could
be used in the debug one, too.)

### Buikding also LibreOffice using WSL

Apparently it should be possible nowadays to build LibreOffice core
for Windows using WSL, not Cygwin. That sounds like a great idea. But
I haven't tried it. Possibly it works only in the current master
branch, not in the coda-25.04 branch (which is based on the co-25.04
branch, which is based on master some year ago, as far as I know). But
if you experiment with it and notice that it works, by all means edit
this file.

Especialy when/if somebody would want or need to work on CODA on ARM64
Windows, it would be good to be able to manage without Cygwin, as
Cygwin is available only for x64 Windows.

## Build direct dependencies of CODA-W

Version numbers below are current at the time of writing this. Newer
versions will probably work, too. Except that online might not compile
against Poco 1.14, so use the newest 1.13.*. For zlib and libpng we
use the unpacked sources in the LibreOffice core build directory, and
the static libraries already built there.

## zstd

Download and unpack the zstd-1.5.7 tarball. Open the Visual Studio
solution zstd-1.5.7/build/VS2010/zstd.sln. Let Visual Studio retarget
the projects. It is enough to build just the libzstd project of the
solution.

The static libraries that you are interested end up as
zstd-1.5.7/build/VS2010/bin/x64\_Debug/libzstd\_static.lib and
zstd-1.5.7/build/VS2010/bin/x64\_Release/libzstd\_static.lib .

## Poco

Download and unpack the poco-poco-1.14.2-release.zip archive.

Then build it. Only a subset of it is needed. In a Ubuntu shell
window, run:

    powershell.exe -ExecutionPolicy Bypass -File buildwin.ps1 -action build -config both -linkmode static\_md -platform x64 -components Foundation,Util,JSON,Net,XML

Then move all the headers into one place:

	mkdir -p include/Poco
	cp -a Foundation/include/Poco/* include/Poco
	cp -a Util/include/Poco/* include/Poco
	cp -a JSON/include/Poco/* include/Poco
	cp -a Net/include/Poco/* include/Poco
	cp -a XML/include/Poco/* include/Poco

## Build CODA-W itself

Clone the git@gitlab.collabora.com:productivity/libreoffice/online.git
repo, the coda-25.04 branch.

In an Ubuntu shell, run

	./autogen.sh

then run the configure script. Like this to use release build of zstd
and LibreOffice core.

(You will automatically get the Debug libraries of Poco when building
a Debug configuration of the CODA project, and the Release libraries
in a Release configuration. There is some slightly questionable
#pragmas in <Poco/Foundation.h> to take care of that.)

	./configure --enable-windowsapp --with-app-name=CODA --with-lo-builddir=/mnt/c/cygwin64/home/tml/lo/core-gitlab-coda25-coda-release --with-lo-path='C:\cygwin64\home\tml\lo\core-gitlab-coda25-coda-release\instdir' --with-poco-includes=/mnt/c/Users/tml/poco-poco-1.14.2-release/include --with-poco-libs=/mnt/c/Users/tml/poco-poco-1.14.2-release/lib64 --with-zstd-includes=/mnt/c/Users/tml/zstd-1.5.7/lib --with-zstd-libs=/mnt/c/Users/tml/zstd-1.5.7/build/VS2010/bin/x64_Release --with-libpng-includes=/mnt/c/cygwin64/home/tml/lo/core-gitlab-coda25-coda-release/workdir/UnpackedTarball/libpng --with-libpng-libs=/mnt/c/cygwin64/home/tml/lo/core-gitlab-coda25-coda-release/workdir/LinkTarget/StaticLibrary --with-zlib-includes=/mnt/c/cygwin64/home/tml/lo/core-gitlab-coda25-coda-release/workdir/UnpackedTarball/zlib

Obviously, adapt as necessary to match your username and where you
built LibreOffice, zstd, and Poco.

Now you can build the JavaScript bits:

	(cd browser && make)

And then finally, open the windows/coda/CODA.sln solution in Visual Studio and build it.
