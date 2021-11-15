#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Refresh repos otherwise installations later may fail
apt-get update

# Install HTTPS transport
apt-get -y install apt-transport-https

# Install some more fonts
apt-get -y install fonts-open-sans

# Install gnupg2
apt-get -y install gnupg2

# install ca-certificates
apt-get -y install ca-certificates

# install ssh-keygen binary for the WOPI proof key
apt-get -y install openssh-client

# Install curl for simple healthchecks
apt-get -y install curl

# On ARM64 we built core with system nss
if [ $(uname -i) == "aarch64" ]; then
    apt-get -y install libnss3
fi

# Add Collabora repos
if [ "$type" == "cool" ] && [ -n ${secret_key+set} ]; then
    echo "Based on the provided build arguments Collabora Online from customer repo will be used."
    echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/${version:-6.4}/customer-ubuntu1804-${secret_key} /" >> /etc/apt/sources.list.d/collabora.list
elif [ "$type" == "key" ]; then
    echo "Based on the provided build arguments license key enabled Collabora Online will be used."
    echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/${version:-6.4}-key /" >> /etc/apt/sources.list.d/collabora.list
else
    echo "Based on the provided build arguments Collabora Online Development Edition will be used."
    if [ $(uname -i) == "aarch64" ]; then
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/CODE-arm64-ubuntu1804 /" >> /etc/apt/sources.list.d/collabora.list
    else
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/CODE-ubuntu1804 /" > /etc/apt/sources.list.d/collabora.list
    fi
fi

if [ "$repo" == "repos-snapshot" ]; then
    curl https://www.collaboraoffice.com/downloads/gpg/collaboraonline-snapshot-keyring.gpg --output /usr/share/keyrings/collaboraonline-snapshot-keyring.gpg
    sed -i "s/collaboraonline-release-keyring/collaboraonline-snapshot-keyring/" /etc/apt/sources.list.d/collabora.list
else
    curl https://www.collaboraoffice.com/downloads/gpg/collaboraonline-release-keyring.gpg --output /usr/share/keyrings/collaboraonline-release-keyring.gpg
fi
apt-get update

# Install the Collabora packages
if [ "$version" == "4.2" ] && [ "$type" != "code" ]; then
    corever=6.2
else
    corever=6.4
fi

apt-get -y install loolwsd collaboraoffice$corever-dict* collaboraofficebasis$corever-ar collaboraofficebasis$corever-as collaboraofficebasis$corever-ast collaboraofficebasis$corever-bg collaboraofficebasis$corever-bn-in collaboraofficebasis$corever-br collaboraofficebasis$corever-ca collaboraofficebasis$corever-calc collaboraofficebasis$corever-ca-valencia collaboraofficebasis$corever-core collaboraofficebasis$corever-cs collaboraofficebasis$corever-cy collaboraofficebasis$corever-da collaboraofficebasis$corever-de collaboraofficebasis$corever-draw collaboraofficebasis$corever-el collaboraofficebasis$corever-en-gb collaboraofficebasis$corever-en-us collaboraofficebasis$corever-es collaboraofficebasis$corever-et collaboraofficebasis$corever-eu collaboraofficebasis$corever-extension-pdf-import collaboraofficebasis$corever-fi collaboraofficebasis$corever-fr collaboraofficebasis$corever-ga collaboraofficebasis$corever-gd collaboraofficebasis$corever-gl collaboraofficebasis$corever-graphicfilter collaboraofficebasis$corever-gu collaboraofficebasis$corever-he collaboraofficebasis$corever-hi collaboraofficebasis$corever-hr collaboraofficebasis$corever-hu collaboraofficebasis$corever-id collaboraofficebasis$corever-images collaboraofficebasis$corever-impress collaboraofficebasis$corever-is collaboraofficebasis$corever-it collaboraofficebasis$corever-ja collaboraofficebasis$corever-km collaboraofficebasis$corever-kn collaboraofficebasis$corever-ko collaboraofficebasis$corever-lt collaboraofficebasis$corever-lv collaboraofficebasis$corever-ml collaboraofficebasis$corever-mr collaboraofficebasis$corever-nb collaboraofficebasis$corever-nl collaboraofficebasis$corever-nn collaboraofficebasis$corever-oc collaboraofficebasis$corever-ooofonts collaboraofficebasis$corever-ooolinguistic collaboraofficebasis$corever-or collaboraofficebasis$corever-pa-in collaboraofficebasis$corever-pl collaboraofficebasis$corever-pt collaboraofficebasis$corever-pt-br collaboraofficebasis$corever-ro collaboraofficebasis$corever-ru collaboraofficebasis$corever-sk collaboraofficebasis$corever-sl collaboraofficebasis$corever-sr collaboraofficebasis$corever-sr-latn collaboraofficebasis$corever-sv collaboraofficebasis$corever-ta collaboraofficebasis$corever-te collaboraofficebasis$corever-tr collaboraofficebasis$corever-uk collaboraofficebasis$corever-vi collaboraofficebasis$corever-writer collaboraofficebasis$corever-zh-cn collaboraofficebasis$corever-zh-tw

if [ "$type" == "cool" ] || [ "$type" == "key" ]; then
    apt-get -y install collabora-online-brand
else
    apt-get -y install code-brand
fi

# Install inotifywait and killall to automatic restart loolwsd, if loolwsd.xml changes
apt-get -y install inotify-tools psmisc

# Cleanup
rm -rf /var/lib/apt/lists/*

# Remove WOPI Proof key generated by the package, we need unique key for each container
rm -rf /etc/loolwsd/proof_key*

# Fix permissions
# cf. start-collabora-online.sh that is run by lool user
# # Fix domain name resolution from jails
# cp /etc/resolv.conf /etc/hosts /opt/cool/systemplate/etc/
chown cool:cool /opt/cool/systemplate/etc/hosts /opt/cool/systemplate/etc/resolv.conf
# generated ssl cert/key and WOPI proof key go into /etc/loolwsd
chown cool:cool /etc/loolwsd
