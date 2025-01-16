# Collabora Online WebSocket server

## Dependencies

Collabora Online WebSocket server has the following dependencies:

- libpng
- Poco library: https://pocoproject.org/
- OpenSSL (when configured with --enable-ssl)
- libzstd
- libcap-dev (Debian/Ubuntu) / libcap-progs (SUSE/openSUSE) / libcap-devel (RedHat/CentOS)
- libpam-dev (Debian/Ubuntu) / pam-devel (RedHat/CentOS/SUSE/openSUSE)

On Debian distros, this boils down to:
apt install libssl-dev libpng-dev libcap-dev libzstd-dev libpam-dev libcppunit libcppunit-dev

If your Linux distro doesn't provide a Poco package (versions 1.7.5 and
newer should work), you can build it yourself and install in a
location of your choice.

To build it, the following can be used:
./configure --no-tests --no-samples --omit=Zip,Data,Data/SQLite,Data/ODBC,Data/MySQL,MongoDB,PDF --prefix=/usr
make install

## Building

coolwsd uses autoconf/automake, so especially when building from .git
(as opposed to from a distribution tarball) you need to run:

    ./autogen.sh

and then

    ./configure --enable-silent-rules --with-lokit-path=${MASTER}/include \
    		--with-lo-path=${MASTER}/instdir --enable-debug
    make

where ${MASTER} is the location of the LibreOffice source tree.

When building from a tarball less magic is needed.

Run 'make check' after each commit.

If you have self-built Poco, add the following to ./configure:

    --with-poco-includes=<POCOINST>/include --with-poco-libs=<POCOINST>/lib

where <POCOINST> means the Poco installation location.

## Running

You can just do:

    make run

and follow the link that recommends (see browser/README for more info).

Again, ${MASTER} is location of the LibreOffice source tree with a built
LibreOffice. This is work in progress, and consequently needs the latest
LibreOffice master.

## Running manually

If you want to do the 'make run' yourself, you need to set up a minimal
chroot system, and directory for the jails:

    SYSTEMPLATE=`pwd`/systemplate  # or tweak for your system
    ROOTFORJAILS=`pwd`/jails       # or tweak for your system
    ROOTFORCACHE=`pwd`/cache       # or tweak for your system

    rm -Rf ${SYSTEMPLATE} # clean
    ./coolwsd-systemplate-setup ${SYSTEMPLATE} ${MASTER}/instdir # build template
    mkdir -p ${ROOTFORJAILS} # create location for transient jails.
    mkdir -p ${ROOTFORCACHE} # create location for persistent cache.

To run coolwsd the way it is supposed to eventually be run "for real", you can
now do:

    ./coolwsd --o:sys_template_path=${SYSTEMPLATE} --o:child_root_path=${ROOTFORJAILS} --o:cache_files.path=${ROOTFORCACHE}

The ${SYSTEMPLATE} is a directory tree set up using the
coolwsd-systemplate-setup script here. (It should not exist before
running the script.) It will contain the runtime environment needed by
the LibreOffice dynamic libraries used through LibreOfficeKit.
Improvements to that script are very likely needed on various distros.

The ${ROOTFORJAILS} directory above is a presumably initially empty
directory under which coolwsd will create chroot jails for editing
each specific document.
Warning: the jails directory and its contents are deleted by coolwsd.

As coolwsd uses hardlinks to "copy" the contents of both
${SYSTEMPLATE} and the ${MASTER}/instdir directories into each chroot
jail, ${SYSTEMPLATE} and ${MASTER}/instdir need to be on the same file
system as ${ROOTFORJAILS}.

Leaflet files are served itself by coolwsd internal file server. You
can specify the root of this fileserver using the --o:file_server_root_path
flag in coolwsd commandline. By default, if you do not specify this
flag, the parent directory of coolwsd/ is assumed to be the
file_server_root_path. So, for development purposes, you can access the
COOL files (using /browser/), but it is advised to explicitly set
the file_server_root_path to prevent any unwanted files from reading,
especially when cool is deployed for normal public usage on servers.

Please note that it is necessary that all the COOL files that are
meant to be served is under a directory named 'browser'. Since, the
COOL files, in the git repo, are itself in a directory named
'browser', this would work out of the box for development purposes.

If you run coolwsd on HTTPS, you have to set up your own private key
and certificates (in PEM format only). The name and location of key,
certificate and CA certificate chain is defined in
${sysconfdir}/coolwsd/coolwsd.xml. Dummy self-signed cert.pem,
ca-chain.cert.pem and key.pem are already included, but it is better
to replace those with your own files.

To generate the new self-signed certificate, you can do the following. Maybe
there is a less verbose way, but this worked for me:

    # create the ca-chain.cert.pem

    mkdir private

    openssl genrsa -aes256 -out private/ca.key.pem 4096

    # You will be asked many questions, put the IP in Common Name
    openssl req -new -x509 -days 365 -key private/ca.key.pem -sha256 -extensions v3_ca -out ca.cert.pem

    openssl genrsa -aes256 -out private/intermediate.key.pem 4096

    openssl req -sha256 -new -key private/intermediate.key.pem -out intermediate.csr.pem

    mkdir -p demoCA/newcerts
    touch demoCA/index.txt
    echo 1000 > demoCA/serial
    openssl ca -keyfile private/ca.key.pem -cert ca.cert.pem -extensions v3_ca -notext -md sha256 -in intermediate.csr.pem -out intermediate.cert.pem

    cat intermediate.cert.pem ca.cert.pem > ca-chain.cert.pem

    # create the key / cert

    openssl genrsa -out key.pem 2048

    openssl req -sha256 -new -key key.pem -out csr.pem

    # change "unique_subject = yes" to "unique_subject = no" in demoCA/index.txt.attr
    # otherwise you'll get the following error:
    #   failed to update database
    #   TXT_DB error number 2

    openssl ca -keyfile private/ca.key.pem -cert ca.cert.pem -extensions usr_cert -notext -md sha256 -in csr.pem -out cert.pem

HTTPS is the default. HTTP-only mode can be enabled with --disable-ssl
configure option.

If you plan to hack on coolwsd, you probably want to familiarize
yourself with coolwsd's --o:num_prespawn_children switch, and the 'connect'
test program.

For interactive testing, you can use the 'connect' program. It accepts
"commands" from the protocol on standard input.

## Test running with integration for developers

Unless you want to test SSL itself, it is easier to go for the non-SSL option.

Setup Nextcloud or ownCloud on localhost, and install the richdocuments app.
Good tutorials exist how to install ownCloud or Nextcloud, we don't repeat
them here. richdocuments is called Collabora Online in the respective app
stores / marketplaces / whatever.

When you have a running Nextcloud or ownCloud instance at
http://localhost/nextcloud or at http://localhost/owncloud
go to Collabora Online settings, and set the WOPI URL to
http://localhost:9980

Then in the build tree, edit the generated coolwsd.xml and set ssl setting to
false. You can run make run, and test coolwsd with the ownCloud or Nextcloud
integration.

Note: if SSL is enabled in either Online or the integration, both must
have SSL enabled. That is, you must access NC/OC using https:// as well
as configure the Collabora Online endpoint in NC/OC as https://localhost:9980.

## Admin Panel

You can access the admin panel by directly accessing the admin.html file
from browser directory. See browser/README for more details.

Websocket connections to admin console can be made at path: /adminws/ on the
same url and port as coolwsd is running on. However, one needs a JWT token to
authenticate to the admin console websocket. This is stored as a cookie with
`Path: /adminws/` when user successfully authenticates when trying to access
/browser/dist/admin/admin\*html files (HTTP Basic authentication). Token
is expired after every half an hour, so websocket connection to admin console
must be established within this period.

It should also be possible to do various sorts of tasks such as killing
documents that are open for more than 10 hours etc. See protocol.txt for
various commands. Only tricky thing here is getting the JWT token which can
be obtained as described above.

## Debugging

When debugging, you want to pass `--o:num_prespawn_children=1` to coolwsd
to limit the number of concurrently running processes.

When a crash happens too early, you also want to

    export SLEEPFORDEBUGGER=<number of seconds>

or
    export PAUSEFORDEBUGGER=1

so that you have time to attach to the process.

Then run coolwsd, and attach your debugger to the process you are
interested in. Note that simply attaching gdb via `gdb -p` is not meant to work, your options are:

- `sudo gdb -p <PID>`, which is easy to remember or

- `gdb -iex "set sysroot /" -p <PID>`, which can run as an unprivileged user, since we switched from
  capabilities to unprivileged namespaces.

You can make the later an alias as well:

```
alias cool-gdb='gdb -iex "set sysroot /"'
cool-gdb -p <PID>
```

Also, note that as the child processes run in a chroot environment,
they see the LibreOffice shared libraries as being in a directory tree
/lo , but your debugger does not. So in order to be able to
effectively debug the LibreOffice code as used through LibreOfficeKit
by a child coolwsd process, you need to symlink the "lo" subdirectory
of a running child coolwsd process's chroot jail as /lo. Something like:

`sudo ln -s ~/libreoffice/master/cool-child-roots/1046829984599121011/lo /lo`

Use the ps command to find out exactly the path to use.

Set `COOL_DEBUG=1` to trap SIGSEGV and SEGBUS and prompt for debugger.

if you choose PAUSEFORDEBUGGER send the signal SIGUSR1 to resume the process

In order to run and debug one unit test, run the commandline that is printed
when the test fails. To run one single CppUnit test from a suite, additionally use:

    CPPUNIT_TEST_NAME="HTTPWSTest::testCalcEditRendering" <printed commandline>

## Protocol description

See protocol.txt for a description of the protocol to be used over the
websocket.

## Architecture

Please refer to https://sdk.collaboraonline.com/docs/architecture.html
