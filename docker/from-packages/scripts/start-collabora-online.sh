#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Fix domain name resolution from jails
cp /etc/resolv.conf /etc/hosts /opt/lool/systemplate/etc/

if test "${DONT_GEN_SSL_CERT-set}" = set; then
# Generate new SSL certificate instead of using the default
mkdir -p /tmp/ssl/
cd /tmp/ssl/
mkdir -p certs/ca
openssl rand -writerand /opt/lool/.rnd
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
mv certs/servers/localhost/privkey.pem /etc/loolwsd/key.pem
mv certs/servers/localhost/cert.pem /etc/loolwsd/cert.pem
mv certs/ca/root.crt.pem /etc/loolwsd/ca-chain.cert.pem
fi

# Disable warning/info messages of LOKit by default
if test "${SAL_LOG-set}" = set; then
SAL_LOG="-INFO-WARN"
fi

# Replace trusted host and set admin username and password - only if they are set
if test -n "${domain}"; then
    perl -pi -e "s/localhost<\/host>/${domain}<\/host>/g" /etc/loolwsd/loolwsd.xml
fi
if test -n "${username}"; then
    perl -pi -e "s/<username (.*)>.*<\/username>/<username \1>${username}<\/username>/" /etc/loolwsd/loolwsd.xml
fi
if test -n "${password}"; then
    perl -pi -e "s/<password (.*)>.*<\/password>/<password \1>${password}<\/password>/" /etc/loolwsd/loolwsd.xml
fi
if test -n "${server_name}"; then
    perl -pi -e "s/<server_name (.*)>.*<\/server_name>/<server_name \1>${server_name}<\/server_name>/" /etc/loolwsd/loolwsd.xml
fi
if test -n "${dictionaries}"; then
    perl -pi -e "s/<allowed_languages (.*)>.*<\/allowed_languages>/<allowed_languages \1>${dictionaries:-de_DE en_GB en_US es_ES fr_FR it nl pt_BR pt_PT ru}<\/allowed_languages>/" /etc/loolwsd/loolwsd.xml
fi
if test -n "${user_interface_mode}"; then
    extra_params="${extra_params} --o:user_interface.mode=${user_interface_mode}"
else
    extra_params="${extra_params} --o:user_interface.mode=notebookbar"
fi

# Restart when /etc/loolwsd/loolwsd.xml changes
[ -x /usr/bin/inotifywait -a /usr/bin/killall ] && (
  /usr/bin/inotifywait -e modify /etc/loolwsd/loolwsd.xml
  echo "$(ls -l /etc/loolwsd/loolwsd.xml) modified --> restarting"
  /usr/bin/killall -1 loolwsd
) &

# Generate WOPI proof key
loolwsd-generate-proof-key

# Start loolwsd
exec /usr/bin/loolwsd --version --o:sys_template_path=/opt/lool/systemplate --o:child_root_path=/opt/lool/child-roots --o:file_server_root_path=/usr/share/loolwsd --o:logging.color=false ${extra_params}
