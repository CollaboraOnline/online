#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Fix domain name resolution from jails
cp /etc/resolv.conf /etc/hosts /opt/cool/systemplate/etc/

if test "${DONT_GEN_SSL_CERT-set}" = set; then
# Generate new SSL certificate instead of using the default
mkdir -p /tmp/ssl/
cd /tmp/ssl/
mkdir -p certs/ca
openssl rand -writerand /opt/cool/.rnd
openssl genrsa -out certs/ca/root.key.pem 2048
openssl req -x509 -new -nodes -key certs/ca/root.key.pem -days 9131 -out certs/ca/root.crt.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=Dummy Authority"
mkdir -p certs/servers
mkdir -p certs/tmp
mkdir -p certs/servers/localhost
openssl genrsa -out certs/servers/localhost/privkey.pem 2048
if test "${cert_domain-set}" = set; then
openssl req -key certs/servers/localhost/privkey.pem -new -sha256 -out certs/tmp/localhost.csr.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=localhost"
else
openssl req -key certs/servers/localhost/privkey.pem -new -sha256 -out certs/tmp/localhost.csr.pem -subj "/C=DE/ST=BW/L=Stuttgart/O=Dummy Authority/CN=${cert_domain}"
fi
openssl x509 -req -in certs/tmp/localhost.csr.pem -CA certs/ca/root.crt.pem -CAkey certs/ca/root.key.pem -CAcreateserial -out certs/servers/localhost/cert.pem -days 9131
mv certs/servers/localhost/privkey.pem /etc/coolwsd/key.pem
mv certs/servers/localhost/cert.pem /etc/coolwsd/cert.pem
mv certs/ca/root.crt.pem /etc/coolwsd/ca-chain.cert.pem
fi

# Disable warning/info messages of LOKit by default
if test "${SAL_LOG-set}" = set; then
SAL_LOG="-INFO-WARN"
fi

# Replace trusted host and set admin username and password - only if they are set
if test -n "${aliasgroup1}" -o -n "${domain}" -o -n "${remoteconfigurl}"; then
    perl -w /start-collabora-online.pl || { exit 1; }
fi
if test -n "${username}"; then
    perl -pi -e "s/<username (.*)>.*<\/username>/<username \1>${username}<\/username>/" /etc/coolwsd/coolwsd.xml
fi
if test -n "${password}"; then
    perl -pi -e "s/<password (.*)>.*<\/password>/<password \1>${password}<\/password>/" /etc/coolwsd/coolwsd.xml
fi
if test -n "${server_name}"; then
    perl -pi -e "s/<server_name (.*)>.*<\/server_name>/<server_name \1>${server_name}<\/server_name>/" /etc/coolwsd/coolwsd.xml
fi
if test -n "${dictionaries}"; then
    perl -pi -e "s/<allowed_languages (.*)>.*<\/allowed_languages>/<allowed_languages \1>${dictionaries:-de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru}<\/allowed_languages>/" /etc/coolwsd/coolwsd.xml
fi

# Restart when /etc/coolwsd/coolwsd.xml changes
[ -x /usr/bin/inotifywait -a /usr/bin/killall ] && (
  /usr/bin/inotifywait -e modify /etc/coolwsd/coolwsd.xml
  echo "$(ls -l /etc/coolwsd/coolwsd.xml) modified --> restarting"
  /usr/bin/killall -1 coolwsd
) &

# Generate WOPI proof key
coolwsd-generate-proof-key

# Start coolwsd
exec /usr/bin/coolwsd --version --o:sys_template_path=/opt/cool/systemplate --o:child_root_path=/opt/cool/child-roots --o:file_server_root_path=/usr/share/coolwsd --o:logging.color=false ${extra_params}
