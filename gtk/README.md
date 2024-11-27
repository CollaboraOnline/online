This is a GTK+ Webkit app that is intended to work similarly enough to
the iOS app being developed in the "ios" folder, and the Android app
being developed in the "android" folder, that (some kinds of) problems
in them also show up in this app, and can be investigated by people
with no Android, Mac, or iOS device.

How to build this:

Use a separate tree of "online". Do NOT use one where you build a
normal Online.

Run autogen.sh, then configure:

./configure --enable-gtkapp --with-lo-path=/home/tml/lo/master/instdir --with-lokit-path=/home/tml/lo/master/include

Obviously, adjust the path to your LibreOffice build tree as necessary.

Then cd to this directory and run make.

You will get the mobile executable. Run it for example like this:

./mobile ../test/data/hello.odt

Then, if it doesn't work, debug it and fix it.
