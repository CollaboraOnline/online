This is a Qt WebEngine app quite similar to the gtk app under gtk/
that is intended to work similarly enough to the iOS app being
developed in the "ios" directory, and the Android app being developed
in the "android" directory, that (some kinds of) problems in them also
show up in this app, and can be investigated by people with no
Android, Mac, or iOS device.

How to build this:

Use a separate tree of "online". Do NOT use one where you build a
normal Online.

Requires Qt's tool Meta-Object Compiler (moc) to be in in the PATH.

Run autogen.sh, then configure:

./configure --enable-qtapp --with-lo-path=/path/to/core/instdir --with-lokit-path=/path/to/core/include

Obviously, adjust the path to your LibreOffice build tree as necessary.

Then in the top directory run make.

You will get the CODA executable. Run it for example like this:

./coda-qt ../test/data/hello.odt

Then, if it doesn't work, debug it and fix it.
