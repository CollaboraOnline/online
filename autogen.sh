#! /bin/bash

function failed {
    cat << EOF 1>&2

Result: $1 failed

Please try running the commands from autogen.sh manually, and fix errors.
EOF
    exit 1
}

libtoolize || failed "libtool"

aclocal || failed "aclocal"

autoheader || failed "autoheader"

automake --add-missing || failed "automake"

autoreconf || failed "autoreconf"

cat << EOF

Result: All went OK, please run ./configure (with the appropriate parameters) now.

EOF
