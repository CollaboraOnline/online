# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.63])

AC_INIT([coolwsd], [23.05.1.2], [https://github.com/CollaboraOnline/online/issues], [coolwsd], [https://collaboraonline.github.io/])
LT_INIT([shared, disable-static, dlopen])

AM_INIT_AUTOMAKE([1.10 foreign subdir-objects tar-pax -Wno-portability])

AC_CONFIG_MACRO_DIR([m4])

# We don't want to require pkg-config and PKG_CHECK_MODULES on macOS
m4_if(m4_esyscmd_s([uname -s]),Darwin,[m4_define([PKG_CHECK_MODULES],[])],[])

COOLWSD_VERSION_MAJOR=`echo $VERSION | awk -F. '{print $1}'`
COOLWSD_VERSION_MINOR=`echo $VERSION | awk -F. '{print $2}'`
COOLWSD_VERSION_MICRO=`echo $VERSION | awk -F. '{print $3}'`
COOLWSD_VERSION_NANO=`echo $VERSION | awk -F. '{print $4}'`

ANDROID_PACKAGE_VERSIONCODE=
if test "$enable_androidapp" = "yes"; then
    AC_MSG_CHECKING([for Android package versionCode])
    if test -z "$with_android_package_versioncode" -o "$with_android_package_versioncode" = "no"; then
        ANDROID_PACKAGE_VERSIONCODE="1"
        AC_MSG_RESULT([not set, using $ANDROID_PACKAGE_VERSIONCODE])
    else
        COOLWSD_VERSION_MAJOR=`echo $with_android_package_versioncode | awk -F. '{print $1}'`
        COOLWSD_VERSION_MINOR=`echo $with_android_package_versioncode | awk -F. '{print $2}'`
        COOLWSD_VERSION_MICRO=`echo $with_android_package_versioncode | awk -F. '{print $3}'`
        COOLWSD_VERSION_NANO=`echo $with_android_package_versioncode | awk -F. '{print $4}' | awk -F- '{print $1}'`

        ANDROID_PACKAGE_VERSIONCODE=`echo $with_android_package_versioncode | awk -F- '{print $2}'`
        AC_MSG_RESULT([$ANDROID_PACKAGE_VERSIONCODE])
    fi
fi
AC_SUBST(ANDROID_PACKAGE_VERSIONCODE)

COOLWSD_VERSION="$COOLWSD_VERSION_MAJOR.$COOLWSD_VERSION_MINOR.$COOLWSD_VERSION_MICRO.$COOLWSD_VERSION_NANO"

AC_SUBST([COOLWSD_VERSION_MAJOR])
AC_SUBST([COOLWSD_VERSION_MINOR])
AC_SUBST([COOLWSD_VERSION_MICRO])
AC_SUBST([COOLWSD_VERSION_NANO])
AC_SUBST([COOLWSD_VERSION])

AC_DEFINE_UNQUOTED([COOLWSD_VERSION],[["$COOLWSD_VERSION"]],[Collabora Online WebSocket server version])

# try to add a git hash for a version if we're developing
COOLWSD_VERSION_HASH="$COOLWSD_VERSION"
git_hash=`cd ${srcdir} && ( cat dist_git_hash 2> /dev/null || git log -1 --format=%h 2> /dev/null )`
if test "z$git_hash" != "z"; then
   COOLWSD_VERSION_HASH=$git_hash
fi
AC_SUBST([COOLWSD_VERSION_HASH])

AC_DEFINE_UNQUOTED([COOLWSD_VERSION_HASH],[["$COOLWSD_VERSION_HASH"]],[Collabora Online git hash if present])

AC_CONFIG_SRCDIR([wsd/COOLWSD.cpp])

AC_DEFINE_UNQUOTED([COOLWSD_BUILDCONFIG],[["$ac_configure_args"]],[Options passed to configure script])

# this is a dummy header, autoheader adds all entries to it
# don't include config_unused.h anywhere!
AC_CONFIG_HEADERS([config_unused.h])

# maintain config.h.in and config_version.h.in manually
# config.h.in is for configurable variables that are stable if configure parameters are unchanged
AC_CONFIG_HEADERS([config.h])
# config_version.h.in is for version/hash related variables
AC_CONFIG_HEADERS([config_version.h])

# Checks for programs.
AC_PROG_CXX
AC_PROG_CC
AC_PROG_LN_S

# override AC_PROG_CXX:
# avoid libtool from adding -rpath when linking
if test "$host_os" = "emscripten"; then
    hardcode_libdir_flag_spec=
    hardcode_libdir_flag_spec_CXX=
fi

AC_LANG_PUSH([C++])

AS_IF([test `uname -s` = Linux -a "$host_os" != "emscripten"],
      [AC_PATH_PROG([SETCAP], setcap,[],[/bin:/usr/bin:/sbin:/usr/sbin])]
       AS_IF([test -z "$SETCAP"],
       [AC_MSG_ERROR([The setcap command is needed. It might be in a package called libcap-progs.])]))

# check for python modules
for MODULE in lxml polib; do
    AC_MSG_CHECKING([for ${MODULE} for python3])
    if /usr/bin/env python3 -c "import ${MODULE}" 2> /dev/null ; then
        AC_MSG_RESULT([yes])
    else
        AC_MSG_RESULT([no])
        AS_IF([test `uname -s` = Linux -o `uname -s` = FreeBSD -o `uname -s`= Darwin],
              [AC_MSG_ERROR([${MODULE} for python3 is needed. It might be in a package called python3-${MODULE}.])],
              [AC_MSG_WARN([${MODULE} for python3 is needed. It might be in a package called python3-${MODULE}. But
               if you are building the JS bits on another (Linux) machine, that doesn't matter])])
    fi
done

# On some platforms, std::atomic needs a helper library
AC_MSG_CHECKING([for the need of -latomic])
AC_LINK_IFELSE([AC_LANG_SOURCE([
    #include <atomic>
    #include <cstdint>
    std::atomic<std::int64_t> v;
    int main() {
      return v;
    }
    ])],
               [AC_MSG_RESULT([No])],
               [AC_MSG_RESULT([Yes])
                LIBS="$LIBS -latomic"])

# Declare options
AC_ARG_ENABLE([debug],
              AS_HELP_STRING([--enable-debug],
                             [Enable debugging, link with debugging version of Poco libraries]))

AC_ARG_ENABLE([bundle],
              AS_HELP_STRING([--enable-bundle],
                             [Enable creating bundled JS and CSS even with --enable-debug]))

AC_ARG_ENABLE([debug-protocol],
    AS_HELP_STRING([--disable-debug-protocol],
        [Disables JS protocol logging by default, otherwise it is slaved to enable-debug.])
)

AC_ARG_ENABLE([browsersync],
              AS_HELP_STRING([--enable-browsersync],
                             [Don't copy files to the target directory but create the symlink to allow browsersync usage]))

AC_ARG_ENABLE([anonymization],
              AS_HELP_STRING([--enable-anonymization],
                             [Enable anonymization/obfuscation of user-data in logs]))

AC_ARG_ENABLE([iosapp],
              AS_HELP_STRING([--enable-iosapp],
                             [Use on a Mac where you will build the iOS app.]))

AC_ARG_WITH([wasm-fallback],
              AS_HELP_STRING([--with-wasm-fallback=<path>],
                             [Build a COOL where the client can fall back to a WASM implementation if the connection to the server fails.
                              The path is where the WASM build of Online was done.]))

AC_ARG_WITH([wasm-additional-files],
              AS_HELP_STRING([--with-wasm-additional-files=<path>],
                             [Add more files to the in-memory WASM file system in online.wasm in addition to the ones from the WASM
                              build of Collabora Office. The files will be available in the WASM in-memory file system as pathnames
                              stripping the initial prefix <path> where they are on the build system. For instance, if you give
                              --with-wasm-additional-files=$HOME/our-sample-docs, and there is a file $HOME/our-sample-docs/temp/test.docx,
                              that will be available in the online.wasm as /temp/test.docx.
                              NOTE: Temporarily for now, this option is mandatory and the additional files should contain a document
                              in the root called "sample.docx"]))

AC_ARG_WITH([iosapp-appicon],
              AS_HELP_STRING([--with-iosapp-appicon=<path>],
                             [Point to a directory containing an icon set to use instead of the default empty one.]))

AC_ARG_WITH([iosapp-fonts],
              AS_HELP_STRING([--with-iosapp-fonts=<path>],
                             [Point to a directory containing .ttf or .otf files to be bundled in the iOS app (and
                              thus installed on the device for use of the LO core code).]))

AC_ARG_WITH([app-branding],
              AS_HELP_STRING([--with-app-branding=<path>],
                             [Point to a directory containing a branding.css file and possibly other files it references,
                              to be bundled and used by the iOS app. The directory structure is copied to
                              "browser/dist/branding" and that directory ends upp in the app bundle as "branding".]))

AC_ARG_ENABLE([gtkapp],
              AS_HELP_STRING([--enable-gtkapp],
                             [Use in a tree where the only purpose is to build the gtk+ "app" that is supposed
                              to work similarly to the iOS app, from the JavaScript and the pseudo WebSocket
                              message plumbing point of view. See gtk/README.]))

AC_ARG_ENABLE(fuzzers,
    AS_HELP_STRING([--enable-fuzzers],
        [Enables building libfuzzer targets for fuzz testing. It is useful to enable this switch
         only in a separate build tree, since the switch disables the creation of a coolwsd
         binary. For best results: --with-sanitizer=address,undefined])
)

AC_ARG_ENABLE([androidapp],
              AS_HELP_STRING([--enable-androidapp],
                             [Use in a tree where the only purpose is to build the Android app that is supposed
                              to work similarly to the iOS app, from the JavaScript and the pseudo WebSocket
                              message plumbing point of view.]))

AC_ARG_ENABLE([android-google-play],
              AS_HELP_STRING([--enable-android-google-play],
                             [When enabled, the app encourages the user periodically to rate the app on Google Play Store.]))

AC_ARG_WITH(android-package-name,
            AS_HELP_STRING([--with-android-package-name="org.libreoffice.androidapp"],
                           [Set Android package name of the build.]),
,)

AC_ARG_WITH(android-package-versioncode,
            AS_HELP_STRING([--with-android-package-versioncode=6.7.8-23],
                           [Set the versionCode for the Android package.]),
,)

AC_ARG_WITH(android-abi,
            AS_HELP_STRING([--with-android-abi=x86_64],
                           [Allows specification of a concrete ABI that is to be built for, defaults to armeabi-v7a
                            (when only one build dir is provided in --with-lo-builddir) or to all 4 supported ABIs at
                            the same time (when there are more builddirs provided in --with-lo-builddir, separated
                            by colons).  The supported ABIs are: armeabi-v7a, arm64-v8a, x86 and x86_64.
                            Please note that you need to specify the parameters for --with-lo-builddir,
                            --with-poco-includes and --with-poco-libs in the order of armeabi-v7a:arm64-v8a:x86:x86_64.
                            For example, when you use --with-android-abi=x86_64,
                            you have to specify --with-lo-builddir=:::/path/to/x86-64/builddir]),
,)

AC_ARG_WITH([app-name],
              AS_HELP_STRING([--with-app-name=<name>],
                             [Set the user-visible name of the app you build.]))

AC_ARG_WITH([user-id],
              AS_HELP_STRING([--with-user-id=cool],
                             [Set the account name of the user required to run the app (outside debug mode).]))

AC_ARG_WITH([icon-theme],
              AS_HELP_STRING([--with-icon-theme=<path>],
                             [Path to custom icon theme (similar to browser/images).]))

AC_ARG_WITH(vendor,
    AS_HELP_STRING([--with-vendor="John the Builder"],
        [Set vendor of the build.]),
,)

AC_ARG_WITH(info-url,
    AS_HELP_STRING([--with-info-url="https://john-the-builder.org"],
        [Set the info url of the build.]),
,)

AC_ARG_WITH(welcome-url,
    AS_HELP_STRING([--with-welcome-url=<url>],
        [Set the welcome url of the build.]),
,)

AC_ARG_ENABLE([seccomp],
              AS_HELP_STRING([--disable-seccomp],
                             [Disable use of linux/seccomp.h header when kernel on target system does not support it.
                              Beware of the security consequences!]))
AC_ARG_WITH([lokit-path],
            AS_HELP_STRING([--with-lokit-path=<path>],
                           [Path to the "include" directory with the LibreOfficeKit headers]))

AC_ARG_WITH([lo-path],
            AS_HELP_STRING([--with-lo-path=<path>],
                           [Path to a working installation directory or instdir of LibreOffice]))

AC_ARG_WITH([lo-builddir],
            AS_HELP_STRING([--with-lo-builddir=<path>],
                           [Mandatory, and relevant, in a tree where building the iOS or Android app.
                            Path to a the build directory of the LibreOffice core source tree you want to use.
                            In case of macOS, you MUST manually edit the ios/Mobile.xcodeproj/project.pbxproj
                            file and change the references to "../ios-device" to refer to the corresponding
                            LibreOffice core source directory (which typically would be the same as the build
                            directory you specify with this option).
                            In case of Android, you can provide 2 builddirs
                            separated by a colon ':' - the first is for
                            armeabi-v7a, the second is for arm64-v8a]))

AC_ARG_WITH([logfile],
            AS_HELP_STRING([--with-logfile=<path>],
                           [Path to the location of the logfile.]))

AC_ARG_WITH([trace-event-file],
            AS_HELP_STRING([--with-trace-event-file=<path>],
                           [Path to the location of the Trace Event file.]))

AC_ARG_WITH([poco-includes],
            AS_HELP_STRING([--with-poco-includes=<path>],
                           [Path to the "include" directory with the Poco
                            headers.  If you are building for Android 64bit,
                            you need two, separated by a colon ':'.]))

AC_ARG_WITH([zstd-libs],
            AS_HELP_STRING([--with-zstd-libs=<path>],
                           [Path to the directory containing libzstd.a
                            libraries.  If you are building for Android 64bit,
                            you need two, separated by a colon ':'.]))

AC_ARG_WITH([zstd-includes],
            AS_HELP_STRING([--with-zstd-includes=<path>],
                           [Path to the "include" directory with the zstd
                            headers.  If you are building for Android 64bit,
                            you need two, separated by a colon ':'.]))

AC_ARG_WITH([poco-libs],
            AS_HELP_STRING([--with-poco-libs=<path>],
                           [Path to the "lib" directory with the Poco
                            libraries.  If you are building for Android 64bit,
                            you need two, separated by a colon ':'.]))

AC_ARG_WITH([libpng-includes],
            AS_HELP_STRING([--with-libpng-includes=<path>],
                           [Path to the "include" directory with the libpng
                            headers.  Not used on Android.]))

AC_ARG_WITH([libpng-libs],
            AS_HELP_STRING([--with-libpng-libs=<path>],
                           [Path to the "lib" directory with the libpng
                            libraries.  Not used on Android.]))

AC_ARG_WITH([cppunit-includes],
            AS_HELP_STRING([--with-cppunit-includes=<path>],
                           [Path to the "include" directory with the Cppunit headers]))

AC_ARG_WITH([cppunit-libs],
            AS_HELP_STRING([--with-cppunit-libs=<path>],
                           [Path to the "lib" directory with the Cppunit libraries]))

AC_ARG_ENABLE([ssl],
            AS_HELP_STRING([--disable-ssl],
                           [Compile without SSL support]))

AC_ARG_WITH([support-public-key],
            AS_HELP_STRING([--with-support-public-key=<public-key-name.pub>],
                [Implements signed key with expiration required for support. Targeted at Collabora Online Service Providers.]))

AC_ARG_WITH([max-connections],
            AS_HELP_STRING([--with-max-connections],
                           [Set the limit on the total number of client connections. Def: 20, Min: 3.]))

AC_ARG_WITH([max-documents],
             AS_HELP_STRING([--with-max-documents],
                           [Set the limit on the total number of documents. Def: 10, Min: 2.]))

AC_ARG_WITH([feedback-url],
            AS_HELP_STRING([--with-feedback-url=<url>],
                           [User feedback URL.]))

AC_ARG_WITH([infobar-url],
            AS_HELP_STRING([--with-infobar-url=<url>],
                           [Infobar URL.]))

AC_ARG_WITH([coverage],
             AS_HELP_STRING([--with-coverage=<gcov>],
                            [Enable a code-coverage method. Currently only gcov is supported (works with both gcc and clang).
                            Output HTML in gcov/ directory.]))

AC_ARG_WITH([sanitizer],
             AS_HELP_STRING([--with-sanitizer],
                           [Enable one or more compatible sanitizers. E.g. --with-sanitizer=address,undefined,leak]))

AC_ARG_ENABLE([logging-test-asserts],
                AS_HELP_STRING([--enable-logging-test-asserts],
                            [Enable logging of passing test assertions.]))

AC_ARG_WITH([compiler-plugins],
            AS_HELP_STRING([--with-compiler-plugins=<path>],
                [Experimental! Unlikely to work for anyone except Noel! Enable compiler plugins that will perform additional checks during
                 building.]))

AC_ARG_ENABLE([setcap],
            AS_HELP_STRING([--disable-setcap],
                          [Do not set capabilities on files. For packaging builds]))

AC_ARG_ENABLE([werror],
            AS_HELP_STRING([--disable-werror],
                          [Do not turn warnings into errors.]))

AC_ARG_ENABLE([cypress],
            AS_HELP_STRING([--enable-cypress],
                           [Enable cypress tests.]))

AC_ARG_ENABLE([tests],
            AS_HELP_STRING([--disable-tests],
                           [Do not build and run unit tests.]))

AC_ARG_WITH([help-url],
            AS_HELP_STRING([--with-help-url=<url>],
                [Set the base URL of the online help. Default is https://help.collaboraoffice.com/help.html?])
                [--without-help-url Help buttons of dialogs will be disabled, external help website will not be used.],,)

AC_ARG_WITH([dictionaries],
            AS_HELP_STRING([--with-dictionaries=<language list>],
                [List of supported languages of Writing Aids (spell checker, grammar checker, thesaurus, hyphenation)
                 on this instance. Allowing too many has negative effect on startup performance. Default: de_DE en_GB
                 en_US es_ES fr_FR it nl pt_BR pt_PT ru.]))

AC_ARG_ENABLE([feature-lock],
              AS_HELP_STRING([--enable-feature-lock],
                             [Enable control over which uno-commands/feature to lock.]))

AC_ARG_ENABLE([feature-restriction],
              AS_HELP_STRING([--enable-feature-restriction],
                             [Enable control over which uno-commands/feature to disable completely.]))

AC_ARG_ENABLE([experimental],
              AS_HELP_STRING([--enable-experimental],
                             [Enable experimental features and behavior]))


# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

ENABLE_DEBUG=false
ENABLE_DEBUG_PROTOCOL=false
ENABLE_BUNDLE=true
COOLWSD_LOGLEVEL="warning"
COOLWSD_LOG_TO_FILE="false"
COOLWSD_LOGFILE="/var/log/coolwsd.log"
COOLWSD_TRACEEVENTFILE="/var/log/coolwsd.trace.json"
COOLWSD_ANONYMIZE_USER_DATA=false
BROWSER_LOGGING="false"
debug_msg="secure mode: product build"
anonym_msg=""
ENABLE_EXPERIMENTAL=false
experimental_msg="disabled by default"
bundle_msg="using uglified bundled JS and CSS"
LOK_LOG_ASSERTIONS=0
log_asserts_msg="disabled"
AC_MSG_CHECKING([whether to enable debug build])
if test "$enable_debug" = "yes"; then
   AC_MSG_RESULT([yes])
   AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code and disable some security pieces])
   ENABLE_DEBUG=true
   ENABLE_DEBUG_PROTOCOL=true
   COOLWSD_LOGLEVEL="trace"
   COOLWSD_LOG_TO_FILE="true"
   COOLWSD_LOGFILE="/tmp/coolwsd.log"
   COOLWSD_TRACEEVENTFILE="/tmp/coolwsd.trace.json"
   COOLWSD_ANONYMIZE_USER_DATA=false
   BROWSER_LOGGING="true"
   debug_msg="low security debugging mode"

   AC_MSG_CHECKING([whether to bundle JS and CSS files])
   if test "$enable_bundle" != "yes"; then
      ENABLE_BUNDLE=false
      bundle_msg="using individual JS and CSS files"
      AC_MSG_RESULT([no ($bundle_msg)])
   else
      AC_MSG_RESULT([yes])
   fi

   AC_MSG_CHECKING([whether to enable log passing test assertions in debug build (default)])
   if test "$enable_logging_test_asserts" != "no"; then
      LOK_LOG_ASSERTIONS=1
      log_asserts_msg="enabled"
      AC_MSG_RESULT([yes (override with --disable-logging-test-asserts)])
    else
      AC_MSG_RESULT([no (to enable --enable-logging-test-asserts)])
    fi
else
    AC_MSG_RESULT([no (Release build)])
    AC_DEFINE([ENABLE_DEBUG],0,[Whether to compile in some extra debugging support code and disable some security pieces])
fi
AC_SUBST(ENABLE_DEBUG)
AC_SUBST(ENABLE_BUNDLE)
AC_SUBST(COOLWSD_LOGLEVEL)
AC_SUBST(COOLWSD_LOG_TO_FILE)
AC_SUBST(BROWSER_LOGGING)

if test "$enable_debug_protocol" = no; then
   ENABLE_DEBUG_PROTOCOL=false
fi
AC_SUBST(ENABLE_DEBUG_PROTOCOL)

ENABLE_BROWSERSYNC=
browsersync_msg="disabled: copy files to the target directory"
if test "$enable_browsersync" = "yes"; then
   ENABLE_BROWSERSYNC=true
   browsersync_msg="enabled: create symlinks in the target directory"
fi
AC_SUBST(ENABLE_BROWSERSYNC)

if test -n "$with_logfile" ; then
   COOLWSD_LOGFILE="$with_logfile"
fi
AC_SUBST(COOLWSD_LOGFILE)

if test -n "$with_trace_event_file" ; then
   COOLWSD_TRACEEVENTFILE="$with_trace_event_file"
fi
AC_SUBST(COOLWSD_TRACEEVENTFILE)
AC_DEFINE_UNQUOTED([COOLWSD_TRACEEVENTFILE], [["]$COOLWSD_TRACEEVENTFILE["]], [Destination for Trace Event output])

if test "$enable_anonymization" = "yes" ; then
   COOLWSD_ANONYMIZE_USER_DATA=true
   anonym_msg="anonymization of user-data is enabled"
fi
AC_DEFINE_UNQUOTED([COOLWSD_ANONYMIZE_USER_DATA],[$COOLWSD_ANONYMIZE_USER_DATA],[Enable permanent anonymization in logs])
AC_SUBST(COOLWSD_ANONYMIZE_USER_DATA)

if test "$enable_logging_test_asserts" = "yes" ; then
   LOK_LOG_ASSERTIONS=1
   log_asserts_msg="enabled"
fi
AC_DEFINE_UNQUOTED([LOK_LOG_ASSERTIONS],[$LOK_LOG_ASSERTIONS],[Enable logging of test assertions])
AC_SUBST(LOK_LOG_ASSERTIONS)

if test -z "$anonym_msg";  then
  anonym_msg="anonymization of user-data is disabled"
fi

if test "$enable_experimental" = "yes" ; then
  ENABLE_EXPERIMENTAL=true
  experimental_msg="enabled by default"
fi
AC_SUBST(ENABLE_EXPERIMENTAL)

dnl check for a file at a path with an env-var with a given suffix
AC_DEFUN([CHK_FILE_VAR], dnl env-var, suffix, file-to-match, msg
[
   if test -n "$[$1][$4]" -o "z[$4]" = "z"; then
       if test -f "$[$1][$4]/[$2]"; then
           AC_MSG_RESULT([$[$1]])
       else
           AC_MSG_ERROR([This is not a [$3] [$4] directory no: $[$1][$4]/[$2]])
       fi
   fi
]) dnl CHK_FILE_VAR

# macOS: When configuring for building the app itself, on macOS, we need these.
# But not when just configuring for building the JS on Linux, for copying over
# to the Mac.
# Android: We need these to setup the CMakeLists.txt properly.
LOBUILDDIR=
ANDROID_ABI="armeabi-v7a"
ANDROID_ABI_SPLIT="'armeabi-v7a'"
LOBUILDDIR_ARM64_V8A=
LOBUILDDIR_X86=
LOBUILDDIR_X86_64=
POCOINCLUDE=
POCOINCLUDE_ARM64_V8A=
POCOINCLUDE_X86=
POCOINCLUDE_X86_64=
POCOLIB=
POCOLIB_ARM64_V8A=
POCOLIB_X86=
POCOLIB_X86_64=
POCODEBUG=

ZSTDINCLUDE=
ZSTDINCLUDE_ARM64_V8A=
ZSTDINCLUDE_X86=
ZSTDINCLUDE_X86_64=
ZSTDLIB=
ZSTDLIB_ARM64_V8A=
ZSTDLIB_X86=
ZSTDLIB_X86_64=

CORE_VERSION_HASH=""
if test \( "$enable_iosapp" = "yes" -a `uname -s` = "Darwin" \) -o \( "$enable_androidapp" = "yes" \) -o "$host_os" = "emscripten" ; then
   if test "$enable_androidapp" = "yes" ; then
      AC_MSG_CHECKING([for Android ABI to build for])
      if test -n "$with_android_abi" ; then
         ANDROID_ABI=`echo $with_android_abi | sed 's/:/ /g'`
      else
         if echo "$with_lo_builddir" | grep -qs ':' ; then
            ANDROID_ABI="armeabi-v7a arm64-v8a x86 x86_64"
         fi
      fi
      ANDROID_ABI_SPLIT=`echo $ANDROID_ABI | sed "s/^/'/g;s/ /','/g;s/$/'/g"`
      AC_MSG_RESULT([$ANDROID_ABI])
   fi

   AC_MSG_CHECKING([for LibreOffice build tree to build against])
   if test -z "$with_lo_builddir"; then
      AC_MSG_ERROR([You MUST use the --with-lo-builddir option when configuring the mobile app build tree.])
   fi

   LOBUILDDIR="$with_lo_builddir"
   if test "$enable_androidapp" = "yes" ; then
      if echo "$LOBUILDDIR" | grep -qs ':' ; then
         LOBUILDDIR=`echo $with_lo_builddir | cut -d: -f1`
         LOBUILDDIR_ARM64_V8A=`echo $with_lo_builddir | cut -d: -f2`
         LOBUILDDIR_X86=`echo $with_lo_builddir | cut -d: -f3`
         LOBUILDDIR_X86_64=`echo $with_lo_builddir | cut -d: -f4`
      fi
   fi

   # Get the git hash of the core build
   CORE_VERSION_HASH=`cd $LOBUILDDIR && grep buildid instdir/program/setuprc | sed -e 's/buildid=//' -e 's/............................$//'`

   # Sanity check, just a random object file in the LibreOffice build tree
   if test \( "$enable_iosapp" = "yes" -a -f "$LOBUILDDIR/workdir/CxxObject/vcl/ios/iosinst.o" \) -o \( "$enable_androidapp" = "yes" -a -f "$LOBUILDDIR/workdir/LinkTarget/StaticLibrary/liblibpng.a" \) -o \( "$host_os" = "emscripten" -a -f "${LOBUILDDIR}/workdir/LinkTarget/StaticLibrary/liblibpng.a" \); then
       AC_MSG_RESULT([$LOBUILDDIR])
   else
       AC_MSG_ERROR([This is not a LibreOffice core build directory: $LOBUILDDIR])
   fi

   if test -n "$LOBUILDDIR_ARM64_V8A" ; then
      if test -f "$LOBUILDDIR_ARM64_V8A/workdir/LinkTarget/StaticLibrary/liblibpng.a" ; then
         AC_MSG_RESULT([$LOBUILDDIR_ARM64_V8A])
      else
         AC_MSG_ERROR([This is not a LibreOffice ARM64 core build directory: $LOBUILDDIR_ARM64_V8A])
      fi
   fi

   if test -n "$LOBUILDDIR_X86" ; then
      if test -f "$LOBUILDDIR_X86/workdir/LinkTarget/StaticLibrary/liblibpng.a" ; then
         AC_MSG_RESULT([$LOBUILDDIR_X86])
      else
         AC_MSG_ERROR([This is not a LibreOffice x86 core build directory: $LOBUILDDIR_X86])
      fi
   fi

   if test -n "$LOBUILDDIR_X86_64" ; then
      if test -f "$LOBUILDDIR_X86_64/workdir/LinkTarget/StaticLibrary/liblibpng.a" ; then
         AC_MSG_RESULT([$LOBUILDDIR_X86_64])
      else
         AC_MSG_ERROR([This is not a LibreOffice x86-64 core build directory: $LOBUILDDIR_X86_64])
      fi
   fi

   AC_MSG_CHECKING([for Poco include directory to build against])
   if test -z "$with_poco_includes"; then
      AC_MSG_ERROR([You MUST use the --with-poco-includes option when configuring the mobile app build tree.])
   fi

   POCOINCLUDE="$with_poco_includes"
   if test "$enable_androidapp" = "yes" ; then
      if echo "$POCOINCLUDE" | grep -qs ':' ; then
         POCOINCLUDE=`echo $with_poco_includes | cut -d: -f1`
         POCOINCLUDE_ARM64_V8A=`echo $with_poco_includes | cut -d: -f2`
         POCOINCLUDE_X86=`echo $with_poco_includes | cut -d: -f3`
         POCOINCLUDE_X86_64=`echo $with_poco_includes | cut -d: -f4`
      fi
   fi

   # Sanity checks
   CHK_FILE_VAR(POCOINCLUDE,Poco/Poco.h,Poco include)
   CHK_FILE_VAR(POCOINCLUDE,Poco/Poco.h,Poco include,_ARM64_V8A)
   CHK_FILE_VAR(POCOINCLUDE,Poco/Poco.h,Poco include,_X64)
   CHK_FILE_VAR(POCOINCLUDE,Poco/Poco.h,Poco include,_X86_64)

   AC_MSG_CHECKING([for Poco lib directory to build against])
   if test -z "$with_poco_libs"; then
      AC_MSG_ERROR([You MUST use the --with-poco-libs option when configuring the mobile app build tree.])
   fi

   POCOLIB="$with_poco_libs"
   if test "$enable_androidapp" = "yes" ; then
      if echo "$POCOLIB" | grep -qs ':' ; then
         POCOLIB=`echo $with_poco_libs | cut -d: -f1`
         POCOLIB_ARM64_V8A=`echo $with_poco_libs | cut -d: -f2`
         POCOLIB_X86=`echo $with_poco_libs | cut -d: -f3`
         POCOLIB_X86_64=`echo $with_poco_libs | cut -d: -f4`
      fi
   fi

   # Sanity checks
   CHK_FILE_VAR(POCOLIB,libPocoFoundation.a,Poco lib)
   CHK_FILE_VAR(POCOLIB,libPocoFoundation.a,Poco lib,_ARM64_V8A)
   CHK_FILE_VAR(POCOLIB,libPocoFoundation.a,Poco lib,_X64)
   CHK_FILE_VAR(POCOLIB,libPocoFoundation.a,Poco lib,_X86_X64)

   if test "$ENABLE_DEBUG" = "true" ; then
       POCODEBUG=d
   fi

   AC_MSG_CHECKING([for zstd lib directory to build against])
   if test -z "$with_zstd_libs"; then
      AC_MSG_ERROR([You MUST use the --with-zstd-libs option when configuring the mobile app build tree.])
   fi

   ZSTDINCLUDE="$with_zstd_includes"
   if test "$enable_androidapp" = "yes" ; then
      if echo "$ZSTDINCLUDE" | grep -qs ':' ; then
         ZSTDINCLUDE=`echo $with_zstd_includes | cut -d: -f1`
         ZSTDINCLUDE_ARM64_V8A=`echo $with_zstd_includes | cut -d: -f2`
         ZSTDINCLUDE_X86=`echo $with_zstd_includes | cut -d: -f3`
         ZSTDINCLUDE_X86_64=`echo $with_zstd_includes | cut -d: -f4`
      fi
   fi

   # Sanity checks
   CHK_FILE_VAR(ZSTDINCLUDE,zstd.h,Zstd include)
   CHK_FILE_VAR(ZSTDINCLUDE,zstd.h,Zstd include,_ARM64_V8A)
   CHK_FILE_VAR(ZSTDINCLUDE,zstd.h,Zstd include,_X64)
   CHK_FILE_VAR(ZSTDINCLUDE,zstd.h,Zstd include,_X86_64)

   ZSTDLIB="$with_zstd_libs"
   if test "$enable_androidapp" = "yes" ; then
      if echo "$ZSTDLIB" | grep -qs ':' ; then
         ZSTDLIB=`echo $with_zstd_libs | cut -d: -f1`
         ZSTDLIB_ARM64_V8A=`echo $with_zstd_libs | cut -d: -f2`
         ZSTDLIB_X86=`echo $with_zstd_libs | cut -d: -f3`
         ZSTDLIB_X86_64=`echo $with_zstd_libs | cut -d: -f4`
      fi
   fi

   CHK_FILE_VAR(ZSTDLIB,libzstd.a,Zstd lib)
   CHK_FILE_VAR(ZSTDLIB,libzstd.a,Zstd lib,_ARM64_V8A)
   CHK_FILE_VAR(ZSTDLIB,libzstd.a,Zstd lib,_X64)
   CHK_FILE_VAR(ZSTDLIB,libzstd.a,Zstd lib,_X86_64)
fi

AC_SUBST(LOBUILDDIR)
AC_SUBST(ANDROID_ABI)
AC_SUBST(ANDROID_ABI_SPLIT)
AC_SUBST(LOBUILDDIR_ARM64_V8A)
AC_SUBST(LOBUILDDIR_X86)
AC_SUBST(LOBUILDDIR_X86_64)
AC_SUBST(POCOINCLUDE)
AC_SUBST(POCOINCLUDE_ARM64_V8A)
AC_SUBST(POCOINCLUDE_X86)
AC_SUBST(POCOINCLUDE_X86_64)
AC_SUBST(POCOLIB)
AC_SUBST(POCOLIB_ARM64_V8A)
AC_SUBST(POCOLIB_X86)
AC_SUBST(POCOLIB_X86_64)
AC_SUBST(POCODEBUG)
AC_SUBST(ZSTDINCLUDE)
AC_SUBST(ZSTDINCLUDE_ARM64_V8A)
AC_SUBST(ZSTDINCLUDE_X86)
AC_SUBST(ZSTDINCLUDE_X86_64)
AC_SUBST(ZSTDLIB)
AC_SUBST(ZSTDLIB_ARM64_V8A)
AC_SUBST(ZSTDLIB_X86)
AC_SUBST(ZSTDLIB_X86_64)
AC_SUBST([CORE_VERSION_HASH])

AC_DEFINE_UNQUOTED([CORE_VERSION_HASH],[["$CORE_VERSION_HASH"]],[LibreOffice core git hash if present])

LIBPNG_INCLUDES="$with_libpng_includes"
LIBPNG_LIBS="$with_libpng_libs"

if test "$enable_iosapp" != yes -a "$enable_androidapp" != yes; then
   LOKIT_PATH=`readlink -f $with_lokit_path`
fi

if test "$enable_iosapp" = "yes" -o "$enable_androidapp" = "yes"; then
   if test -n "$LIBPNG_INCLUDES" ; then
      AC_MSG_ERROR([--with-libpng-includes is ignored on Android, please remove the parameter.])
   fi
   if test -n "$LIBPNG_LIBS" ; then
      AC_MSG_ERROR([--with-libpng-libs is ignored on Android, please remove the parameter.])
   fi
   if test -n "$LOKIT_PATH" ; then
      AC_MSG_ERROR([--with-lokit-path is ignored on Android, please remove the parameter.])
      LOKIT_PATH=`readlink -f $LOBUILDDIR/include`
   fi
fi
AC_SUBST(LIBPNG_INCLUDES)
AC_SUBST(LIBPNG_LIBS)
AC_SUBST(LOKIT_PATH)

ENABLE_ANDROIDAPP=
ANDROID_PACKAGE_NAME=
if test "$enable_androidapp" = "yes"; then
    ENABLE_ANDROIDAPP=true

    AC_MSG_CHECKING([for Android package name])
    if test -z "$with_android_package_name" -o "$with_android_package_name" = "no"; then
        ANDROID_PACKAGE_NAME="org.libreoffice.androidapp"
        AC_MSG_RESULT([not set, using $ANDROID_PACKAGE_NAME])
    else
        ANDROID_PACKAGE_NAME="$with_android_package_name"
        AC_MSG_RESULT([$ANDROID_PACKAGE_NAME])
    fi
fi
AC_SUBST(ENABLE_ANDROIDAPP)
AM_CONDITIONAL([ENABLE_ANDROIDAPP], [test "$ENABLE_ANDROIDAPP" = "true"])
AC_SUBST(ANDROID_PACKAGE_NAME)

APP_NAME="Collabora Online Development Edition"
if test -n "$with_app_name"; then
   APP_NAME="$with_app_name"
fi
AC_DEFINE_UNQUOTED([APP_NAME],["$APP_NAME"],[The user-visible name of the app you build.])
AC_SUBST(APP_NAME)

VENDOR=
AC_MSG_CHECKING([for vendor])
if test "$enable_iosapp" = yes -a -z "$with_vendor"; then
    AC_MSG_ERROR([You must use --with-vendor when configuring for the iOS app])
fi
if test -z "$with_vendor" -o "$with_vendor" = "no"; then
    VENDOR="$USERNAME"

    if test -z "$VENDOR"; then
        VENDOR="$USER"
    fi

    if test -z "$VENDOR"; then
        VENDOR="`id -u -n`"
    fi

    AC_MSG_RESULT([not set, using $VENDOR])
else
    VENDOR="$with_vendor"
    AC_MSG_RESULT([$VENDOR])
fi
AC_SUBST(VENDOR)

INFO_URL='https://collaboraonline.github.io/'
if test -n "$with_info_url" -a "$with_info_url" != "no"; then
    INFO_URL="$with_info_url"
fi
AC_SUBST(INFO_URL)

ENABLE_IOSAPP=
IOSAPP_BUNDLE_VERSION=

if test "$enable_iosapp" = "yes"; then
   ENABLE_IOSAPP=true

   if test -f BUNDLE-VERSION; then
       IOSAPP_BUNDLE_VERSION=$(cat BUNDLE-VERSION)
   else
       IOSAPP_BUNDLE_VERSION=1
   fi
   echo $IOSAPP_BUNDLE_VERSION >BUNDLE-VERSION
fi

AC_SUBST(ENABLE_IOSAPP)
AM_CONDITIONAL([ENABLE_IOSAPP], [test "$ENABLE_IOSAPP" = "true"])
AC_SUBST(IOSAPP_BUNDLE_VERSION)

AC_MSG_CHECKING([for custom icon theme])
CUSTOM_ICONS_DIRECTORY=
if test -d "$with_icon_theme"; then
    CUSTOM_ICONS_DIRECTORY=`readlink -f $with_icon_theme`
    AC_MSG_RESULT([$CUSTOM_ICONS_DIRECTORY])
else
    AC_MSG_RESULT([no])
fi
AC_SUBST(CUSTOM_ICONS_DIRECTORY)

ENABLE_GTKAPP=
if test "$enable_gtkapp" = "yes"; then
   ENABLE_GTKAPP=true
fi
AC_SUBST(ENABLE_GTKAPP)
AM_CONDITIONAL([ENABLE_GTKAPP], [test "$ENABLE_GTKAPP" = "true"])

dnl ENABLE_WASM_FALLBACK means we are building an otherwise normal COOL but with the "WASM fallback"
dnl capability. Compare to ENABLE_WASM.

AM_CONDITIONAL([ENABLE_WASM_FALLBACK], [test -n "$with_wasm_fallback"])
WASM_BUILDDIR="$with_wasm_fallback"
AC_SUBST(WASM_BUILDDIR)

dnl Temporary hack: We hardcode /sample.docx in a few places, so make sure that file is there
AS_IF(["$host_os" = "emscripten"],
      [AC_MSG_CHECKING([that temporarily there is a sample document with a fixed name])
      AS_IF([test -z "$with_wasm_additional_files"],
            [AC_MSG_ERROR([You must use the --with-wasm-additional-files option for now])])
      AS_IF([test ! -f "$with_wasm_additional_files/sample.docx"],
            [AC_MSG_ERROR([There must be a file called sample.docx in $with_wasm_additional_files for now])])
      AC_MSG_RESULT([yes])])

AM_CONDITIONAL([ENABLE_WASM_ADDITIONAL_FILES], [test -n "$with_wasm_additional_files"])
WASM_ADDITIONAL_FILES="$with_wasm_additional_files"
AC_SUBST(WASM_ADDITIONAL_FILES)

AS_IF([test -n "$WASM_ADDITIONAL_FILES" && test ! -d "$WASM_ADDITIONAL_FILES"],
      [AC_MSG_ERROR([No such directory "'"$WASM_ADDITIONAL_FILES"'"])])

dnl ENABLE_WASM means that we are building the WASM "app" that will run locally in the
dnl client when necessary. ENABLE_WASM_FALLBACK and ENABLE_WASM can't both be on simultaneously.

AM_CONDITIONAL([ENABLE_WASM], [test "$host_os" = "emscripten"])

MAX_CONNECTIONS=9999
AS_IF([test -n "$with_max_connections" && test "$with_max_connections" -gt "0"],
      [MAX_CONNECTIONS="$with_max_connections"])
AS_IF([test "$MAX_CONNECTIONS" -lt "3"],
      [MAX_CONNECTIONS="3"])
AC_DEFINE_UNQUOTED([MAX_CONNECTIONS],[$MAX_CONNECTIONS],[Limit the maximum number of open connections])
AC_SUBST(MAX_CONNECTIONS)

MAX_DOCUMENTS=9999
AS_IF([test -n "$with_max_documents" && test "$with_max_documents" -gt "0"],
      [MAX_DOCUMENTS="$with_max_documents"])
AS_IF([test "$MAX_DOCUMENTS" -gt "$MAX_CONNECTIONS"],
      [MAX_DOCUMENTS="$MAX_CONNECTIONS"])
AS_IF([test "$MAX_DOCUMENTS" -lt "2"],
      [MAX_DOCUMENTS="2"])
AC_DEFINE_UNQUOTED([MAX_DOCUMENTS],[$MAX_DOCUMENTS],[Limit the maximum number of open documents])
AC_SUBST(MAX_DOCUMENTS)

FEEDBACK_URL=

if test -n "$with_feedback_url"; then
   FEEDBACK_URL=$with_feedback_url
fi

AC_DEFINE_UNQUOTED([FEEDBACK_URL],["$FEEDBACK_URL"],[User feedback URL.])

INFOBAR_URL=
if test -n "$with_infobar_url"; then
   INFOBAR_URL=$with_infobar_url
fi

AC_DEFINE_UNQUOTED([INFOBAR_URL],["$INFOBAR_URL"],[Infobar URL.])

WELCOME_CONFIG_FRAGMENT=/dev/null
ENABLE_WELCOME_MESSAGE=0
WELCOME_URL=
if test -n "$with_welcome_url"; then
    WELCOME_URL=$with_welcome_url
    ENABLE_WELCOME_MESSAGE=1
else
    WELCOME_CONFIG_FRAGMENT=$srcdir/coolwsd-welcome.xml
fi

AC_SUBST_FILE([WELCOME_CONFIG_FRAGMENT])
AC_DEFINE_UNQUOTED([ENABLE_WELCOME_MESSAGE],$ENABLE_WELCOME_MESSAGE,[Should the Release notes message be shown on upgrade])
AM_CONDITIONAL([ENABLE_WELCOME_MESSAGE], [test "$ENABLE_WELCOME_MESSAGE" = "1"])
AC_DEFINE_UNQUOTED([WELCOME_URL],["$WELCOME_URL"],[The welcome url of the build.])

# Test for build environment

AS_IF([test "$ENABLE_GTKAPP" != true],
[CXXFLAGS="$CXXFLAGS -Wall -Wextra -Wshadow -Wundef"])

CFLAGS="$CFLAGS -Wall -Wextra"

AC_MSG_CHECKING([whether to turn warnings to errors])
if test -z "$enable_werror" -o "$enable_werror" = "yes"; then
    AC_MSG_RESULT([yes])
    CXXFLAGS="$CXXFLAGS -Werror"
    CFLAGS="$CFLAGS -Werror"
else
    AC_MSG_RESULT([no])
fi

# Code Coverage.
AC_MSG_CHECKING([whether code-coverage is enabled])
if test "x$with_coverage" != "x"; then
    AC_MSG_RESULT([yes ($with_coverage)])
    CODE_COVERAGE=1
    CXXFLAGS="$CXXFLAGS --coverage"
    CFLAGS="$CFLAGS --coverage"
    LDFLAGS="$LDFLAGS -Wl,--dynamic-list-data --coverage"
    coverage_msg="Code-Coverage is enabled"
else
    AC_MSG_RESULT([no])
    CODE_COVERAGE=0
    coverage_msg="Code-Coverage is disabled"
fi
AC_DEFINE_UNQUOTED([CODE_COVERAGE],[$CODE_COVERAGE],[Define to 1 if this is a code-coverage build.])
AM_CONDITIONAL([ENABLE_CODE_COVERAGE], [test "$CODE_COVERAGE" = "1"])

# Fuzzing.
AC_MSG_CHECKING([whether to build fuzzers])
if test "$enable_fuzzers" = "yes"; then
    AC_MSG_RESULT([yes])
    AC_MSG_CHECKING([whether sanitizers are enabled])
    if test "x$with_sanitizer" != "x"; then
    AC_MSG_RESULT([yes ($with_sanitizer)])
    with_sanitizer="$with_sanitizer,fuzzer-no-link"
    else
    AC_MSG_RESULT([no])
    with_sanitizer="fuzzer-no-link"
    fi
    LIBFUZZER=1
else
    AC_MSG_RESULT([no])
    LIBFUZZER=0
fi
AC_DEFINE_UNQUOTED([LIBFUZZER],[$LIBFUZZER],[Define to 1 if this is a libfuzzer build.])
AM_CONDITIONAL([ENABLE_LIBFUZZER], [test "$LIBFUZZER" = "1"])

# Sanitizers.
CXXFLAGS_CXXSTD=
AC_MSG_CHECKING([whether to turn sanitizers on])
if test "x$with_sanitizer" != "x"; then
    AC_MSG_RESULT([yes ($with_sanitizer)])
    LIBSAN=-static-libasan
    for flag in -static-libasan -static-libsan ; do
        AC_MSG_CHECKING([whether to use $flag])
        save_CXXFLAGS=$CXXFLAGS
        CXXFLAGS="$CXXFLAGS -O1 -fno-omit-frame-pointer -fsanitize=$with_sanitizer -frtti $flag -Werror"
        AC_LANG_PUSH([C++])
        AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[
            ]])],[CXXFLAGS_CXXSTD=$flag])
        AC_LANG_POP([C++])
        CXXFLAGS=$save_CXXFLAGS
        if test -n "$CXXFLAGS_CXXSTD"; then
            LIBSAN=$flag
            AC_MSG_RESULT([yes ($LIBSAN)])
            break
        else
            AC_MSG_RESULT([no])
        fi
    done
    SANITIZER_FLAGS="-O1 -fno-omit-frame-pointer -fsanitize=$with_sanitizer -frtti $LIBSAN"
    CXXFLAGS="$CXXFLAGS $SANITIZER_FLAGS"
    CFLAGS="$CFLAGS $SANITIZER_FLAGS"
else
    AC_MSG_RESULT([no])
fi

# Check for C++17 support.
HAVE_CXXSTD=
CXXFLAGS_CXXSTD=
AC_MSG_CHECKING([whether $CXX supports C++17])
for flag in -std=c++17 -std=c++1z ; do
    save_CXXFLAGS=$CXXFLAGS
    CXXFLAGS="$CXXFLAGS $flag -Werror"
    AC_LANG_PUSH([C++])
    AC_COMPILE_IFELSE([AC_LANG_PROGRAM([[
        #include <algorithm>
        #include <functional>
        #include <vector>
        void f(std::vector<int> & v, std::function<bool(int, int)> fn) {
            std::sort(v.begin(), v.end(), fn);
        }
        ]])],[CXXFLAGS_CXXSTD=$flag])
    AC_LANG_POP([C++])
    CXXFLAGS=$save_CXXFLAGS
    if test -n "$CXXFLAGS_CXXSTD"; then
        HAVE_CXXSTD=TRUE
        break
    fi
done
if test "$HAVE_CXXSTD" = TRUE; then
    AC_MSG_RESULT([yes ($CXXFLAGS_CXXSTD)])
else
    AC_MSG_RESULT([no])
    AC_MSG_ERROR(Compiler doesn't support C++17)
fi

# Check if we have clang, rather than gcc, which
# doesn't like -pthread on the linker command-line.
AC_MSG_CHECKING([whether the compiler is clang])
AC_COMPILE_IFELSE([AC_LANG_SOURCE([
    #if !defined(__clang__)
    #error not clang
    #endif
])],
                    [AC_MSG_RESULT([yes])
                    AC_DEFINE([HAVE_CLANG],1,[whether the C++ compiler is clang])],
                    [AC_MSG_RESULT([no])
                    AC_DEFINE([HAVE_CLANG],0,[whether the C++ compiler is clang])])
AM_CONDITIONAL([HAVE_CLANG], [test "$HAVE_CLANG" = "1"])

AS_IF([test "$ENABLE_GTKAPP" != true],
[CXXFLAGS="$CXXFLAGS $CXXFLAGS_CXXSTD"])

STD_FILESYSTEM=
if test "$HAVE_CXXSTD" = TRUE -a "$ENABLE_ANDROIDAPP" != "true" ; then
    save_CXXFLAGS=$CXXFLAGS
    CXXFLAGS="$CXXFLAGS -Werror"
    save_LIBS=$LIBS
    LIBS="$save_LIBS -lstdc++fs"
    AC_LANG_PUSH([C++])
    AC_LINK_IFELSE([AC_LANG_SOURCE([[
        #include <experimental/filesystem>
        int main()
        {
            if (!std::experimental::filesystem::temp_directory_path().empty())
                return 0;
            return 1;
        }
        ]])],[STD_FILESYSTEM=experimental])
    AC_LINK_IFELSE([AC_LANG_SOURCE([[
        #include <filesystem>
        int main()
        {
            if (!std::filesystem::temp_directory_path().empty())
                return 0;
            return 1;
        }
        ]])],[STD_FILESYSTEM=TRUE])
    AC_LANG_POP([C++])
    CXXFLAGS=$save_CXXFLAGS
    LIBS=$save_LIBS
fi

if test -n "$STD_FILESYSTEM" ; then
    LIBS="$LIBS -lstdc++fs"
    AC_DEFINE([HAVE_STD_FILESYSTEM],1,[Whether the used C++ has support for std::filesystem.])
    if test "$STD_FILESYSTEM" = "experimental" ; then
        AC_DEFINE([HAVE_STD_FILESYSTEM_EXPERIMENTAL],1,[Whether the std::filesystem is in the experimental header.])
    else
        AC_DEFINE([HAVE_STD_FILESYSTEM_EXPERIMENTAL],0,[Whether the std::filesystem is in the experimental header.])
    fi
else
    AC_DEFINE([HAVE_STD_FILESYSTEM],0,[Whether the used C++ has support for std::filesystem.])
    AC_DEFINE([HAVE_STD_FILESYSTEM_EXPERIMENTAL],0,[Whether the std::filesystem is in the experimental header.])
fi

SYS_RANDOM=
AC_LANG_PUSH([C++])
AC_LINK_IFELSE(
    [AC_LANG_SOURCE([[
    #include <sys/random.h>
    int main()
    {
        char buffer[8];
        getrandom(buffer, sizeof(buffer), GRND_NONBLOCK);
    }
    ]])],
    [SYS_RANDOM=TRUE])
AC_LANG_POP([C++])

if test "$SYS_RANDOM" == "TRUE" ; then
    AC_DEFINE([HAVE_SYS_RANDOM_H],1,[Define to 1 if you have the <sys/random.h> header file.])
else
    AC_DEFINE([HAVE_SYS_RANDOM_H],0,[Define to 1 if you have the <sys/random.h> header file.])
fi

AS_IF([test -n "$LOKIT_PATH"],
      [CPPFLAGS="$CPPFLAGS -I${LOKIT_PATH}"])
lokit_msg="$LOKIT_PATH"

AS_IF([test "$ENABLE_IOSAPP" != "true" -a "$ENABLE_ANDROIDAPP" != "true"],
      [AC_MSG_CHECKING([for LibreOffice path])
      if test -n "$with_lo_path"; then
          # strip trailing '/' from LO_PATH, 'ln -s' with such path will otherwise fail
          LO_PATH="${with_lo_path%/}"
          AC_MSG_RESULT([found])
      else
          AC_MSG_RESULT([not found])
          AS_IF([test "$enable_fuzzers" != "yes"],
                [AC_MSG_ERROR([LibreOffice path must be configured: --with-lo-path])])
      fi
      ])

JAIL_PATH=not-set
SYSTEMPLATE_PATH=not-set
have_lo_path=false
AC_MSG_CHECKING([whether to run tests against a LibreOffice])
version_file="$with_lo_path/program/versionrc"
if test -f $version_file; then
    JAILS_PATH="\${abs_top_builddir}/jails"
    SYSTEMPLATE_PATH="\${abs_top_builddir}/systemplate"
    have_lo_path=true
    lo_msg="test against $LO_PATH"
    AC_MSG_RESULT([yes])
else
    lo_msg="no integration tests"
    AC_MSG_RESULT([no])
fi

AC_SUBST(LO_PATH)
AC_DEFINE_UNQUOTED([LO_PATH],["$LO_PATH"],[Path to LibreOffice installation])
AC_SUBST(JAILS_PATH)
AC_SUBST(SYSTEMPLATE_PATH)
AM_CONDITIONAL(HAVE_LO_PATH,[test "$have_lo_path" = "true"])

AS_IF([test -n "$with_poco_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_poco_includes}"])

AS_IF([test -n "$with_poco_libs"],
      [LDFLAGS="$LDFLAGS -L${with_poco_libs}"])

AS_IF([test -n "$with_zstd_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_zstd_includes}"])

AS_IF([test -n "$with_zstd_libs"],
      [LDFLAGS="$LDFLAGS -L${with_zstd_libs}"])

AS_IF([test -n "$LIBPNG_INCLUDES"],
      [CPPFLAGS="$CPPFLAGS -isystem ${LIBPNG_INCLUDES}"])

AS_IF([test -n "$LIBPNG_LIBS"],
      [LDFLAGS="$LDFLAGS -L${LIBPNG_LIBS}"])

AS_IF([test -n "$with_cppunit_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_cppunit_includes}"])

AS_IF([test -n "$with_cppunit_libs"],
      [LDFLAGS="$LDFLAGS -L${with_cppunit_libs}"])

AS_IF([test \( `uname -s` = Linux -o `uname -s` = FreeBSD \) -a "$host_os" != "emscripten"],
      [AS_IF([test -n "$with_poco_libs" -a -f "$with_poco_libs/libPocoFoundation.so"],
             [LDFLAGS="$LDFLAGS -Wl,-rpath,${with_poco_libs}"])])

AS_IF([test \( `uname -s` = Linux -o `uname -s` = FreeBSD \) -a "$host_os" != "emscripten"],
      [AS_IF([test -n "$with_cppunit_libs"],
             [LDFLAGS="$LDFLAGS -Wl,-rpath,${with_cppunit_libs}"])])

AS_IF([test `uname -s` != Darwin],
      [AC_SEARCH_LIBS([dlopen],
                      [dl dld],
                      [],
                      [AC_MSG_ERROR([dlopen not found])])])

AS_IF([test "$ENABLE_IOSAPP" != "true" -a "$ENABLE_ANDROIDAPP" != "true" -a "$host_os" != "emscripten"],
      [PKG_CHECK_MODULES([PNG], [libpng])
dnl    deflated HTTP / web-page serving
       PKG_CHECK_MODULES([ZLIB], [zlib])
dnl    tile compression
       PKG_CHECK_MODULES([ZSTD], [libzstd >= 1.4.0])

       PKG_CHECK_MODULES([CPPUNIT], [cppunit])
       ])

AS_IF([test `uname -s` = Linux -a "$ENABLE_ANDROIDAPP" != "true" -a "$host_os" != "emscripten"],
      [AC_SEARCH_LIBS([cap_get_proc],
                      [cap],
                      [],
                      [AC_MSG_ERROR([libcap not available?])])])

AS_IF([test "$ENABLE_GTKAPP" = true],
      [PKG_CHECK_MODULES([WEBKIT],[webkit2gtk-4.0])])

AM_CONDITIONAL([ENABLE_DEBUG], [test "$ENABLE_DEBUG" = "true"])

mobile_app=
ENABLE_MOBILEAPP=
MOBILEAPP=0
AC_MSG_CHECKING([Is this a mobile app])
if test "$enable_gtkapp" = "yes" -o "$enable_iosapp" = "yes" -o "$enable_androidapp" = "yes" -o "$host_os" = "emscripten" ; then
     AC_MSG_RESULT([Yes])
     mobile_app=true;
     MOBILEAPP=1
     ENABLE_MOBILEAPP=true
else
     AC_MSG_RESULT([No])
fi
AC_DEFINE_UNQUOTED([MOBILEAPP],[$MOBILEAPP],[Define to 1 if this is a mobileapp (eg. Android) build.])
AC_SUBST(ENABLE_MOBILEAPP)
AM_CONDITIONAL([ENABLE_MOBILEAPP], [test "$ENABLE_MOBILEAPP" = "true"])

if test "$host_os" = "emscripten" ; then
    ENABLE_EMSCRIPTENAPP=true
fi
AC_SUBST(ENABLE_EMSCRIPTENAPP)

ENABLE_SSL=true
if test "$enable_ssl" != "no" -a "$mobile_app" != "true"; then
   ssl_msg="ssl enabled"
   ENABLE_SSL=true
   AC_DEFINE([ENABLE_SSL],1,[Whether to enable SSL])
else
   if test "$mobile_app" != "true"; then
     ssl_msg="insecure: ssl disabled"
   else
     ssl_msg="invalid for mobile apps (disabled)"
   fi
   ENABLE_SSL=false
   AC_DEFINE([ENABLE_SSL],0,[Whether to enable SSL])
fi
AM_CONDITIONAL([ENABLE_SSL], [$ENABLE_SSL])
AC_SUBST(ENABLE_SSL)

AS_IF([test "$ENABLE_ANDROIDAPP" != "true" -a "$host_os" != "emscripten"],
      [AC_CHECK_HEADERS([security/pam_appl.h],
                        [],
                        [AC_MSG_ERROR([header security/pam_appl.h not found, install PAM development package])])
       AC_CHECK_LIB(pam, pam_start, [], [AC_MSG_ERROR([No. Install PAM development package])])])

AC_MSG_CHECKING([whether to build with support public key])
if test "x$with_support_public_key" != "x"; then
    AC_DEFINE([ENABLE_SUPPORT_KEY],1,[Whether to enable support key])

    # generate the public key include
    echo -e "#ifndef INCLUDED_SUPPORT_PUBLIC_KEY_HPP\n#define INCLUDED_SUPPORT_PUBLIC_KEY_HPP\n#include <string>\nconst static std::string SUPPORT_PUBLIC_KEY(" > "${srcdir}/common/support-public-key.hpp"
    sed 's/\(.*\)/"\1\\n"/' "$with_support_public_key" >> "${srcdir}/common/support-public-key.hpp"
    echo -e ");\n#endif" >> "${srcdir}/common/support-public-key.hpp"
    AC_MSG_RESULT([yes])
else
    AC_DEFINE([ENABLE_SUPPORT_KEY],0,[Whether to enable support key])
    rm -f "${srcdir}/common/support-public-key.hpp"
    AC_MSG_RESULT([no])
fi
AC_SUBST(ENABLE_SUPPORT_KEY)

if test "$host_os" != "emscripten"; then
    LIBS="$LIBS -lPocoNetSSL${POCO_DEBUG_SUFFIX} -lPocoNet${POCO_DEBUG_SUFFIX} -lPocoUtil${POCO_DEBUG_SUFFIX} -lPocoJSON${POCO_DEBUG_SUFFIX} -lPocoXML${POCO_DEBUG_SUFFIX} -lPocoFoundation${POCO_DEBUG_SUFFIX} -lPocoCrypto${POCO_DEBUG_SUFFIX}"
fi

AS_IF([test "$ENABLE_SSL" = "true"],
      [LIBS="$LIBS -lssl -lcrypto"])

AS_IF([test "$ENABLE_IOSAPP" != "true" -a "$ENABLE_ANDROIDAPP" != "true" -a "$host_os" != "emscripten"],
      [AC_CHECK_HEADERS([LibreOfficeKit/LibreOfficeKit.h],
                        [],
                        [AC_MSG_ERROR([header LibreOfficeKit/LibreOfficeKit.h not found, perhaps you want to use --with-lokit-path])])
       AC_CHECK_HEADERS([Poco/Net/WebSocket.h],
                        [],
                        [AC_MSG_ERROR([header Poco/Net/WebSocket.h not found, perhaps you want to use --with-poco-includes])])
       DISABLE_SECCOMP=
       if test "$enable_seccomp" != "no" -a `uname -s` = "Linux"; then
           AC_CHECK_HEADERS([linux/seccomp.h],
                            [],
                            [AC_MSG_ERROR([critical security header linux/seccomp.h not found. If kernel on target system does not support SECCOMP, you can use --disable-seccomp, but mind the security consequences.])])
           AC_DEFINE([DISABLE_SECCOMP],0,[Whether to disable SECCOMP])
       else
           AC_DEFINE([DISABLE_SECCOMP],1,[Whether to disable SECCOMP])
       fi

       PKG_CHECK_MODULES([OPENSSL], [openssl])
       AC_MSG_CHECKING([Whether OpenSSL has PKCS5_PBKDF2_HMAC()])
       AC_COMPILE_IFELSE([AC_LANG_SOURCE([
       #include <openssl/opensslv.h>
       #if OPENSSL_VERSION_NUMBER < 0x10001000L
       #error PKCS5_PBKDF2_HMAC() is in OpenSSL 1.0.1 or newer
       #endif
       ])],
                         [AC_MSG_RESULT([yes])
                          AC_DEFINE([HAVE_PKCS5_PBKDF2_HMAC],1,[whether OpenSSL has PKCS5_PBKDF2_HMAC()])],
                         [AC_MSG_RESULT([no])
                          AC_MSG_WARN([OpenSSL is too old. Secure password storage for Admin Console is not supported.])
                          AC_DEFINE([HAVE_PKCS5_PBKDF2_HMAC],0,[Whether OpenSSL has PKCS5_PBKDF2_HMAC()])])

       AC_MSG_CHECKING([POCO version])
       AC_COMPILE_IFELSE([AC_LANG_SOURCE([
       #include <Poco/Version.h>
       #if POCO_VERSION < 0x01070100
       #error Require Poco 1.7.1 or newer
       #endif
       ])],
                         [AC_MSG_RESULT([OK])],
                         [AC_MSG_ERROR([The POCO version is too old])])

       # If poco is built with --unbundled, it uses the system pcre library
       AC_MSG_CHECKING([If we need to link with -lpcre])
       AC_LINK_IFELSE([AC_LANG_SOURCE([
       #include <Poco/RegularExpression.h>
       int main(int argc, char **argv)
       {
           (void)argc;
           Poco::RegularExpression e("abc.[def]");
           Poco::RegularExpression::Match m;
           return e.match(argv[[1]], m);
       }
       ])],
                      [AC_MSG_RESULT([No])],
                      [AC_MSG_RESULT([Yes])
                       LIBS="$LIBS -lpcre"])

       ])

AS_IF([test `uname -s` = "Linux" -o `uname -s` = "FreeBSD" -o `uname -s` = "Darwin"],
      # We need npm and node unconditionally only on Linux, both in the normal Online case, and when
      # only building cool for the iOS app. When building the iOS app itself on macOS, this is
      # optional. If node and npm are not available, cool will have to be built on a Linux box.
      [AC_PATH_PROG(NODE, node, no)
       if test "$NODE" = "no"; then
           if test `uname -s` = "Darwin"; then
               AC_MSG_WARN([The cool bits will have to be built on a Linux machine and copied over])
           else
               AC_MSG_ERROR([node required to build cool, but not installed])
           fi
       else
           NODE_VER=`node --version | sed 's/^v//' | awk -F. '{ print (($1 * 100) + $2) * 100 + $3;}'`
           if test "$NODE_VER" -lt 100000; then
               AC_MSG_ERROR([This node version is old, upgrade to >= 10.0.0])
           fi
       fi

       if test "$NODE" != "no"; then
           AC_PATH_PROG(NPM, npm, no)
           if test "$NPM" = "no"; then
               AC_MSG_ERROR([npm required to build cool, but not installed])
           else
               NPM_VER=`npm -v | awk -F. '{ print (($1 * 100) + $2) * 100 + $3;}'`
               if test "$NPM_VER" -lt 50000; then
                   AC_MSG_ERROR([This npm version is too old, upgrade to >= 5.0.0])
               fi
           fi
       fi

       if test "$enable_cypress" = "yes"; then
           AC_PATH_PROGS(CHROME, chromium chromium-browser chrome google-chrome, no)
           if test "$CHROME" = "no"; then
               AC_MSG_ERROR([chrome or chromium is required to run the JS tests, but not installed])
           fi
       fi
       ])

AS_IF([test `uname -s` = "FreeBSD"],
      AC_CHECK_LIB(iconv, libiconv_open, [], [AC_MSG_ERROR([No. Install 3rd-party libiconv.])]))

AS_IF([test `uname -s` = "FreeBSD"],
      [LIBS="$LIBS -lexecinfo -lz -liconv"])

# need this after the other stuff that uses the compiler because we don't want to run configure-tests with the plugins enabled
AS_IF([test -n "$with_compiler_plugins"],
      [CPPFLAGS="$CPPFLAGS -Xclang -load -Xclang ${with_compiler_plugins}/compilerplugins/obj/plugin.so -Xclang -add-plugin -Xclang loplugin -Xclang -plugin-arg-loplugin -Xclang --cool-base-path=\${abs_top_srcdir}"])

COOLWSD_CONFIGDIR=${sysconfdir}/${PACKAGE}
AC_SUBST(COOLWSD_CONFIGDIR)

COOLWSD_DATADIR=${datadir}/${PACKAGE}
AC_SUBST(COOLWSD_DATADIR)

COOL_USER_ID="cool"
if test -n "$with_user_id"; then
   COOL_USER_ID="$with_user_id"
fi
AC_DEFINE_UNQUOTED([COOL_USER_ID],["$COOL_USER_ID"],[The user-name which is allowed to run coolwsd and its tools])

AM_CONDITIONAL([ENABLE_SETCAP], [test "$enable_setcap" != "no" -a `uname -s` = "Linux" -a "$enable_fuzzers" != "yes" -a "$host_os" != "emscripten"])

ENABLE_SETCAP=
if test "$enable_setcap" != "no" -a `uname -s` = "Linux" -a "$enable_fuzzers" != "yes" -a "$host_os" != "emscripten"; then
    ENABLE_SETCAP=true
    setcap_msg="setcap enabled"
else
    setcap_msg="setcap disabled"
fi

AC_SUBST(ENABLE_SETCAP)

AC_CONFIG_LINKS([discovery.xml:discovery.xml])
AC_CONFIG_LINKS([browser/package.json:browser/package.json])
AC_CONFIG_LINKS([cypress_test/package.json:cypress_test/package.json])
AC_CONFIG_COMMANDS_PRE([
if test "$srcdir" != '.'; then
   dst_dirs="cypress_test/plugins cypress_test/eslint_plugin browser/archived-packages"
   src_dir=
   dir_name=
   for dst_dir in $dst_dirs
   do
       dirname=`dirname -- "$dst_dir"`
       mkdir -p $dirname ||
             as_fn_error $? "cannot create directory $dirname"

       rm -f "$dst_dir"
       src_dir=$srcdir/$dst_dir
       echo "linking $src_dir to $dst_dir"
       ln -s "$src_dir" "$dst_dir" 2>/dev/null ||
          ln "$src_dir" "$dst_dir" 2>/dev/null ||
             cp -p "$src_dir" "$dst_dir" ||
                as_fn_error $? "cannot link or copy $src_dir to $dst_dir"
   done
fi])

APP_BRANDING_DIR=
APP_IC_LAUNCHER="ic_launcher"
APP_HAS_BRANDING="false"
if test "$with_app_branding" != no -a -d "$with_app_branding"; then
    APP_BRANDING_DIR="$with_app_branding"
    APP_IC_LAUNCHER="ic_launcher_brand"
    APP_HAS_BRANDING="true"
fi
AC_SUBST(APP_BRANDING_DIR)
AC_SUBST(APP_IC_LAUNCHER)
AC_SUBST(APP_HAS_BRANDING)

APP_GOOGLE_PLAY="false"
if test "$enable_android_google_play" = "yes"; then
    APP_GOOGLE_PLAY="true"
fi
AC_SUBST(APP_GOOGLE_PLAY)

AS_IF([test "$ENABLE_IOSAPP" = "true"],
      [
       if test `uname -s` = "Darwin"; then
          IOSAPP_FONTS=''
          mkdir -p ios/Mobile/Fonts
          if test "$with_iosapp_fonts" != no -a -d "$with_iosapp_fonts"; then
              AC_MSG_NOTICE([copying fonts to be bundled])
              IOSAPP_FONTS=`find "$with_iosapp_fonts" -type f |
                            while read fname; do
                               cp "$fname" ios/Mobile/Fonts
                               echo '<string>Fonts/'$(basename $fname)'</string>'
                            done`
          fi
          rm -rf ios/Mobile/Branding
          mkdir ios/Mobile/Branding
          if test -n "$APP_BRANDING_DIR" ; then
              AC_MSG_NOTICE([copying branding files])
              mkdir -p ios/Mobile/Branding
              (cd "$APP_BRANDING_DIR" && tar cf - .) | (cd ios/Mobile/Branding && tar xf -)
          else
              # A Branding/branding.css file must exist, it is
              # referenced unconditionally in cool.html in the
              # iOS app.
              touch ios/Mobile/Branding/branding.css
          fi
          cp coolkitconfig-mobile.xcu ios/Mobile/coolkitconfig.xcu
       fi
      ])
AC_SUBST(IOSAPP_FONTS)

AC_CHECK_FUNCS(ppoll)

ENABLE_CYPRESS=false
if test "$enable_cypress" = "yes"; then
   cypress_msg="cypress is enabled"
   ENABLE_CYPRESS=true
else
   cypress_msg="cypress is disabled"
   ENABLE_CYPRESS=false
fi
AM_CONDITIONAL([ENABLE_CYPRESS], [$ENABLE_CYPRESS])

ENABLE_TESTS=true
if test "$enable_tests" = "no"; then
    ENABLE_TESTS=false
else
    ENABLE_TESTS=true
fi
AM_CONDITIONAL([ENABLE_TESTS], [$ENABLE_TESTS])


AC_MSG_CHECKING([for URL of online help])
if test -n "$with_help_url" -a "$with_help_url" != "no"; then
    HELP_URL="$with_help_url"
    AC_MSG_RESULT([custom: $HELP_URL])
elif test "$with_help_url" = "no"; then
    HELP_URL=
    AC_MSG_RESULT([none, help buttons are disabled])
else
    HELP_URL="https://help.collaboraoffice.com/help.html?"
    AC_MSG_RESULT([default: $HELP_URL])
fi
AC_SUBST(HELP_URL)
AC_DEFINE_UNQUOTED([HELP_URL],["$HELP_URL"],[Default value of help root URL])

AC_MSG_CHECKING([for allowed languages for Writing Aids])
if test -n "$with_dictionaries" -a "$with_dictionaries" != "no"; then
    ALLOWED_LANGUAGES="$with_dictionaries"
else
    ALLOWED_LANGUAGES="de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru"
fi

AS_IF([test "$enable_feature_lock" = "yes"],
      [AC_DEFINE([ENABLE_FEATURE_LOCK],1,[Whether to compile and enable feature locking])],
      [AC_DEFINE([ENABLE_FEATURE_LOCK],0,[Whether to compile and enable feature locking])])

LOCKED_COMMANDS=
if test "$enable_feature_lock" = "yes"; then
    LOCKED_COMMANDS=".uno:DataDataPilotRun .uno:RecalcPivotTable \
.uno:DeletePivotTable .uno:SamplingDialog .uno:DescriptiveStatisticsDialog \
.uno:AnalysisOfVarianceDialog .uno:CorrelationDialog .uno:CovarianceDialog \
.uno:ExponentialSmoothingDialog .uno:MovingAverageDialog .uno:RegressionDialog \
.uno:TTestDialog .uno:FTestDialog .uno:ZTestDialog .uno:ChiSquareTestDialog \
.uno:FourierAnalysisDialog .uno:Validation .uno:DataFilterSpecialFilter \
.uno:TrackChanges .uno:AcceptTrackedChanges .uno:InsertReferenceField \
.uno:Watermark .uno:InsertIndexesEntry \
.uno:InsertMultiIndex .uno:SlideMasterPage exportepub downloadas-rtf masterslidebutton"
fi
AC_DEFINE_UNQUOTED([LOCKED_COMMANDS],["$LOCKED_COMMANDS"],[Default value of feature_lock.locked_commands])
AC_SUBST(LOCKED_COMMANDS)

UNLOCK_TITLE=
if test "$enable_feature_lock" = "yes"; then
    UNLOCK_TITLE="Unlock your potential"
fi
AC_DEFINE_UNQUOTED([UNLOCK_TITLE],["$UNLOCK_TITLE"],[Default value of feature_lock.unlock_title])
AC_SUBST(UNLOCK_TITLE)

UNLOCK_LINK=
if test "$enable_feature_lock" = "yes"; then
    UNLOCK_LINK="https://www.collaboraoffice.com/subscriptions/"
fi
AC_DEFINE_UNQUOTED([UNLOCK_LINK],["$UNLOCK_LINK"],[Default value of feature_lock.unlock_link])
AC_SUBST(UNLOCK_LINK)

UNLOCK_DESCRIPTION=
if test "$enable_feature_lock" = "yes"; then
    UNLOCK_DESCRIPTION="Head over to the details page and discover all the features:"
fi
AC_DEFINE_UNQUOTED([UNLOCK_DESCRIPTION],["$UNLOCK_DESCRIPTION"],[Default value of feature_lock.unlock_description])
AC_SUBST(UNLOCK_DESCRIPTION)

WRITER_UNLOCK_HIGHLIGHTS=
if test "$enable_feature_lock" = "yes"; then
    WRITER_UNLOCK_HIGHLIGHTS="Review and write with ease"
fi
AC_DEFINE_UNQUOTED([WRITER_UNLOCK_HIGHLIGHTS],["$WRITER_UNLOCK_HIGHLIGHTS"],[Default value of feature_lock.writer_unlock_highlights])
AC_SUBST(WRITER_UNLOCK_HIGHLIGHTS)

CALC_UNLOCK_HIGHLIGHTS=
if test "$enable_feature_lock" = "yes"; then
    CALC_UNLOCK_HIGHLIGHTS="Get a better picture of your data"
fi
AC_DEFINE_UNQUOTED([CALC_UNLOCK_HIGHLIGHTS],["$CALC_UNLOCK_HIGHLIGHTS"],[Default value of feature_lock.calc_unlock_highlights])
AC_SUBST(CALC_UNLOCK_HIGHLIGHTS)

IMPRESS_UNLOCK_HIGHLIGHTS=
if test "$enable_feature_lock" = "yes"; then
    IMPRESS_UNLOCK_HIGHLIGHTS="Nail your next presentation"
fi
AC_DEFINE_UNQUOTED([IMPRESS_UNLOCK_HIGHLIGHTS],["$IMPRESS_UNLOCK_HIGHLIGHTS"],[Default value of feature_lock.impress_unlock_highlights])
AC_SUBST(IMPRESS_UNLOCK_HIGHLIGHTS)

DRAW_UNLOCK_HIGHLIGHTS=
if test "$enable_feature_lock" = "yes"; then
    DRAW_UNLOCK_HIGHLIGHTS="Draw and get organized"
fi
AC_DEFINE_UNQUOTED([DRAW_UNLOCK_HIGHLIGHTS],["$DRAW_UNLOCK_HIGHLIGHTS"],[Default value of feature_lock.draw_unlock_highlights])
AC_SUBST(DRAW_UNLOCK_HIGHLIGHTS)

LOCK_CONFIGURATION=
if test "$enable_feature_lock" = "yes"; then
    LOCK_CONFIGURATION="<feature_lock desc=\"Feature lock settings\">
        <locked_hosts desc=\"Allow/deny feature-locked hosts. When allowed, the below host specification overrides the CheckFileInfo response.\" allow=\"false\">
            <fallback desc=\"What to do if the given host is not covered by any rule in locked_hosts\" read_only=\"true\" disabled_commands=\"true\"/>
            <host desc=\"Regex pattern of hostname to set as full-featured or locked.\" read_only=\"false\" disabled_commands=\"false\">localhost</host>
            <host desc=\"Regex pattern of hostname to set as full-featured or locked.\" read_only=\"false\" disabled_commands=\"false\">10\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}</host>
            <host desc=\"Regex pattern of hostname to set as full-featured or locked.\" read_only=\"false\" disabled_commands=\"false\">172\\.3[01]\\.[0-9]{1,3}\\.[0-9]{1,3}</host>
        </locked_hosts>
        <is_lock_readonly desc=\"Give locked users read only access to the documents. If this is set to true it will make all the locked_host readonly who has disabled_commands set to true\" type=\"bool\" default=\"false\">false</is_lock_readonly>
        <locked_commands desc=\"List of commands to lock the functionality\" default=\"$LOCKED_COMMANDS\">$LOCKED_COMMANDS</locked_commands>
        <unlock_title desc=\"Title to show user when prompting the unlock popup\" default=\"$UNLOCK_TITLE\">$UNLOCK_TITLE</unlock_title>
        <unlock_link desc=\"Link from where user can unlock the features\" default=\"$UNLOCK_LINK\">$UNLOCK_LINK</unlock_link>
        <unlock_description desc=\"Description about unlocking features\" default=\"$UNLOCK_DESCRIPTION\">$UNLOCK_DESCRIPTION</unlock_description>
        <unlock_image desc=\"URL of image shown when unlock dialog get displayed\" default=\"\"></unlock_image><!-- URL structure - https://<hostname>/static/<image_endpoint> -->
        <writer_unlock_highlights desc=\"Short note about Writer benefits of unlocking\" default=\"$WRITER_UNLOCK_HIGHLIGHTS\">$WRITER_UNLOCK_HIGHLIGHTS</writer_unlock_highlights>
        <calc_unlock_highlights desc=\"Short note about Calc benefits of unlocking\" default=\"$CALC_UNLOCK_HIGHLIGHTS\">$CALC_UNLOCK_HIGHLIGHTS</calc_unlock_highlights>
        <impress_unlock_highlights desc=\"Short note about Impress benefits of unlocking\" default=\"$IMPRESS_UNLOCK_HIGHLIGHTS\">$IMPRESS_UNLOCK_HIGHLIGHTS</impress_unlock_highlights>
        <draw_unlock_highlights desc=\"Short note about Draw benefits of unlocking\" default=\"$DRAW_UNLOCK_HIGHLIGHTS\">$DRAW_UNLOCK_HIGHLIGHTS</draw_unlock_highlights>

        <translations>
            <!-- Example to add german language for feature lock dialog -->
            <!--
            <language name=\"de\">
                <unlock_title desc=\"Title to show user when prompting the unlock popup\" default=\"Entfesseln Sie Ihr Potenzial\">Entfesseln Sie Ihr Potenzial</unlock_title>
                <unlock_description desc=\"Description about unlocking features\" default=\"Gehen Sie zur Detailseite und entdecken Sie alle Funktionen:\">Gehen Sie zur Detailseite und entdecken Sie alle Funktionen:</unlock_description>
                <writer_unlock_highlights desc=\"Short note about Writer benefits of unlocking\" default=\"Überprüfen und schreiben Sie mit Leichtigkeit\">Überprüfen und schreiben Sie mit Leichtigkeit</writer_unlock_highlights>
                <calc_unlock_highlights desc=\"Short note about Calc benefits of unlocking\" default=\"Machen Sie sich ein besseres Bild von Ihren Daten\">Machen Sie sich ein besseres Bild von Ihren Daten</calc_unlock_highlights>
                <impress_unlock_highlights desc=\"Short note about Impress benefits of unlocking\" default=\"Bringen Sie Ihre nächste Präsentation auf den Punkt\">Bringen Sie Ihre nächste Präsentation auf den Punkt</impress_unlock_highlights>
                <draw_unlock_highlights desc=\"Short note about Draw benefits of unlocking\" default=\"Zeichne und organisiere dich\">Zeichne und organisiere dich</draw_unlock_highlights>
            </language>
            -->
        </translations>
    </feature_lock>"
fi

AC_SUBST(LOCK_CONFIGURATION)
AM_SUBST_NOTMAKE(LOCK_CONFIGURATION)

UNLOCK_LINK_PER_HOST=
if test "$enable_feature_lock" = "yes"; then
    UNLOCK_LINK_PER_HOST="<unlock_link desc=\"Link from where user can unlock the features, which will get mapped with alias_group. According to hostname coolwsd will set the unlock link for feature unlock dialog. If not specified it will fallback to feature_lock.unlock_link entry\" default=\"\"></unlock_link>"
fi

AC_SUBST(UNLOCK_LINK_PER_HOST)
AM_SUBST_NOTMAKE(UNLOCK_LINK_PER_HOST)

AS_IF([test "$enable_feature_restriction" = "yes"],
    [AC_DEFINE([ENABLE_FEATURE_RESTRICTION],1,[Whether to compile and enable feature restrictions])],
    [AC_DEFINE([ENABLE_FEATURE_RESTRICTION],0,[Whether to compile and enable feature restrictions])])

FEATURE_RESTRICTION_CONFIGURATION=
if test "$enable_feature_restriction" = "yes"; then
    FEATURE_RESTRICTION_CONFIGURATION="<restricted_commands dec=\"List of uno commands to be disabled\"></restricted_commands>"
fi

AC_SUBST(FEATURE_RESTRICTION_CONFIGURATION)
AM_SUBST_NOTMAKE(FEATURE_RESTRICTION_CONFIGURATION)

AC_MSG_RESULT([$ALLOWED_LANGUAGES])
AC_SUBST(ALLOWED_LANGUAGES)

AC_CONFIG_FILES([Makefile
                 cypress_test/Makefile
                 gtk/Makefile
                 wasm/Makefile
                 test/Makefile
                 browser/Makefile
                 browser/npm-shrinkwrap.json
                 coolkitconfig.xcu
                 coolwsd.spec
                 coolwsd.xml
                 debian/coolwsd.postinst])

if test "$enable_iosapp" = "yes"; then
    AC_CONFIG_FILES([ios/config.h
                 ios/Mobile/Info.plist
                 ios/Mobile/Resources/Settings.bundle/Root.plist])
fi

if test "$enable_androidapp" = "yes"; then
    AC_CONFIG_FILES([$srcdir/android/build.gradle:android/build.gradle.in
                 $srcdir/android/app/build.gradle:android/app/build.gradle.in
                 $srcdir/android/lib/build.gradle:android/lib/build.gradle.in
                 $srcdir/android/app/appSettings.gradle:android/app/appSettings.gradle.in
                 $srcdir/android/lib/libSettings.gradle:android/lib/libSettings.gradle.in
                 $srcdir/android/lib/src/main/cpp/CMakeLists.txt:android/lib/src/main/cpp/CMakeLists.txt.in])
fi

AC_CONFIG_FILES([test/run_unit.sh],[chmod +x test/run_unit.sh])
AC_CONFIG_FILES([test/run_unit_standalone.sh],[chmod +x test/run_unit_standalone.sh])
AC_CONFIG_FILES([jsstress],[chmod +x jsstress])

AC_OUTPUT

AC_LANG_POP

AS_IF([test "$ENABLE_IOSAPP" = "true"],
      [
       if test `uname -s` = "Darwin"; then
          # Sadly I can't figure out any better way to avoid having to
          # edit the Xcode project file manually. Create symlinks to the
          # LibreOffice core source and build trees, and to the Poco
          # installation.

          AC_MSG_NOTICE([creating symbolic links for the Xcode project to use])

          if test -L lobuilddir-symlink; then
             rm -f lobuilddir-symlink
          elif test -f lobuilddir-symlink; then
             AC_MSG_ERROR([lobuilddir-symlink exists and is not a symbolic link])
          fi
          ln -s "$LOBUILDDIR" lobuilddir-symlink

          if test -L pocoinclude-symlink; then
             rm -f pocoinclude-symlink
          elif test -f pocoinclude-symlink; then
             AC_MSG_ERROR([pocoinclude-symlink exists and is not a symbolic link])
          fi
          ln -s "$POCOINCLUDE" pocoinclude-symlink

          if test -L pocolib-symlink; then
             rm -f pocolib-symlink
          elif test -f pocolib-symlink; then
             AC_MSG_ERROR([pocolib-symlink exists and is not a symbolic link])
          fi
          ln -s "$POCOLIB" pocolib-symlink

          if test -L zstdinclude-symlink; then
             rm -f zstdinclude-symlink
          elif test -f zstdinclude-symlink; then
             AC_MSG_ERROR([zstdinclude-symlink exists and is not a symbolic link])
          fi
          ln -s "$ZSTDINCLUDE" zstdinclude-symlink

          if test -L zstdlib-symlink; then
             rm -f zstdlib-symlink
          elif test -f zstdlib-symlink; then
             AC_MSG_ERROR([zstdlib-symlink exists and is not a symbolic link])
          fi
          ln -s "$ZSTDLIB" zstdlib-symlink

          eval `grep 'export ICU_MAJOR=' "$LOBUILDDIR/config_host.mk"`
          if test -L ICU.dat; then
             rm -f ICU.dat
          elif test -f ICU.dat; then
             AC_MSG_ERROR([ICU.dat exists and is not a symbolic link])
          fi
          ln -s "$LOBUILDDIR/workdir/CustomTarget/ios/resources/icudt${ICU_MAJOR}l.dat" ICU.dat

          # Sadly Xcode doesn't like it if AppIcon.appiconset is a
          # symlink, so make it a directory of symlinks to the actual png
          # and json files.
          rm -rf ios/Mobile/Assets.xcassets/AppIcon.appiconset
          mkdir ios/Mobile/Assets.xcassets/AppIcon.appiconset
          if test -n "$with_iosapp_appicon"; then
             ln -s "$with_iosapp_appicon"/* ios/Mobile/Assets.xcassets/AppIcon.appiconset
          else
             ln -s ios/Mobile/Assets.xcassets/Empty.appiconset/* ios/Mobile/Assets.xcassets/AppIcon.appiconset
          fi
       fi
      ],
      [
       echo "
Configuration:
    LOKit path                ${lokit_msg}
    LO path                   $LO_PATH
    LO integration tests      ${lo_msg}
    SSL support               $ssl_msg
    Debug & low security      $debug_msg
    Experimental features     $experimental_msg
    Test assertion logging    $log_asserts_msg
    Uglification and bundling $bundle_msg
    Anonymization             $anonym_msg
    Set capabilities          $setcap_msg
    Browsersync               $browsersync_msg
    cypress                   $cypress_msg
    C++ compiler flags        $CXXFLAGS
    Code-Coverage             $coverage_msg

    \$ make # to compile"
if test -n "$with_lo_path"; then
echo "    \$ make run # to start coolwsd
    \$ make sync-writer|calc|impress # to start browsersync with specified app
"
fi
      ])

dnl vim:set shiftwidth=4 softtabstop=4 expandtab:
