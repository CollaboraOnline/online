#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if test "${DONT_GEN_SSL_CERT-set}" = set; then
# Generate new SSL certificate instead of using the default
mkdir -p /tmp/ssl/
cd /tmp/ssl/
mkdir -p certs/ca
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
cert_params="\
 --o:ssl.cert_file_path=/tmp/ssl/certs/servers/localhost/cert.pem \
 --o:ssl.key_file_path=/tmp/ssl/certs/servers/localhost/privkey.pem \
 --o:ssl.ca_file_path=/tmp/ssl/certs/ca/root.crt.pem"
fi

# OpenShift assign a random UID to container but Collabora Online expects
# cool user do certain operation like spawning Forkit.
# Build a tiny passwd file mapping this random assigned UID to "cool" if userId is not "1001"
user_id=$(id -u)
group_id=$(id -g)
if [ "$user_id" -ne 1001 ]; then
  echo "cool:x:${user_id}:${group_id}::/opt/cool:/usr/sbin/nologin" >/tmp/passwd

  # Reuse the real /etc/group so group lookups still work
  cp /etc/group /tmp/group

  # Tell libc to use our files, via LD_PRELOAD
  export NSS_WRAPPER_PASSWD=/tmp/passwd
  export NSS_WRAPPER_GROUP=/tmp/group
  export LD_PRELOAD=libnss_wrapper.so
fi

# Start coolwsd
exec /usr/bin/coolwsd --version --use-env-vars ${cert_params} --o:sys_template_path=/opt/cool/systemplate --o:child_root_path=/opt/cool/child-roots --o:file_server_root_path=/usr/share/coolwsd --o:cache_files.path=/opt/cool/cache --o:logging.color=false --o:stop_on_config_change=true ${extra_params} "$@"
