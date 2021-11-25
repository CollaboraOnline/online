FROM gitpod/workspace-full-vnc

RUN sudo sh -c "echo deb-src http://archive.ubuntu.com/ubuntu/ focal main restricted >> /etc/apt/sources.list" \
 && sudo sh -c "echo deb-src http://archive.ubuntu.com/ubuntu/ focal-updates main restricted >> /etc/apt/sources.list" \
 && sudo sh -c "echo deb-src http://security.ubuntu.com/ubuntu/ focal-security main restricted >> /etc/apt/sources.list" \
 && sudo sh -c "echo deb-src http://security.ubuntu.com/ubuntu/ focal-security universe >> /etc/apt/sources.list" \
 && sudo sh -c "echo deb-src http://security.ubuntu.com/ubuntu/ focal-security multiverse >> /etc/apt/sources.list" \
 && sudo apt-get update \
 && sudo apt-get install -y \
    build-essential git libpoco-dev libcap-dev python3-polib npm libpng-dev python3-lxml libpam-dev firefox chromium-browser\
 && sudo apt-get build-dep -y libreoffice \
 && pip install lxml \
 && pip install polib \
 && sudo rm -rf /var/lib/apt/lists/*

