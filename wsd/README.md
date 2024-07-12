# Collabora Online WebSocket server

## Dependencies

Collabora Online WebSocket server has the following dependencies:

- libpng
- Poco library: https://pocoproject.org/
- libcap-dev (Debian/Ubuntu) / libcap-progs (SUSE/openSUSE) / libcap-devel (RedHat/CentOS)
- libpam-dev (Debian/Ubuntu) / pam-devel (RedHat/CentOS/SUSE/openSUSE)

If your Linux distro doesn't provide a Poco package (versions 1.7.5 and
newer should work), you can build it yourself and install in a
location of your choice.

On openSUSE Leap 15.1, you can use:

    zypper ar http://download.opensuse.org/repositories/devel:/libraries:/c_c++/openSUSE_Leap_15.1/devel:libraries:c_c++.repo
    zypper in poco-devel libcap-progs python3-polib libcap-devel npm

Similar repos exist for other openSUSE and SLE releases.

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

If you have the Poco debugging libraries (eg. you have a self-built
Poco), you can add --enable-debug to the configure options for
additional debugging.

For Windows, a proper VS2013 project is needed.

There is still unconditional debugging output etc. This is a work in
progress.

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

    rm -Rf ${SYSTEMPLATE} # clean
    ./coolwsd-systemplate-setup ${SYSTEMPLATE} ${MASTER}/instdir # build template
    mkdir -p ${ROOTFORJAILS} # create location for transient jails.

To run coolwsd the way it is supposed to eventually be run "for real", you can
now do:

    ./coolwsd --o:sys_template_path=${SYSTEMPLATE} --o:child_root_path=${ROOTFORJAILS}

The ${SYSTEMPLATE} is a directory tree set up using the
coolwsd-systemplate-setup script here. (It should not exist before
running the script.) It will contain the runtime environment needed by
the LibreOffice dynamic libraries used through LibreOfficeKit.
Improvements to that script are very likely needed on various distros.

The ${ROOTFORJAILS} directory above is a presumably initially empty
directory under which coolwsd will create chroot jails for editing
each specific document.

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

    # create tha ca-chain.cert.pem

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

When debugging, you want to add `--o:num_prespawn_children=1` to the coolwsd parameters to
limit the amount of concurrently running processes.

When the crash happens too early, you also want to

    export SLEEPFORDEBUGGER=<number of seconds>

or
    export PAUSEFORDEBUGGER=1

so that you have time to attach to the process.

Then run coolwsd, and attach your debugger to the process you are
interested in. Note that as the coolforkit executable file has
capabilities set, so when debugging that you need to run the debugger
with super-user privilege.

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

There are three processes: CoolWSD, CoolForKit, and CoolKit.

WSD is the top-level server and is intended to run as a service.
It is responsible for spawning ForKit and listening on public
port for client connections.

The ForKit is only responsible for forking Kit instances. There is
only one ForKit per WSD instance and there is one Kit instance per
document.

WSD listens on a public port and using internal pipes requests
the ForKit to fire a child (Kit) instance to host documents.
The ForKit then has to find an existing Kit that hosts that
document, based on the public URI as unique key, and forward
the request to this existing Kit, which then loads a new
view to the document.

There is a singleton Admin class that gets notified of all the
important changes and update the AdminModel object accordingly.
AdminModel object has subscribers which corresponds to admin
panel sessions. Subscriber can subscribe to specific commands
to get live notifications about, and to update the UI accordingly.

Whether a document is loaded for the first time, or this is
a new view on an existing one, the Kit connects via a socket
to WSD on an internal port. WSD acts as a bridge between
the client and Kit by tunnelling the traffic between the two
sockets (that which is between the client and WSD and the one
between WSD and Kit).

## File System

WSD is given childroot argument on the command line. This is
the root directory of jailed FS. This path can be anywhere, but
here we'll designate it as:

`/childroot`

Before spawning a ForKit instance, WSD needs to generate a random
Jail-ID to use as the jail directory name. This JailID is then
passed to ForKit as argument jailid.

Note: for security reasons, this directory name is randomly generated
and should not be given out to the client. Since there is only one
ForKit per WSD instance, there is also one JailID between them.

The ForKit creates a chroot in this directory (the jail directory):

`/childroot/jailid/`

ForKit copies the LO instdir (essentially installs LO in the chroot),
then copies the Kit binary into the jail directory upon startup.
Once done, it chroot-s and drops caps.

ForKit then waits on a read pipe to which WSD writes when a new
request from a client is received. ForKit is responsible for spawning
(or forking) Kit instances. For our purposes, it doesn't matter
whether Kit is spawned or forked.

Every document is hosted by a Kit instance. Each document is stored
in a dedicated directory within the jail directory. The document
root within the jail is /user/docs. The absolute path on the system
(which isn't accessible to the Kit process as it's jailed) is:

`/childroot/jailid/user/docs`

Within this path, each document gets its own sub-directory based on
another random Child-ID (which could be the Process ID of the Kit).
This ChildId will be given out to clients to facilitate the insertion
and downloading of documents. (Although strictly speaking the client
can use the main document URI as key, this is the current design.)

`/childroot/jailid/user/docs/childid`

A request from a client to load a document will trigger the following
chain of events.

- WSD public socket will receive the connection request followed
  by a "load" command.
- WSD creates MasterProcessSession (ToClient) to handle the client traffic.
- MasterProcessSession requests ForKit to find or spawn Kit for
  the given URI.
- ForKit sends Kit request to host URI via pipe.
- Kit connects to WSD on an internal port.
- WSD creates another MasterProcessSession (ToPrisoner) to service Kit.
- MasterProcessSession (ToClient) is linked to the ToPrisoner instance,
  copies the document into jail (first load only) and sends
  (via ToPrisoner) the load request to Kit.
- Kit loads the document and sets up callbacks with LOKit.
- MasterProcessSession (ToClient) and MasterProcessSession (ToPrisoner)
  tunnel the traffic between client and Kit both ways.

## Coding style

There is not really any serious rationale why the code ended up being
written in the style it is... but unless you plan to change some style
detail completely and consistently all over, please keep to the style
of the existing code when editing.

The style is roughly as follows, in rough order of importance:

- As in LO, no hard TABs in source files. Only spaces. Indentation
  step is four columns.

- As in LO, the braces { and } of the block of if, switch, and while
  statements go on separate lines.

- Following Poco conventions, non-static member variables are prefixed
  with an underscore. Static members have a CamelCase name.

- Do use C++11. I admit in some places (out of laziness or ignorance)
  I use Poco API even if there probably is an equivalent std::
  API. (Like for threads.) Feel free to change those, if the std:: API
  is not much more verbose or ugly, and you are sure it is equivalent.

- Always prefer the C++ wrapped version of a C library
  API. I.e. include <cstring> instead of <string.h>, use std::memcpy()
  instead of memcpy(), etc.

- Use std:: prefix for all std API, i.e. don't ever do "using
  std;". But it's OK to use "using Poco::Foo;" all over. Maybe that is
  not a good idea? But please no "using" in headers.

- Member functions use camelCaseWithInitialLowerCase. I don't like
  CamelCaseWithInitialUpperCase.

- [ No kind of Hungarian prefixes. ]

- return - is not a function; but a statement - it doesn't need extra ()

- Use 'auto' in the following cases only:

  - iterators

  - range-based for loops

  - the type is spelled out in the same line already (e.g. initializing from a
    cast or a function that has a single type parameter)

  In other cases it makes the code more readable to still spell out the type
  explicitly.

Security credential related changes
-----------------------------------

- Instead of the usual one, two reviews are needed.

- Instead of just choosing the 'approve' option on GitHub, please add your
  explicit sign-off to the commit message when you review.
