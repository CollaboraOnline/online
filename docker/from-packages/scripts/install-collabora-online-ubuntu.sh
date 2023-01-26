#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Refresh repos otherwise installations later may fail
apt-get update

# Install HTTPS transport
apt-get -y install apt-transport-https

# Install tzdata to accept the TZ environment variable
apt-get -y install tzdata

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
secret_key=$(cat /run/secrets/secret_key)
if [ "$type" == "cool" ] && [ -n ${secret_key+set} ]; then
    echo "Based on the provided build arguments Collabora Online from customer repo will be used."
    if [ $(uname -i) == "ppc64le" ]; then
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/${version:-22.05}/customer-ubuntu2004-${secret_key} /" > /etc/apt/sources.list.d/collabora.list
    else
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/${version:-22.05}/customer-ubuntu1804-${secret_key} /" > /etc/apt/sources.list.d/collabora.list
    fi
elif [ "$type" == "key" ]; then
    echo "Based on the provided build arguments license key enabled Collabora Online will be used."
    echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/${version:-22.05}-key /" > /etc/apt/sources.list.d/collabora.list
else
    echo "Based on the provided build arguments Collabora Online Development Edition will be used."
    if [ $(uname -i) == "ppc64le" ]; then
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/repos-staging/CollaboraOnline/CODE-ubuntu2004 /" > /etc/apt/sources.list.d/collabora.list
    elif [ $(uname -i) == "aarch64" ]; then
        echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/CODE-arm64-ubuntu1804 /" > /etc/apt/sources.list.d/collabora.list
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
apt-get -y install coolwsd collaboraoffice-dict* collaboraofficebasis-ar collaboraofficebasis-as collaboraofficebasis-ast collaboraofficebasis-bg collaboraofficebasis-bn-in collaboraofficebasis-br collaboraofficebasis-ca collaboraofficebasis-calc collaboraofficebasis-ca-valencia collaboraofficebasis-core collaboraofficebasis-cs collaboraofficebasis-cy collaboraofficebasis-da collaboraofficebasis-de collaboraofficebasis-draw collaboraofficebasis-el collaboraofficebasis-en-gb collaboraofficebasis-en-us collaboraofficebasis-es collaboraofficebasis-et collaboraofficebasis-eu collaboraofficebasis-extension-pdf-import collaboraofficebasis-fi collaboraofficebasis-fr collaboraofficebasis-ga collaboraofficebasis-gd collaboraofficebasis-gl collaboraofficebasis-graphicfilter collaboraofficebasis-gu collaboraofficebasis-he collaboraofficebasis-hi collaboraofficebasis-hr collaboraofficebasis-hu collaboraofficebasis-id collaboraofficebasis-images collaboraofficebasis-impress collaboraofficebasis-is collaboraofficebasis-it collaboraofficebasis-ja collaboraofficebasis-km collaboraofficebasis-kn collaboraofficebasis-ko collaboraofficebasis-lt collaboraofficebasis-lv collaboraofficebasis-ml collaboraofficebasis-mr collaboraofficebasis-nb collaboraofficebasis-nl collaboraofficebasis-nn collaboraofficebasis-oc collaboraofficebasis-ooofonts collaboraofficebasis-ooolinguistic collaboraofficebasis-or collaboraofficebasis-pa-in collaboraofficebasis-pl collaboraofficebasis-pt collaboraofficebasis-pt-br collaboraofficebasis-ro collaboraofficebasis-ru collaboraofficebasis-sk collaboraofficebasis-sl collaboraofficebasis-sr collaboraofficebasis-sr-latn collaboraofficebasis-sv collaboraofficebasis-ta collaboraofficebasis-te collaboraofficebasis-tr collaboraofficebasis-uk collaboraofficebasis-vi collaboraofficebasis-writer collaboraofficebasis-zh-cn collaboraofficebasis-zh-tw

if [ -z "$nobrand" ]; then
if [ "$type" == "cool" ] || [ "$type" == "key" ]; then
    apt-get -y install collabora-online-brand
else
    apt-get -y install code-brand
fi
fi # $nobrand

# Install inotifywait and killall to automatic restart coolwsd, if coolwsd.xml changes
apt-get -y install inotify-tools psmisc

# Cleanup
rm -rf /var/lib/apt/lists/*

# Remove WOPI Proof key generated by the package, we need unique key for each container
rm -rf /etc/coolwsd/proof_key*

# Fix permissions
# cf. start-collabora-online.sh that is run by cool user
# # Fix domain name resolution from jails
# cp /etc/resolv.conf /etc/hosts /opt/cool/systemplate/etc/
chown cool:cool /opt/cool/systemplate/etc/hosts /opt/cool/systemplate/etc/resolv.conf
# generated ssl cert/key and WOPI proof key go into /etc/coolwsd
chown cool:cool /etc/coolwsd
