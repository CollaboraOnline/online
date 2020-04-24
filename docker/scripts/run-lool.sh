#!/bin/bash
# This file is part of the LibreOffice project.
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

export LC_CTYPE=en_US.UTF-8

# Fix domain name resolution from jails
cp /etc/resolv.conf /etc/hosts /opt/lool/systemplate/etc/

if test "${DONT_GEN_SSL_CERT-set}" == set; then
# Generate new SSL certificate instead of using the default
mkdir -p /opt/ssl/
cd /opt/ssl/
mkdir -p certs/ca
openssl rand -writerand /opt/lool/.rnd
openssl genrsa -out certs/ca/root.key.pem 2048
openssl req -x509 -new -nodes -key certs/ca/root.key.pem -days 9131 -out certs/ca/root.crt.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=Dummy Authority"
mkdir -p certs/{servers,tmp}
mkdir -p certs/servers/localhost
openssl genrsa -out certs/servers/localhost/privkey.pem 2048
openssl req -key certs/servers/localhost/privkey.pem -new -sha256 -out certs/tmp/localhost.csr.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=localhost"
openssl x509 -req -in certs/tmp/localhost.csr.pem -CA certs/ca/root.crt.pem -CAkey certs/ca/root.key.pem -CAcreateserial -out certs/servers/localhost/cert.pem -days 9131
mv certs/servers/localhost/privkey.pem /etc/loolwsd/key.pem
mv certs/servers/localhost/cert.pem /etc/loolwsd/cert.pem
mv certs/ca/root.crt.pem /etc/loolwsd/ca-chain.cert.pem
fi

# Replace trusted host
perl -pi -e "s/localhost<\/host>/${domain}<\/host>/g" /etc/loolwsd/loolwsd.xml
perl -pi -e "s/<username (.*)>.*<\/username>/<username \1>${username}<\/username>/" /etc/loolwsd/loolwsd.xml
perl -pi -e "s/<password (.*)>.*<\/password>/<password \1>${password}<\/password>/" /etc/loolwsd/loolwsd.xml


# Restart when /etc/loolwsd/loolwsd.xml changes
[ -x /usr/bin/inotifywait -a /usr/bin/pkill ] && (
	/usr/bin/inotifywait -e modify /etc/loolwsd/loolwsd.xml
	echo "$(ls -l /etc/loolwsd/loolwsd.xml) modified --> restarting"
	pkill -f --signal 1 loolwsd
) &

# Generate WOPI proof key
loolwsd-generate-proof-key

# Start loolwsd
exec /usr/bin/loolwsd --version --o:sys_template_path=/opt/lool/systemplate --o:child_root_path=/opt/lool/child-roots --o:file_server_root_path=/usr/share/loolwsd ${extra_params}
