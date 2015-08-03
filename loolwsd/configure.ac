# -*- Mode: Autoconf; tab-width: 4; indent-tabs-mode: nil -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])

AC_INIT([loolwsd], [1.2.3], [libreoffice@collabora.com])

AM_INIT_AUTOMAKE([1.11 silent-rules])

AC_CONFIG_SRCDIR([LOOLWSD.cpp])

AC_CONFIG_HEADERS([config.h])

# Checks for programs.
AC_PROG_CXX

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
                           [Path the "include" directory with the LibreOfficeKit headers]))

AC_ARG_WITH([poco-includes],
            AS_HELP_STRING([--with-poco-includes=<path>],
                           [Path the "include" directory with the Poco headers]))

AC_ARG_WITH([poco-libs],
            AS_HELP_STRING([--with-poco-libs=<path>],
                           [Path the "lib" directory with the Poco libraries]))

AC_ARG_WITH([libpng-includes],
            AS_HELP_STRING([--with-libpng-includes=<path>],
                           [Path the "include" directory with the libpng headers]))

AC_ARG_WITH([libpng-libs],
            AS_HELP_STRING([--with-libpng-libs=<path>],
                           [Path the "lib" directory with the libpng libraries]))

# Handle options
AS_IF([test "$enable_debug" = yes -a -n "$with_poco_libs"],
      [POCO_DEBUG_SUFFIX=d],
      [POCO_DEBUG_SUFFIX=])

AS_IF([test "$enable_debug" = yes],
      [AC_DEFINE([ENABLE_DEBUG],1,[Whether to compile in some extra debugging support code])])

# Test for build environment

CXXFLAGS="$CXXFLAGS -std=c++11"
CXXFLAGS="$CXXFLAGS -Wall -Werror"

AS_IF([test -n "$with_lokit_path"],
      [CPPFLAGS="$CPPFLAGS -I${with_lokit_path}"])

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

LIBS="$LIBS -lPocoNet${POCO_DEBUG_SUFFIX} -lPocoUtil${POCO_DEBUG_SUFFIX} -lPocoXML${POCO_DEBUG_SUFFIX} -lPocoJSON${POCO_DEBUG_SUFFIX} -lPocoFoundation${POCO_DEBUG_SUFFIX}"

AC_CHECK_HEADERS([LibreOfficeKit/LibreOfficeKit.h],
                 [],
                 [AC_MSG_ERROR([header LibreOfficeKit/LibreOfficeKit.h not found, perhaps you want to use --with-lokit-path])])
AC_CHECK_HEADERS([Poco/Net/WebSocket.h],
                 [],
                 [AC_MSG_ERROR([header Poco/Net/WebSocket.h not found, perhaps you want to use --with-poco-includes])])

AC_MSG_CHECKING([POCO version])
AC_COMPILE_IFELSE([AC_LANG_SOURCE([
#include <Poco/Version.h>
#if POCO_VERSION < 0x01060000
#error Require Poco 1.6.0 or newer
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

AC_CONFIG_FILES([Makefile
                 loolwsd.spec])
AC_OUTPUT

AC_LANG_POP
