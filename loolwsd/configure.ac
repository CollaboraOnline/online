# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])

AC_INIT([loolwsd], [1.6.0], [libreoffice@lists.freedesktop.org])
LT_INIT([disable-static])

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

AC_CONFIG_SRCDIR([LOOLWSD.cpp])

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

AC_ARG_ENABLE([tests],
            AS_HELP_STRING([--disable-tests],
                           [Build and run unit tests]))

AC_ARG_ENABLE([ssl],
            AS_HELP_STRING([--disable-ssl],
                           [Compile without SSL support]))

# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

AS_IF([test "$enable_debug" = yes],
      [AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code and disable some security pieces ])])

# Test for build environment

CXXFLAGS="$CXXFLAGS -std=c++11"
CXXFLAGS="$CXXFLAGS -Wall -Wextra -Werror"
CFLAGS="$CFLAGS -Wall -Wextra -Werror"
AS_IF([test -z "$with_poco_libs"],
      [CXXFLAGS="$CXXFLAGS -Wshadow"])

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
      [CPPFLAGS="$CPPFLAGS -I${with_poco_includes}"])

AS_IF([test -n "$with_poco_libs"],
      [LDFLAGS="$LDFLAGS -L${with_poco_libs}"])

AS_IF([test -n "$with_libpng_includes"],
      [CPPFLAGS="$CPPFLAGS -I${with_libpng_includes}"])

AS_IF([test -n "$with_libpng_libs"],
      [LDFLAGS="$LDFLAGS -L${with_libpng_libs}"])

AS_IF([test `uname -s` = Linux],
      [AS_IF([test -n "$with_poco_libs"],
             [LDFLAGS="$LDFLAGS -Wl,-rpath,${with_poco_libs}"])])

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

AS_IF([test "$enable_tests" != "no"],
      [PKG_CHECK_MODULES([CPPUNIT], [cppunit])])

AS_IF([test "$enable_ssl" != "no"],
      [AC_DEFINE([ENABLE_SSL],1,[Enable SSL])])

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

AC_DEFINE_UNQUOTED([LOOLWSD_CACHEDIR],["$LOOLWSD_CACHEDIR"],[Cache folder])
AC_SUBST(LOOLWSD_CACHEDIR)

# FIXME
# LOOLWSD_CONFIGDIR=${sysconfdir}/${PACKAGE} -> #define LOOLWSD_CONFIGDIR "${prefix}/etc/loolwsd" in config.h ???
LOOLWSD_CONFIGDIR=/etc/${PACKAGE}
AC_DEFINE_UNQUOTED([LOOLWSD_CONFIGDIR],["$LOOLWSD_CONFIGDIR"],[Config folder])
AC_SUBST(LOOLWSD_CONFIGDIR)

AC_CONFIG_FILES([Makefile
                 test/Makefile
                 loolwsd.spec])
AC_CONFIG_FILES([test/run_unit.sh],[chmod +x test/run_unit.sh])
AC_CONFIG_FILES([test/run_test.sh],[chmod +x test/run_test.sh])

AC_OUTPUT

AC_LANG_POP

echo "
Configuration:
    Source code location:   ${srcdir}
    Build location:         ${top_builddir}
    LOKit path              ${lokit_msg}
    LO integration tests    ${lo_msg}
    SSL support             ${enable_ssl}

    Systemplate path        ${systemplate_msg}
    Jail path               ${jail_msg}
"

dnl vim:set shiftwidth=4 softtabstop=4 expandtab:
