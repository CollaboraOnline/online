cmake_minimum_required(VERSION 3.4.1)

add_library(androidapp SHARED
            androidapp.c
            ../../../../../common/FileUtil.cpp
            ../../../../../common/Log.cpp
            ../../../../../common/MessageQueue.cpp
            ../../../../../common/Protocol.cpp
            ../../../../../common/Session.cpp
            ../../../../../common/SigUtil.cpp
            ../../../../../common/SpookyV2.cpp
            ../../../../../common/Unit.cpp
            ../../../../../common/Util.cpp
            ../../../../../kit/ChildSession.cpp
            ../../../../../kit/Kit.cpp
            ../../../../../net/FakeSocket.cpp
            ../../../../../net/Socket.cpp
            ../../../../../wsd/ClientSession.cpp
            ../../../../../wsd/DocumentBroker.cpp
            ../../../../../wsd/LOOLWSD.cpp
            ../../../../../wsd/Storage.cpp
            ../../../../../wsd/TileCache.cpp)

target_compile_definitions(androidapp PRIVATE LOOLWSD_CONFIGDIR="/etc/loolwsd") # TODO somewhere in assets maybe?

target_include_directories(androidapp PRIVATE
                           .                                         # path to androidapp.h
                           ../../../../..                            # path to config.h
                           ../../../../../common                     # the needed loolwsd includes
                           ../../../../../kit
                           ../../../../../net
                           ../../../../../wsd
                           /opt/poco-android/include                 # POCO
                           /local/libreoffice/master-android/workdir/UnpackedTarball/libpng # libpng
                           /local/libreoffice/master-android/include # LibreOfficeKit
                           )

target_link_libraries(androidapp
                      android
                      log
                      /local/libreoffice/master-android/workdir/LinkTarget/StaticLibrary/liblibpng.a
                      /opt/poco-android/lib/libPocoEncodings.a
                      /opt/poco-android/lib/libPocoFoundation.a
                      /opt/poco-android/lib/libPocoJSON.a
                      /opt/poco-android/lib/libPocoNet.a
                      /opt/poco-android/lib/libPocoRedis.a
                      /opt/poco-android/lib/libPocoUtil.a
                      /opt/poco-android/lib/libPocoXML.a
                      -static-libstdc++
                      )
