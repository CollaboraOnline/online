#!/bin/bash

# rename script to be run before branching.

mkdir -p wsd
mkdir -p doc
mkdir -p kit
mkdir -p common
mkdir -p tools
mkdir -p test
mkdir -p bundled
mkdir -p etc
mkdir -p debian

git mv loolwsd/* wsd

git mv wsd/test/* test
git mv wsd/bundled/* bundled
git mv wsd/etc/* etc
git mv wsd/debian/* debian
git mv wsd/common/* common

for commonfile in IoUtil Log MessageQueue Unit UnitHTTP Util; do
    git mv wsd/$commonfile.cpp common;
    git mv wsd/$commonfile.hpp common;
done
git mv wsd/Png.hpp common
git mv wsd/Common.hpp common
git mv wsd/Rectangle.hpp common
git mv wsd/LOOLProtocol.cpp common/Protocol.cpp
git mv wsd/LOOLProtocol.hpp common/Protocol.hpp
git mv wsd/LOOLSession.cpp common/Session.cpp
git mv wsd/LOOLSession.hpp common/Session.hpp
git mv wsd/security.h common/security.h

git mv wsd/ChildSession.cpp kit
git mv wsd/ChildSession.hpp kit
git mv wsd/LOOLForKit.cpp kit/ForKit.cpp
git mv wsd/LOOLKit.cpp kit/Kit.cpp
git mv wsd/LOOLKit.hpp kit/Kit.hpp
git mv wsd/LOKitHelper.hpp kit/KitHelper.hpp

git mv wsd/Connect.cpp tools
git mv wsd/LOKitClient.cpp tools/KitClient.cpp
git mv wsd/loolmount.c tools/mount.c
git mv wsd/loolmap.c tools/map.c
git mv wsd/LOOLTool.cpp tools/Tool.cpp
git mv wsd/LOOLStress.cpp tools/Stress.cpp

for file in discovery.xml favicon.ico loolwsd.xml.in \
            loolwsd.service robots.txt sysconfig.loolwsd \
            configure.ac Makefile.am autogen.sh \
            COPYING AUTHORS ChangeLog INSTALL NEWS PROBLEMS \
            loolstat loolwsd-systemplate-setup loolwsd.spec.in \
            maketarballfordeb.sh.in TODO \
    ; do
	git mv wsd/$file .
done

git mv loolwsd/.gitignore .
git mv loolwsd/.clang-tidy .
rmdir loolwsd
