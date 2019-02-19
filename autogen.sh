#! /bin/bash

srcdir=`dirname $0`
test -n "$srcdir" || srcdir=.

olddir=`pwd`
cd "$srcdir"

function failed {
    cat << EOF 1>&2

Result: $1 failed

Please try running the commands from autogen.sh manually, and fix errors.
EOF
    exit 1
}

if test `uname -s` = Linux; then
    libtoolize || failed "libtool"
elif test `uname -s` = Darwin; then
    echo 'Having glibtoolize is mandatory only if you intend to use the alternative "brew" method. See ios/README.' >&2
    echo 'So unless you plan to do that, it does not matter if glibtoolize is not be found below:' >&2
    glibtoolize
    echo 'There. The script now continues. Errors below are fatal.' >&2
fi

aclocal || failed "aclocal"

autoheader || failed "autoheader"

automake --add-missing || failed "automake"

autoreconf || failed "autoreconf"

cat << EOF

Result: All went OK, please run $srcdir/configure (with the appropriate parameters) now.

EOF

cd "$olddir"
