# syntax=docker/dockerfile:1.4
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

FROM debian:stable-slim
MAINTAINER Andras Timar <andras.timar@collabora.com>

# repo: can be 'repos', 'repos-staging', 'repos-snapshot'
# Optional. The default is 'repos'.
ARG repo

# type: can be
# 'code' - Collabora Online Development Edition
# 'cool' - Collabora Online, to build this you need to give your secret URL part from https://support.collaboraoffice.com, i.e. you have to be Collabora partner or customer
# 'key'  - Collabora Online, the license key enabled version.
# Optional. The default is 'code'.
ARG type

# Optional. If defined then brand package will not be installed.
ARG nobrand

# UTF-8 locale is needed to handle file names with non-ASCII characters
ENV LC_CTYPE C.UTF-8

# Mount secret URL part (for type 'cool') securely
RUN --mount=type=secret,id=secret_key \
# Update repos before installing packages
    apt-get update && \
# Install dependencies of installer of Collabora Online
    apt-get -y install cpio tzdata libcap2-bin apt-transport-https gnupg2 ca-certificates curl && \
# Setup Collabora repo
    repourl="https://collaboraoffice.com/${repo:-repos}/CollaboraOnline/"; \
    secret_key=$(cat /run/secrets/secret_key); \
    if [ "$type" = "cool" ] && [ -n ${secret_key+set} ]; then \
        echo "Based on the provided build arguments Collabora Online from customer repo will be used."; \
        repourl="${repourl}23.05/customer-deb-${secret_key}/"; \
    elif [ "$type" = "key" ]; then \
        echo "Based on the provided build arguments license key enabled Collabora Online will be used."; \
        repourl="${repourl}23.05-key/"; \
    else \
        echo "Based on the provided build arguments Collabora Online Development Edition will be used."; \
        repourl="${repourl}23.05-CODE/CODE-deb/"; \
    fi && \
    echo "deb [signed-by=/usr/share/keyrings/collaboraonline-release-keyring.gpg] ${repourl} /" > /etc/apt/sources.list.d/collabora.list && \
# Download Collabora package signing key
    if [ "$repo" = "repos-snapshot" ]; then \
        curl https://www.collaboraoffice.com/downloads/gpg/collaboraonline-snapshot-keyring.gpg --output /usr/share/keyrings/collaboraonline-snapshot-keyring.gpg; \
        sed -i "s/collaboraonline-release-keyring/collaboraonline-snapshot-keyring/" /etc/apt/sources.list.d/collabora.list; \
    else \
        curl https://www.collaboraoffice.com/downloads/gpg/collaboraonline-release-keyring.gpg --output /usr/share/keyrings/collaboraonline-release-keyring.gpg; \
    fi && \
# Update repos again
    apt-get update && \
# Install Collabora Online (Collabora Office is a dependency)
    apt-get -y install coolwsd \
# Install all dictionaries
                       collaboraoffice-dict-* \
# Install all language packs
                       collaboraofficebasis-ar \
                       collaboraofficebasis-bg \
                       collaboraofficebasis-ca \
                       collaboraofficebasis-cs \
                       collaboraofficebasis-da \
                       collaboraofficebasis-de \
                       collaboraofficebasis-el \
                       collaboraofficebasis-en-gb \
                       collaboraofficebasis-en-us \
                       collaboraofficebasis-eo \
                       collaboraofficebasis-es \
                       collaboraofficebasis-eu \
                       collaboraofficebasis-fi \
                       collaboraofficebasis-fr \
                       collaboraofficebasis-gl \
                       collaboraofficebasis-he \
                       collaboraofficebasis-hr \
                       collaboraofficebasis-hu \
                       collaboraofficebasis-id \
                       collaboraofficebasis-is \
                       collaboraofficebasis-it \
                       collaboraofficebasis-ja \
                       collaboraofficebasis-ko \
                       collaboraofficebasis-lo \
                       collaboraofficebasis-nb \
                       collaboraofficebasis-nl \
                       collaboraofficebasis-oc \
                       collaboraofficebasis-pl \
                       collaboraofficebasis-pt \
                       collaboraofficebasis-pt-br \
                       collaboraofficebasis-ru \
                       collaboraofficebasis-sk \
                       collaboraofficebasis-sl \
                       collaboraofficebasis-sq \
                       collaboraofficebasis-sv \
                       collaboraofficebasis-tr \
                       collaboraofficebasis-uk \
                       collaboraofficebasis-vi \
                       collaboraofficebasis-zh-cn \
                       collaboraofficebasis-zh-tw && \
# Install brand package (or not)
    if [ -z "$nobrand" ]; then \
        if [ "$type" = "cool" ] || [ "$type" = "key" ]; then \
            apt-get -y install collabora-online-brand; \
        else \
            apt-get -y install code-brand; \
        fi; \
    fi && \
# Fix ownership of config directory that will be modified on start of the container by cool user
    chown cool:cool /etc/coolwsd && \
# Remove perl-base, it's not needed and triggered some license scanner because of Paul Hsieh derivative license
    dpkg --purge  --force-remove-essential --ignore-depends=perl-base perl-base && \
# Cleanup
    rm -rf /var/lib/apt/* && \
# Remove WOPI Proof key generated by the package, we need unique key for each container
    rm -rf /etc/coolwsd/proof_key*

# FIXME
# Use the old starter script until we find out how to replace it.
COPY /scripts/start-collabora-online.sh /

# coolwsd listens on port 9980
EXPOSE 9980

# Switch to cool user (use numeric user id to be compatible with Kubernetes Pod Security Policies)
USER 100

# FIXME
# Use the old starter script until we find out how to replace it.
CMD ["/start-collabora-online.sh"]

