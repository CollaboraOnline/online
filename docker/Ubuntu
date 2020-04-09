# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

FROM ubuntu:18.04

# refresh repos otherwise installations later may fail
# install LibreOffice run-time dependencies
# install adduser, findutils, openssl and cpio that we need later
# install an editor
# tdf#117557 - Add CJK Fonts to LibreOffice Online Docker Image
RUN apt-get update && \
    apt-get -y install libpng16-16 fontconfig adduser cpio \
               findutils nano libpocoxml50 libpocoutil50 libpoconetssl50 \
               libpoconet50 libpocojson50 libpocofoundation50 libpococrypto50 \
               libcap2-bin openssl openssh-client inotify-tools procps \
               libxcb-shm0 libxcb-render0 libxrender1 libxext6 \
               fonts-wqy-zenhei fonts-wqy-microhei fonts-droid-fallback \
               fonts-noto-cjk

# copy freshly built LibreOffice master and LibreOffice Online master with latest translations
COPY /instdir /

# copy the shell script which can start LibreOffice Online (loolwsd)
COPY /scripts/run-lool.sh /

# set up LibreOffice Online (normally done by postinstall script of package)
# Fix permissions
RUN setcap cap_fowner,cap_mknod,cap_sys_chroot=ep /usr/bin/loolforkit && \
    setcap cap_sys_admin=ep /usr/bin/loolmount && \
    adduser --quiet --system --group --home /opt/lool lool && \
    mkdir -p /var/cache/loolwsd && chown lool: /var/cache/loolwsd && \
    rm -rf /var/cache/loolwsd/* && \
    rm -rf /opt/lool && \
    mkdir -p /opt/lool/child-roots && \
    loolwsd-systemplate-setup /opt/lool/systemplate /opt/libreoffice >/dev/null 2>&1 && \
    touch /var/log/loolwsd.log && \
    chown lool:lool /var/log/loolwsd.log && \
    chown -R lool:lool /opt/ && \
    chown -R lool:lool /etc/loolwsd

EXPOSE 9980

# switch to lool user (use numeric user id to be compatible with Kubernetes Pod Security Policies)
USER 101

CMD bash /run-lool.sh
