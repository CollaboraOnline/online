# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.63])

AC_INIT([loolwsd], [4.0.14], [libreoffice@lists.freedesktop.org])
LT_INIT([shared, disable-static, dlopen])

AM_INIT_AUTOMAKE([1.10 subdir-objects tar-pax -Wno-portability])

AC_CONFIG_MACRO_DIR([m4])

# We don't want to require pkg-config and PKG_CHECK_MODULES on macOS
m4_if(m4_esyscmd_s([uname -s]),Linux,[],[m4_define([PKG_CHECK_MODULES],[])])

LOOLWSD_VERSION_MAJOR=`echo $VERSION | awk -F. '{print $1}'`
LOOLWSD_VERSION_MINOR=`echo $VERSION | awk -F. '{print $2}'`
LOOLWSD_VERSION_MICRO=`echo $VERSION | awk -F. '{print $3}'`
LOOLWSD_VERSION="$LOOLWSD_VERSION_MAJOR.$LOOLWSD_VERSION_MINOR.$LOOLWSD_VERSION_MICRO"

AC_SUBST([LOOLWSD_VERSION_MAJOR])
AC_SUBST([LOOLWSD_VERSION_MINOR])
AC_SUBST([LOOLWSD_VERSION_MICRO])
AC_SUBST([LOOLWSD_VERSION])

AC_DEFINE_UNQUOTED([LOOLWSD_VERSION],[["$LOOLWSD_VERSION"]],[LibreOffice Online WebSocket server version])

# try to add a git hash for a version if we're developing
LOOLWSD_VERSION_HASH="$LOOLWSD_VERSION"
git_hash=`cd ${srcdir} && ( cat dist_git_hash 2> /dev/null || git log -1 --format=%h 2> /dev/null )`
if test "z$git_hash" != "z"; then
   LOOLWSD_VERSION_HASH=$git_hash
fi
AC_SUBST([LOOLWSD_VERSION_HASH])

AC_DEFINE_UNQUOTED([LOOLWSD_VERSION_HASH],[["$LOOLWSD_VERSION_HASH"]],[LibreOffice Online git hash if present])

AC_CONFIG_SRCDIR([wsd/LOOLWSD.cpp])

AC_CONFIG_HEADERS([config.h])

# Checks for programs.
AC_PROG_CXX
AC_PROG_CC

AC_LANG_PUSH([C++])

AS_IF([test `uname -s` = Linux],
      [AC_PATH_PROG([SETCAP], setcap,[],[/bin:/usr/bin:/sbin:/usr/sbin])]
       AS_IF([test -z "$SETCAP"],
       [AC_MSG_ERROR([The setcap command is needed. It might be in a package called libcap-progs.])]))

# Declare options
AC_ARG_ENABLE([debug],
              AS_HELP_STRING([--enable-debug],
                             [Enable debugging, link with debugging version of Poco libraries]))

AC_ARG_ENABLE([anonymize-usernames],
              AS_HELP_STRING([--enable-anonymize-usernames],
                             [Enable anonymization/obfuscation of usernames in logs]))

AC_ARG_ENABLE([anonymize-filenames],
              AS_HELP_STRING([--enable-anonymize-filenames],
                             [Enable anonymization/obfuscation of filenames in logs]))

AC_ARG_ENABLE([iosapp],
              AS_HELP_STRING([--enable-iosapp],
                             [Use in a tree where the only purpose is to build the HTML and CSS stuff
                              to be copied to a Mac where the iOS app is being built, *or* in a tree where
                              you will build the iOS app.]))

AC_ARG_WITH([iosapp-appicon],
              AS_HELP_STRING([--with-iosapp-appicon=<path>],
                             [Point to a directory containing an icon set to use instead of the default empty one.]))

AC_ARG_WITH([iosapp-fonts],
              AS_HELP_STRING([--with-iosapp-fonts=<path>],
                             [Point to a directory containing .ttf or .otf files to be bundled in the iOS app (and
                              thus installed on the device for use of the LO core code).]))

AC_ARG_ENABLE([gtkapp],
              AS_HELP_STRING([--enable-gtkapp],
                             [Use in a tree where the only purpose is to build the gtk+ "app" that is supposed
                              to work similarly to the iOS app, from the JavaScript and the pseudo WebSocket
                              message plumbing point of view. See gtk/README.]))

AC_ARG_WITH([app-name],
              AS_HELP_STRING([--with-app-name=<name>],
                             [Set the user-visible name of the app you build.]))

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
                           [Mandatory, and relevant, in a tree where building the iOS app.
                            Path to a the build directory of the LibreOffice core source tree you want to use.
                            In addition you MUST manually edit the ios/Mobile.xcodeproj/project.pbxproj
                            file and change the references to "../ios-device" to refer to the corresponding
                            LibreOffice core source directory (which typically would be the same as the build
                            directory you specify with this option).]))

AC_ARG_WITH([logfile],
            AS_HELP_STRING([--with-logfile=<path>],
                           [Path to the location of the logfile.]))

AC_ARG_WITH([poco-includes],
            AS_HELP_STRING([--with-poco-includes=<path>],
                           [Path to the "include" directory with the Poco headers]))

AC_ARG_WITH([poco-libs],
            AS_HELP_STRING([--with-poco-libs=<path>],
                           [Path to the "lib" directory with the Poco libraries]))

AC_ARG_WITH([libpng-includes],
            AS_HELP_STRING([--with-libpng-includes=<path>],
                           [Path to the "include" directory with the libpng headers]))

AC_ARG_WITH([libpng-libs],
            AS_HELP_STRING([--with-libpng-libs=<path>],
                           [Path to the "lib" directory with the libpng libraries]))

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
                [Implements signed key with expiration required for support. Targeted at LibreOffice Online Service Providers.]))

AC_ARG_WITH([max-connections],
            AS_HELP_STRING([--with-max-connections],
                           [Set the limit on the total number of client connections. Def: 20, Min: 3.]))

AC_ARG_WITH([max-documents],
             AS_HELP_STRING([--with-max-documents],
                           [Set the limit on the total number of documents. Def: 10, Min: 2.]))

AC_ARG_WITH([sanitizer],
             AS_HELP_STRING([--with-sanitizer],
                           [Enable one or more compatible sanitizers. E.g. --with-sanitizer=address,leak]))

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

AC_ARG_ENABLE([vereign],
            AS_HELP_STRING([--enable-vereign],
                          [Set Vereign document_signing_url configuration key to the default app.vereign.com.]))
# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

ENABLE_DEBUG=
LOOLWSD_LOGLEVEL="warning"
LOOLWSD_LOG_TO_FILE="false"
LOOLWSD_LOGFILE="/var/log/loolwsd.log"
LOOLWSD_ANONYMIZE_FILENAMES=false
LOOLWSD_ANONYMIZE_USERNAMES=false
LOLEAFLET_LOGGING="false"
debug_msg="secure mode: product build"
anonym_msg=""
if test "$enable_debug" = "yes"; then
   AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code and disable some security pieces])
   ENABLE_DEBUG=true
   LOOLWSD_LOGLEVEL="trace"
   LOOLWSD_LOG_TO_FILE="true"
   LOOLWSD_LOGFILE="/tmp/loolwsd.log"
   LOOLWSD_ANONYMIZE_FILENAMES=false
   LOOLWSD_ANONYMIZE_USERNAMES=false
   LOLEAFLET_LOGGING="true"
   debug_msg="low security debugging mode"
else
    AC_DEFINE([ENABLE_DEBUG],0,[Whether to compile in some extra debugging support code and disable some security pieces])
fi
AC_SUBST(ENABLE_DEBUG)
AC_SUBST(LOOLWSD_LOGLEVEL)
AC_SUBST(LOOLWSD_LOG_TO_FILE)
AC_SUBST(LOLEAFLET_LOGGING)

if test -n "$with_logfile" ; then
   LOOLWSD_LOGFILE="$with_logfile"
fi
AC_SUBST(LOOLWSD_LOGFILE)

if test "$enable_anonymize_filenames" = "yes" ; then
   LOOLWSD_ANONYMIZE_FILENAMES=true
   anonym_msg="filenames anonymized; "
fi
AC_DEFINE_UNQUOTED([LOOLWSD_ANONYMIZE_FILENAMES],[$LOOLWSD_ANONYMIZE_FILENAMES],[Enable permanent filenames anonymization in logs])
AC_SUBST(LOOLWSD_ANONYMIZE_FILENAMES)

if test "$enable_anonymize_usernames" = "yes" ; then
   LOOLWSD_ANONYMIZE_USERNAMES=true
   anonym_msg="${anonym_msg}usernames anonymized; "
fi
AC_DEFINE_UNQUOTED([LOOLWSD_ANONYMIZE_USERNAMES],[$LOOLWSD_ANONYMIZE_USERNAMES],[Enable permanent usernames anonymization in logs])
AC_SUBST(LOOLWSD_ANONYMIZE_USERNAMES)

if test -z "$anonym_msg";  then
  anonym_msg="no anonymization of usernames or filenames"
fi

APP_NAME="LOOL"
if test -n "$with_app_name"; then
   APP_NAME="$with_app_name"
fi
AC_DEFINE_UNQUOTED([APP_NAME],["$APP_NAME"],[The user-visible name of the app you build.])
AC_SUBST(APP_NAME)

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

   # When configuring for building the app itself, on macOS, we need
   # these. But not when just configuring for building the JS on
   # Linux, for copying over to the Mac.
   if test `uname -s` = "Darwin"; then
      AC_MSG_CHECKING([for LibreOffice build tree to build against])
      if test -z "$with_lo_builddir"; then
         AC_MSG_ERROR([You MUST use the --with-lo-builddir option when configuring the iOS app build tree.])
      fi

      LOBUILDDIR="$with_lo_builddir"
      # Sanity check, just a random object file in the LibreOffice build tree
      if test -f "$LOBUILDDIR/workdir/CxxObject/vcl/ios/iosinst.o"; then
          AC_MSG_RESULT([$LOBUILDDIR])
      else
          AC_MSG_ERROR([This is not a LibreOffice core build directory: $LOBUILDDIR])
      fi

      AC_MSG_CHECKING([for Poco include directory to build against])
      if test -z "$with_poco_includes"; then
         AC_MSG_ERROR([You MUST use the --with-poco-includes option when configuring the iOS app build tree.])
      fi

      POCOINCLUDE="$with_poco_includes"
      # Sanity check
      if test -f "$POCOINCLUDE/Poco/Poco.h"; then
          AC_MSG_RESULT([$POCOINCLUDE])
      else
          AC_MSG_ERROR([This is not a Poco include directory: $POCOINCLUDE])
      fi

      AC_MSG_CHECKING([for Poco lib directory to build against])
      if test -z "$with_poco_libs"; then
         AC_MSG_ERROR([You MUST use the --with-poco-libs option when configuring the iOS app build tree.])
      fi

      POCOLIB="$with_poco_libs"
      # Sanity check
      if test -f "$POCOLIB/libPocoFoundation.a"; then
          AC_MSG_RESULT([$POCOLIB])
      else
          AC_MSG_ERROR([This is not a Poco lib directory: $POCOLIB])
      fi
   fi
fi
AC_SUBST(ENABLE_IOSAPP)
AM_CONDITIONAL([ENABLE_IOSAPP], [test "$ENABLE_IOSAPP" = "true"])
AC_SUBST(IOSAPP_BUNDLE_VERSION)

ENABLE_GTKAPP=
if test "$enable_gtkapp" = "yes"; then
   ENABLE_GTKAPP=true
fi
AC_SUBST(ENABLE_GTKAPP)
AM_CONDITIONAL([ENABLE_GTKAPP], [test "$ENABLE_GTKAPP" = "true"])

MAX_CONNECTIONS=20
AS_IF([test -n "$with_max_connections" && test "$with_max_connections" -gt "0"],
      [MAX_CONNECTIONS="$with_max_connections"])
AS_IF([test "$MAX_CONNECTIONS" -lt "3"],
      [MAX_CONNECTIONS="3"])
AC_DEFINE_UNQUOTED([MAX_CONNECTIONS],[$MAX_CONNECTIONS],[Limit the maximum number of open connections])
AC_SUBST(MAX_CONNECTIONS)

MAX_DOCUMENTS=10
AS_IF([test -n "$with_max_documents" && test "$with_max_documents" -gt "0"],
      [MAX_DOCUMENTS="$with_max_documents"])
AS_IF([test "$MAX_DOCUMENTS" -gt "$MAX_CONNECTIONS"],
      [MAX_DOCUMENTS="$MAX_CONNECTIONS"])
AS_IF([test "$MAX_DOCUMENTS" -lt "2"],
      [MAX_DOCUMENTS="2"])
AC_DEFINE_UNQUOTED([MAX_DOCUMENTS],[$MAX_DOCUMENTS],[Limit the maximum number of open documents])
AC_SUBST(MAX_DOCUMENTS)

VEREIGN_URL=
if test "$enable_vereign" = "yes"; then
    VEREIGN_URL="https://app.vereign.com"
fi
AC_DEFINE_UNQUOTED([VEREIGN_URL],["$VEREIGN_URL"],[Default value of per_documents.document_signing_url])
AC_SUBST(VEREIGN_URL)

# Test for build environment

AS_IF([test "$ENABLE_GTKAPP" != true],
[CXXFLAGS="$CXXFLAGS -std=c++11"
CXXFLAGS="$CXXFLAGS -Wall -Wextra -Wshadow"])

CFLAGS="$CFLAGS -Wall -Wextra"

AC_MSG_CHECKING([whether to turn warnings to errors])
if test -z "$enable_werror" -o "$enable_werror" = "yes"; then
    AC_MSG_RESULT([yes])
    CXXFLAGS="$CXXFLAGS -Werror"
    CFLAGS="$CFLAGS -Werror"
else
    AC_MSG_RESULT([no])
fi

AC_MSG_CHECKING([whether to turn sanitizers on])
if test "x$with_sanitizer" != "x"; then
    AC_MSG_RESULT([yes ($with_sanitizer)])
	SANITIZER_FLAGS="-O1 -fno-omit-frame-pointer -fsanitize=$with_sanitizer -frtti" # -fno-sanitize=vptr
    CXXFLAGS="$CXXFLAGS $SANITIZER_FLAGS"
    CFLAGS="$CFLAGS $SANITIZER_FLAGS"
    LIBS="$LIBS -ldl"
else
    AC_MSG_RESULT([no])
fi

# check for C++11 support
HAVE_CXX11=
AC_MSG_CHECKING([whether $CXX supports C++14 or C++11])
for flag in -std=gnu++14 -std=gnu++1y -std=c++14 -std=c++1y -std=gnu++11 -std=gnu++0x -std=c++11 -std=c++0x ; do
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
        ]])],[CXXFLAGS_CXX11=$flag])
    AC_LANG_POP([C++])
    CXXFLAGS=$save_CXXFLAGS
    if test -n "$CXXFLAGS_CXX11"; then
        HAVE_CXX11=TRUE
        break
    fi
done
if test "$HAVE_CXX11" = TRUE; then
    AC_MSG_RESULT([yes ($CXXFLAGS_CXX11)])
else
    AC_MSG_ERROR(no)
fi

with_lokit_path=`readlink -f $with_lokit_path`
AS_IF([test -n "$with_lokit_path"],
      [CPPFLAGS="$CPPFLAGS -I${with_lokit_path}"])
lokit_msg="$with_lokit_path"

LO_PATH="/usr/lib64/libreoffice"
JAIL_PATH=not-set
SYSTEMPLATE_PATH=not-set
have_lo_path=false
AC_MSG_CHECKING([whether to run tests against a LibreOffice])
if test -n "$with_lo_path"; then
   # strip trailing '/' from LO_PATH, 'ln -s' with such path will otherwise fail
   LO_PATH="${with_lo_path%/}"
   version_file="$with_lo_path/program/versionrc"
   if test -f $version_file; then
     JAILS_PATH="\${abs_top_builddir}/jails"
     TILECACHE_PATH="\${abs_top_builddir}/cache"
     SYSTEMPLATE_PATH="\${abs_top_builddir}/systemplate"
     have_lo_path=true
     lo_msg="test against $LO_PATH"
     AC_MSG_RESULT([yes])
   else
     lo_msg="no integration tests"
     AC_MSG_RESULT([no])
   fi
else
   lo_msg="no integration tests"
   AC_MSG_RESULT([no])
fi
AC_SUBST(LO_PATH)
AC_DEFINE_UNQUOTED([LO_PATH],["$LO_PATH"],[Path to LibreOffice installation])
AC_SUBST(JAILS_PATH)
AC_SUBST(TILECACHE_PATH)
AC_SUBST(SYSTEMPLATE_PATH)
AM_CONDITIONAL(HAVE_LO_PATH,[test "$have_lo_path" = "true"])

AS_IF([test -n "$with_poco_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_poco_includes}"])

AS_IF([test -n "$with_poco_libs"],
      [LDFLAGS="$LDFLAGS -L${with_poco_libs}"])

AS_IF([test -n "$with_libpng_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_libpng_includes}"])

AS_IF([test -n "$with_libpng_libs"],
      [LDFLAGS="$LDFLAGS -L${with_libpng_libs}"])

AS_IF([test -n "$with_cppunit_includes"],
      [CPPFLAGS="$CPPFLAGS -isystem ${with_cppunit_includes}"])

AS_IF([test -n "$with_cppunit_libs"],
      [LDFLAGS="$LDFLAGS -L${with_cppunit_libs}"])

AS_IF([test `uname -s` = Linux],
      [AS_IF([test -n "$with_poco_libs"],
             [LDFLAGS="$LDFLAGS -Wl,-rpath,${with_poco_libs}"])])

AS_IF([test `uname -s` = Linux],
      [AS_IF([test -n "$with_cppunit_libs"],
             [LDFLAGS="$LDFLAGS -Wl,-rpath,${with_cppunit_libs}"])])

AS_IF([test `uname -s` != Darwin],
      [AC_SEARCH_LIBS([dlopen],
                      [dl dld],
                      [],
                      [AC_MSG_ERROR([dlopen not found])])])

AS_IF([test "$ENABLE_IOSAPP" != "true"],
      [AC_SEARCH_LIBS([png_create_write_struct],
                      [png],
                      [],
                      [AC_MSG_ERROR([libpng not available?])])
       PKG_CHECK_MODULES([ZLIB], [zlib])

       PKG_CHECK_MODULES([CPPUNIT], [cppunit])
       ])

AS_IF([test `uname -s` = Linux],
      [AC_SEARCH_LIBS([cap_get_proc],
                      [cap],
                      [],
                      [AC_MSG_ERROR([libcap not available?])])])

AS_IF([test "$ENABLE_GTKAPP" = true],
      [PKG_CHECK_MODULES([WEBKIT],[webkit2gtk-4.0])])

AM_CONDITIONAL([ENABLE_DEBUG], [test "$ENABLE_DEBUG" = "true"])

mobile_app=
AC_MSG_CHECKING([Is this a mobile app])
if test "$enable_gtkapp" = "yes" -o "$enable_iosapp" = "yes"; then
     AC_MSG_RESULT([Yes])
     mobile_app=true;
else
     AC_MSG_RESULT([No])
fi

ENABLE_SSL=true
if test "$enable_ssl" != "no" -a "$mobile_app" != "true"; then
   ssl_msg="ssl enabled"
   ENABLE_SSL=true
   AC_DEFINE([ENABLE_SSL],1,[Whether to enable SSL])
else
   ssl_msg="insecure: ssl disabled"
   ENABLE_SSL=false
   AC_DEFINE([ENABLE_SSL],0,[Whether to enable SSL])
fi
AM_CONDITIONAL([ENABLE_SSL], [$ENABLE_SSL])
AC_SUBST(ENABLE_SSL)

AC_CHECK_HEADERS([security/pam_appl.h],
                 [],
                 [AC_MSG_ERROR([header security/pam_appl.h not found, install PAM development package])])
AC_CHECK_LIB(pam, pam_start, [], [AC_MSG_ERROR([No. Install PAM development package])])

if test "x$with_support_public_key" != "x"; then
    AC_DEFINE([ENABLE_SUPPORT_KEY],1,[Whether to enable support key])

    # generate the public key include
    echo -e "#ifndef INCLUDED_SUPPORT_PUBLIC_KEY_HPP\n#define INCLUDED_SUPPORT_PUBLIC_KEY_HPP\n#include <string>\nconst static std::string SUPPORT_PUBLIC_KEY(" > "${srcdir}/common/support-public-key.hpp"
    sed 's/\(.*\)/"\1\\n"/' "$with_support_public_key" >> "${srcdir}/common/support-public-key.hpp"
    echo -e ");\n#endif" >> "${srcdir}/common/support-public-key.hpp"
else
    AC_DEFINE([ENABLE_SUPPORT_KEY],0,[Whether to enable support key])
    rm -f "${srcdir}/common/support-public-key.hpp"
fi
AC_SUBST(ENABLE_SUPPORT_KEY)

LIBS="$LIBS -lPocoNet${POCO_DEBUG_SUFFIX} -lPocoNetSSL${POCO_DEBUG_SUFFIX} -lPocoUtil${POCO_DEBUG_SUFFIX} -lPocoJSON${POCO_DEBUG_SUFFIX} -lPocoXML${POCO_DEBUG_SUFFIX} -lPocoFoundation${POCO_DEBUG_SUFFIX} -lPocoCrypto${POCO_DEBUG_SUFFIX}"

AS_IF([test "$ENABLE_SSL" = "true"],
      [LIBS="$LIBS -lssl -lcrypto"])

AS_IF([test "$ENABLE_IOSAPP" != "true"],
      [AC_CHECK_HEADERS([LibreOfficeKit/LibreOfficeKit.h],
                        [],
                        [AC_MSG_ERROR([header LibreOfficeKit/LibreOfficeKit.h not found, perhaps you want to use --with-lokit-path])])
       AC_CHECK_HEADERS([Poco/Net/WebSocket.h],
                        [],
                        [AC_MSG_ERROR([header Poco/Net/WebSocket.h not found, perhaps you want to use --with-poco-includes])])
       DISABLE_SECCOMP=
       if test "$enable_seccomp" != "no"; then
           AC_CHECK_HEADERS([linux/seccomp.h],
                            [],
                            [AC_MSG_ERROR([critical security header linux/seccomp.h not found. If kernel on target system does not support SECCOMP, you can use --disable-seccomp, but mind the security consequences.])])
           AC_DEFINE([DISABLE_SECCOMP],0,[Whether to disable SECCOMP])
       else
           AC_DEFINE([DISABLE_SECCOMP],1,[Whether to disable SECCOMP])
       fi

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

AS_IF([test `uname -s` = "Linux"],
      # We need npm and node only on Linux, both in the normal Online case,
      # and when only building JS for the iOS app. When building the iOS app itself on macOS,
      # don't do this.
      [AC_PATH_PROG(NPM, npm, no)
       if test "$NPM" = "no"; then
           AC_MSG_ERROR([npm required to build loleaflet, but not installed])
       else
           NPM_VER=`npm -v | awk -F. '{ print (($1 * 100) + $2) * 100 + $3;}'`
           if test "$NPM_VER" -ge 30900 -a "$NPM_VER" -lt 31004; then
               AC_MSG_ERROR([This npm version is buggy, either upgrade to >= 3.10.4 or downgrade to < 3.9.0])
           fi
       fi

       AC_PATH_PROG(NODE, node, no)
       if test "$NODE" = "no"; then
           AC_MSG_ERROR([node required to build loleaflet, but not installed])
       else
           NODE_VER=`node --version | sed 's/^v//' | awk -F. '{ print (($1 * 100) + $2) * 100 + $3;}'`
           if test "$NODE_VER" -lt 60000; then
               AC_MSG_ERROR([This node version is old, upgrade to >= 6.0.0])
           fi
       fi
       ])

AS_IF([test "$ENABLE_IOSAPP" != "true"],
      [test "$prefix" = NONE && prefix=$ac_default_prefix
       LOOLWSD_CACHEDIR=${localstatedir}/cache/${PACKAGE}
       while :; do
           oldvalue=$LOOLWSD_CACHEDIR
           LOOLWSD_CACHEDIR=`eval echo $LOOLWSD_CACHEDIR`
           test $LOOLWSD_CACHEDIR = $oldvalue && break
       done
       ])

# need this after the other stuff that uses the compiler because we don't want to run configure-tests with the plugins enabled
AS_IF([test -n "$with_compiler_plugins"],
      [CPPFLAGS="$CPPFLAGS -Xclang -load -Xclang ${with_compiler_plugins}/compilerplugins/obj/plugin.so -Xclang -add-plugin -Xclang loplugin -Xclang -plugin-arg-loplugin -Xclang --lool-base-path=\${abs_top_srcdir}"])

AC_DEFINE_UNQUOTED([LOOLWSD_CACHEDIR],["$LOOLWSD_CACHEDIR"],[Cache folder])
AC_SUBST(LOOLWSD_CACHEDIR)

LOOLWSD_CONFIGDIR=${sysconfdir}/${PACKAGE}
AC_SUBST(LOOLWSD_CONFIGDIR)

LOOLWSD_DATADIR=${datadir}/${PACKAGE}
AC_SUBST(LOOLWSD_DATADIR)

AS_IF([test "$enable_setcap" != "no"],
      [AC_DEFINE([ENABLE_SETCAP],1,[Whether to enable setting of capabilities])],
      [AC_DEFINE([ENABLE_SETCAP],0,[Whether to enable setting of capabilities])])

AM_CONDITIONAL([ENABLE_SETCAP], [test "$enable_setcap" != "no"])

ENABLE_SETCAP=
if test "$enable_setcap" != "no"; then
    ENABLE_SETCAP=true
    setcap_msg="setcap enabled"
else
    setcap_msg="setcap disabled"
fi

AC_SUBST(ENABLE_SETCAP)

AC_CONFIG_LINKS([discovery.xml:discovery.xml])
AC_CONFIG_LINKS([loolkitconfig.xcu:loolkitconfig.xcu])
AC_CONFIG_LINKS([loleaflet/package.json:loleaflet/package.json])
AC_LINK_FILES([loleaflet/node_shrinkwrap], [loleaflet/node_shrinkwrap])

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
       fi
      ])
AC_SUBST(IOSAPP_FONTS)

AC_CONFIG_FILES([Makefile
                 gtk/Makefile
                 ios/config.h
                 ios/Mobile/Info.plist
                 test/Makefile
                 loleaflet/Makefile
                 loleaflet/npm-shrinkwrap.json
                 loolwsd.spec
                 loolwsd.xml
                 debian/loolwsd.postinst])
AC_CONFIG_FILES([test/run_unit.sh],[chmod +x test/run_unit.sh])

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
    LOKit path              ${lokit_msg}
    LO path                 $LO_PATH
    LO integration tests    ${lo_msg}
    SSL support             $ssl_msg
    Debug & low security    $debug_msg
    Anonymization           $anonym_msg
    Set capabilities        $setcap_msg

    \$ make # to compile"
if test -n "$with_lo_path"; then
echo "    \$ make run # to start loolwsd
"
fi
      ])

dnl vim:set shiftwidth=4 softtabstop=4 expandtab:
