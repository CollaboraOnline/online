# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /Users/gfan/dev/sdk_current/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
-keepclassmembers class COOLMessageHandler {
   public *;
}

# For native methods, see http://proguard.sourceforge.net/manual/examples.html#native
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep also method that we are calling back from the JNI
-keepclassmembers class MainActivity {
   void callFakeWebsocketOnMessage(java.lang.String);
}
