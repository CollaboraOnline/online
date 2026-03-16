#! /usr/bin/env bash

srcdir=`dirname $0`
test -n "$srcdir" || srcdir=.

builddir=`pwd`
cd "$srcdir"

function failed {
    cat << EOF 1>&2

Result: $1 failed

Please try running the commands from autogen.sh manually, and fix errors.
EOF
    exit 1
}

if test `uname -s` = Linux -o `uname -s` = FreeBSD; then
    libtoolize || failed "libtool"
elif test `uname -s` = Darwin; then
    libtoolize || glibtoolize || failed "Can't find libtoolize or glibtoolize. Use lode or install it yourself."
fi

# On macOS with Homebrew, pkg.m4 and other m4 macros may live in a directory
# that aclocal does not search by default. Add it so that PKG_CHECK_MODULES
# and similar macros are found.
if test `uname -s` = Darwin -a -d /opt/homebrew/share/aclocal; then
    ACLOCAL_PATH="${ACLOCAL_PATH:+$ACLOCAL_PATH:}/opt/homebrew/share/aclocal"
    export ACLOCAL_PATH
fi

aclocal || failed "aclocal"

autoheader || failed "autoheader"

automake --add-missing || failed "automake"

autoreconf || failed "autoreconf"

scripts/refresh-git-hooks || failed "refresh-git-hooks"

cd "${builddir}"

if [ $# -gt 0 ]; then
    # If we got parameters, we can execute configure directly.
    echo -n "Result: All went OK, running $srcdir/configure "
    for arg in "$@"
    do
        echo -n "'${arg}' "
    done
    echo "now."
    $srcdir/configure "$@" || failed "configure"
    exit 0
fi

cat << EOF

Result: All went OK, please run $srcdir/configure (with the appropriate parameters) now.

EOF

# vim:set shiftwidth=4 softtabstop=4 expandtab:
