# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])

AC_INIT([loolwsd], [2.1.0], [libreoffice@lists.freedesktop.org])
LT_INIT([shared, disable-static, dlopen])

AM_INIT_AUTOMAKE([1.11 silent-rules subdir-objects tar-pax])

AC_CONFIG_MACRO_DIR([m4])

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

AC_ARG_WITH([lokit-path],
            AS_HELP_STRING([--with-lokit-path=<path>],
                           [Path to the "include" directory with the LibreOfficeKit headers]))

AC_ARG_WITH([lo-path],
            AS_HELP_STRING([--with-lo-path=<path>],
                           [Path to a working installation directory or instdir of LibreOffice]))

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

AC_ARG_WITH([max-connections],
            AS_HELP_STRING([--max-connections],
                           [Set the limit on the total number of client connections. Def: 20, Min: 3.]))

AC_ARG_WITH([max-documents],
             AS_HELP_STRING([--max-documents],
                           [Set the limit on the total number of documents. Def: 10, Min: 2.]))

AC_ARG_WITH([compiler-plugins],
            AS_HELP_STRING([--with-compiler-plugins=<path>],
                [Experimental! Unlikely to work for anyone except Noel! Enable compiler plugins that will perform additional checks during
                 building.]))

# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

ENABLE_DEBUG=
LOOLWSD_LOGLEVEL="warning"
LOOLWSD_LOG_TO_FILE="false"
LOOLWSD_LOGFILE="/var/log/loolwsd.log"
LOLEAFLET_LOGGING="false"
debug_msg="secure mode: product build"
if test "$enable_debug" = "yes"; then
   AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code and disable some security pieces])
   ENABLE_DEBUG=true
   LOOLWSD_LOGLEVEL="trace"
   LOOLWSD_LOG_TO_FILE="true"
   LOOLWSD_LOGFILE="/tmp/loolwsd.log"
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

MAX_CONNECTIONS=20
AS_IF([test -n "$with_max_connections" -a "$with_max_connections" -gt "0"],
      [MAX_CONNECTIONS="$with_max_connections"])
AS_IF([test "$MAX_CONNECTIONS" -lt "3"],
      [MAX_CONNECTIONS="3"])
AC_DEFINE_UNQUOTED([MAX_CONNECTIONS],[$MAX_CONNECTIONS],[Limit the maximum number of open connections])
AC_SUBST(MAX_CONNECTIONS)

MAX_DOCUMENTS=10
AS_IF([test -n "$with_max_documents" -a "$with_max_documents" -gt "0"],
      [MAX_DOCUMENTS="$with_max_documents"])
AS_IF([test "$MAX_DOCUMENTS" -gt "$MAX_CONNECTIONS"],
      [MAX_DOCUMENTS="$MAX_CONNECTIONS"])
AS_IF([test "$MAX_DOCUMENTS" -lt "2"],
      [MAX_DOCUMENTS="2"])
AC_DEFINE_UNQUOTED([MAX_DOCUMENTS],[$MAX_DOCUMENTS],[Limit the maximum number of open documents])
AC_SUBST(MAX_DOCUMENTS)

# Test for build environment

CXXFLAGS="$CXXFLAGS -std=c++11"
CXXFLAGS="$CXXFLAGS -Wall -Wextra -Werror -Wshadow"
CFLAGS="$CFLAGS -Wall -Wextra -Werror"

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
   LO_PATH="$with_lo_path"
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

AC_SEARCH_LIBS([png_create_write_struct],
               [png],
               [],
               [AC_MSG_ERROR([libpng not available?])])

AS_IF([test `uname -s` = Linux],
      [AC_SEARCH_LIBS([cap_get_proc],
                      [cap],
                      [],
                      [AC_MSG_ERROR([libcap not available?])])])

PKG_CHECK_MODULES([ZLIB], [zlib])

PKG_CHECK_MODULES([CPPUNIT], [cppunit])

AS_IF([test "$enable_ssl" != "no"],
      [AC_DEFINE([ENABLE_SSL],1,[Whether to enable SSL])],
      [AC_DEFINE([ENABLE_SSL],0,[Whether to enable SSL])])

AM_CONDITIONAL([ENABLE_SSL], [test "$enable_ssl" != "no"])
AM_CONDITIONAL([ENABLE_DEBUG], [test "$ENABLE_DEBUG" = "true"])

ENABLE_SSL=
if test "$enable_ssl" != "no"; then
   ssl_msg="ssl enabled"
   ENABLE_SSL=true
else
   ssl_msg="insecure: ssl disabled"
fi

AC_SUBST(ENABLE_SSL)

LIBS="$LIBS -lPocoNet${POCO_DEBUG_SUFFIX} -lPocoUtil${POCO_DEBUG_SUFFIX} -lPocoJSON${POCO_DEBUG_SUFFIX} -lPocoFoundation${POCO_DEBUG_SUFFIX} -lPocoXML${POCO_DEBUG_SUFFIX} -lPocoNetSSL${POCO_DEBUG_SUFFIX} -lPocoCrypto${POCO_DEBUG_SUFFIX}"

AC_CHECK_HEADERS([LibreOfficeKit/LibreOfficeKit.h],
                 [],
                 [AC_MSG_ERROR([header LibreOfficeKit/LibreOfficeKit.h not found, perhaps you want to use --with-lokit-path])])
AC_CHECK_HEADERS([Poco/Net/WebSocket.h],
                 [],
                 [AC_MSG_ERROR([header Poco/Net/WebSocket.h not found, perhaps you want to use --with-poco-includes])])

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
    Poco::RegularExpression e("abc.[def]");
    Poco::RegularExpression::Match m;
    return e.match(argv[[1]], m);
}
])],
               [AC_MSG_RESULT([No])],
               [AC_MSG_RESULT([Yes])
                LIBS="$LIBS -lpcre"])

test "$prefix" = NONE && prefix=$ac_default_prefix
LOOLWSD_CACHEDIR=${localstatedir}/cache/${PACKAGE}
while :; do
    oldvalue=$LOOLWSD_CACHEDIR
    LOOLWSD_CACHEDIR=`eval echo $LOOLWSD_CACHEDIR`
    test $LOOLWSD_CACHEDIR = $oldvalue && break
done

# need this after the other stuff that uses the compiler because we don't want to run configure-tests with the plugins enabled
AS_IF([test -n "$with_compiler_plugins"],
      [CPPFLAGS="$CPPFLAGS -Xclang -load -Xclang ${with_compiler_plugins}/compilerplugins/obj/plugin.so -Xclang -add-plugin -Xclang loplugin"])

AC_DEFINE_UNQUOTED([LOOLWSD_CACHEDIR],["$LOOLWSD_CACHEDIR"],[Cache folder])
AC_SUBST(LOOLWSD_CACHEDIR)

LOOLWSD_CONFIGDIR=${sysconfdir}/${PACKAGE}
AC_SUBST(LOOLWSD_CONFIGDIR)

LOOLWSD_DATADIR=${datadir}/${PACKAGE}
AC_SUBST(LOOLWSD_DATADIR)

AC_CONFIG_FILES([Makefile
                 test/Makefile
                 loleaflet/Makefile
                 loolwsd.spec
                 loolwsd.xml
                 debian/loolwsd.postinst])
AC_CONFIG_FILES([test/run_unit.sh],[chmod +x test/run_unit.sh])

AC_OUTPUT

AC_LANG_POP

echo "
Configuration:
    LOKit path              ${lokit_msg}
    LO path                 $LO_PATH
    LO integration tests    ${lo_msg}
    SSL support             $ssl_msg
    Debug & low security    $debug_msg

    \$ make # to compile"
if test -n "$with_lo_path"; then
echo "    \$ make run # to start loolwsd
"
fi

dnl vim:set shiftwidth=4 softtabstop=4 expandtab:
