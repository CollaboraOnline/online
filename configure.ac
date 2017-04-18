# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])

AC_INIT([libreoffice-online], [5.3.2.2], [libreoffice@lists.freedesktop.org])
LT_INIT([shared, disable-static, dlopen])

AM_INIT_AUTOMAKE([1.11 silent-rules subdir-objects])

AC_CONFIG_MACRO_DIR([m4])

LOOLWSD_VERSION_MAJOR=`echo $VERSION | awk -F. '{print $1}'`
LOOLWSD_VERSION_MINOR=`echo $VERSION | awk -F. '{print $2}'`
LOOLWSD_VERSION_MICRO=`echo $VERSION | awk -F. '{print $3}'`
LOOLWSD_VERSION="$LOOLWSD_VERSION_MAJOR.$LOOLWSD_VERSION_MINOR.$LOOLWSD_VERSION_MICRO"

AC_SUBST([LOOLWSD_VERSION_MAJOR])
AC_SUBST([LOOLWSD_VERSION_MINOR])
AC_SUBST([LOOLWSD_VERSION_MICRO])
AC_SUBST([LOOLWSD_VERSION])

AC_DEFINE_UNQUOTED([LOOLWSD_VERSION],[["$LOOLWSD_VERSION"]],[LibreOffice On-Line WebSocket server version])

# try to add a git hash for a version if we're developing
LOOLWSD_VERSION_HASH="$LOOLWSD_VERSION"
git_hash=`cd ${srcdir} && git log -1 --format=%h 2> /dev/null`
if test "z$git_hash" != "z"; then
   LOOLWSD_VERSION_HASH=$git_hash
fi
AC_SUBST([LOOLWSD_VERSION_HASH])

AC_DEFINE_UNQUOTED([LOOLWSD_VERSION_HASH],[["$LOOLWSD_VERSION_HASH"]],[LibreOffice On-Line git hash if present])

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

AC_ARG_WITH([max-documents],
             AS_HELP_STRING([--max-documents],
                            [Compile with a hard-coded limit on the number of documents]))

AC_ARG_WITH([max-connections],
            AS_HELP_STRING([--max-connections],
                           [Compile with a hard-coded limit on the total number of client connections]))

# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

ENABLE_DEBUG=
LOOLWSD_LOGLEVEL="warning"
LOOLWSD_LOG_TO_FILE="false"
LOOLWSD_LOGFILE="/var/log/loolwsd.log"
debug_msg="secure mode: product build"
if test "$enable_debug" = "yes"; then
   AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code and disable some security pieces])
   ENABLE_DEBUG=true
   LOOLWSD_LOGLEVEL="trace"
   LOOLWSD_LOG_TO_FILE="true"
   LOOLWSD_LOGFILE="/tmp/loolwsd.log"
   debug_msg="low security debugging mode"
else
    AC_DEFINE([ENABLE_DEBUG],0,[Whether to compile in some extra debugging support code and disable some security pieces])
fi
AC_SUBST(ENABLE_DEBUG)
AC_SUBST(LOOLWSD_LOGLEVEL)
AC_SUBST(LOOLWSD_LOG_TO_FILE)

if test -n "$with_logfile" ; then
   LOOLWSD_LOGFILE="$with_logfile"
fi
AC_SUBST(LOOLWSD_LOGFILE)

MAX_DOCUMENTS=10
AS_IF([test -n "$with_max_documents"],
      [MAX_DOCUMENTS="$with_max_documents"])
AC_DEFINE_UNQUOTED([MAX_DOCUMENTS],[$MAX_DOCUMENTS],[Limit the maximum number of open documents])
AC_SUBST(MAX_DOCUMENTS)

MAX_CONNECTIONS=20
AS_IF([test -n "$with_max_connections"],
      [MAX_CONNECTIONS="$with_max_connections"])
AC_DEFINE_UNQUOTED([MAX_CONNECTIONS],[$MAX_CONNECTIONS],[Limit the maximum number of open connections])
AC_SUBST(MAX_CONNECTIONS)

if test $MAX_CONNECTIONS -lt $MAX_DOCUMENTS; then
    AC_MSG_ERROR([Each document must have at least one connection, therefore, max_connections cannot be less than
                  max_documents.])
fi

# Test for build environment

CXXFLAGS="$CXXFLAGS -std=c++11"
CXXFLAGS="$CXXFLAGS -Wall -Wextra -Werror -Wshadow"
CFLAGS="$CFLAGS -Wall -Wextra -Werror"

with_lokit_path=`readlink -f $with_lokit_path`
AS_IF([test -n "$with_lokit_path"],
      [CPPFLAGS="$CPPFLAGS -I${with_lokit_path}"])
lokit_msg="$with_lokit_path"

dnl
dnl lo_path is not required; but useful for testing.
dnl
LO_PATH=
JAIL_PATH=not-set
SYSTEMPLATE_PATH=not-set
have_lo_path=false
AC_MSG_CHECKING([whether to run tests against a LibreOffice])
if test -n "$with_lo_path"; then
   version_file="$with_lo_path/program/versionrc"
   if test -f $version_file; then
     LO_PATH="$with_lo_path"
     JAILS_PATH="\${abs_top_builddir}/jails"
     SYSTEMPLATE_PATH="\${abs_top_builddir}/systemplate"
     have_lo_path=true
     lo_msg="test against $LO_PATH"
     AC_MSG_RESULT([yes])
   else
     AC_MSG_ERROR([LibreOffice install looks dodgy, missing $version_file])
   fi
else
   lo_msg="no integration tests"
   AC_MSG_RESULT([no])
fi
AC_SUBST(LO_PATH)
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

PKG_CHECK_MODULES([CPPUNIT], [cppunit])

AS_IF([test "$enable_ssl" != "no"],
      [AC_DEFINE([ENABLE_SSL],1,[Whether to enable SSL])],
      [AC_DEFINE([ENABLE_SSL],0,[Whether to enable SSL])])

AM_CONDITIONAL([ENABLE_SSL], [test "$enable_ssl" != "no"])

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

AC_PATH_PROG(NPM, npm, no)
if test "$NPM" = "no"; then
    AC_MSG_ERROR([npm required to build loleaflet, but not installed])
else
    NPM_VER=`npm -v | awk -F. '{ print (($1 * 100) + $2) * 100 + $3;}'`
    if test "$NPM_VER" -ge 30900 -a "$NPM_VER" -lt 31004; then
        AC_MSG_ERROR([This npm version is buggy, either upgrade to >= 3.10.4 or downgrade to < 3.9.0])
    fi
fi

test "$prefix" = NONE && prefix=$ac_default_prefix
LOOLWSD_CACHEDIR=${localstatedir}/cache/${PACKAGE}
while :; do
    oldvalue=$LOOLWSD_CACHEDIR
    LOOLWSD_CACHEDIR=`eval echo $LOOLWSD_CACHEDIR`
    test $LOOLWSD_CACHEDIR = $oldvalue && break
done

AC_DEFINE_UNQUOTED([LOOLWSD_CACHEDIR],["$LOOLWSD_CACHEDIR"],[Cache folder])
AC_SUBST(LOOLWSD_CACHEDIR)

LOOLWSD_CONFIGDIR=${sysconfdir}/${PACKAGE}
AC_SUBST(LOOLWSD_CONFIGDIR)

LOOLWSD_DATADIR=${datadir}/${PACKAGE}
AC_SUBST(LOOLWSD_DATADIR)

AC_CONFIG_FILES([Makefile
                 test/Makefile
                 loolwsd.spec
                 loolwsd.xml
                 maketarballfordeb.sh])
AC_CONFIG_FILES([test/run_unit.sh],[chmod +x test/run_unit.sh])

AC_OUTPUT

AC_LANG_POP

echo "
Configuration:
    LOKit path              ${lokit_msg}
    LO integration tests    ${lo_msg}
    SSL support             $ssl_msg
    Debug & low security    $debug_msg

    \$ make # to compile"
if test -n "$with_lo_path"; then
echo "    \$ make run # to start loolwsd
"
fi

dnl vim:set shiftwidth=4 softtabstop=4 expandtab:

