/* config.h.  Manually edited from config.h.in.  */
/* config.h.in.  Generated from configure.ac by autoheader.  */

/* Whether to disable SECCOMP */
#define DISABLE_SECCOMP 1

/* Whether to compile in some extra debugging support code and disable some
   security pieces */
#undef ENABLE_DEBUG

/* Whether to enable setting of capabilities */
#undef ENABLE_SETCAP

/* Whether to enable SSL */
#undef ENABLE_SSL

/* Whether to enable support key */
#undef ENABLE_SUPPORT_KEY

/* Define to 1 if you have the <dlfcn.h> header file. */
#undef HAVE_DLFCN_H

/* Define to 1 if you have the <inttypes.h> header file. */
#undef HAVE_INTTYPES_H

/* Define to 1 if you have the `pam' library (-lpam). */
#undef HAVE_LIBPAM

/* Define to 1 if you have the <LibreOfficeKit/LibreOfficeKit.h> header file.
   */
#undef HAVE_LIBREOFFICEKIT_LIBREOFFICEKIT_H

/* Define to 1 if you have the <linux/seccomp.h> header file. */
#undef HAVE_LINUX_SECCOMP_H

/* Define to 1 if you have the <memory.h> header file. */
#undef HAVE_MEMORY_H

/* Whether OpenSSL has PKCS5_PBKDF2_HMAC() */
#undef HAVE_PKCS5_PBKDF2_HMAC

/* Define to 1 if you have the <Poco/Net/WebSocket.h> header file. */
#undef HAVE_POCO_NET_WEBSOCKET_H

/* Define to 1 if you have the <security/pam_appl.h> header file. */
#undef HAVE_SECURITY_PAM_APPL_H

/* Define to 1 if you have the <stdint.h> header file. */
#define HAVE_STDINT_H 1

/* Define to 1 if you have the <stdlib.h> header file. */
#define HAVE_STDLIB_H 1

/* Define to 1 if you have the <strings.h> header file. */
#undef HAVE_STRINGS_H

/* Define to 1 if you have the <string.h> header file. */
#define HAVE_STRING_H 1

/* Define to 1 if you have the <sys/stat.h> header file. */
#define HAVE_SYS_STAT_H 1

/* Define to 1 if you have the <sys/types.h> header file. */
#define HAVE_SYS_TYPES_H 1

/* Define to 1 if you have the <unistd.h> header file. */
#define HAVE_UNISTD_H 1

/* Cache folder */
#define LOOLWSD_CACHEDIR lo_ios_app_getCacheDir()

/* LibreOffice Online WebSocket server version */
#define LOOLWSD_VERSION "master" // ???

/* LibreOffice Online git hash if present */
#define LOOLWSD_VERSION_HASH "xxxxxx" // ???

/* Path to LibreOffice installation */
#define LO_PATH "."

/* Define to the sub-directory where libtool stores uninstalled libraries. */
#undef LT_OBJDIR

/* Limit the maximum number of open connections */
#define MAX_CONNECTIONS 3

/* Limit the maximum number of open documents */
#define MAX_DOCUMENTS 1

/* Name of package */
#undef PACKAGE

/* Define to the address where bug reports for this package should be sent. */
#undef PACKAGE_BUGREPORT

/* Define to the full name of this package. */
#undef PACKAGE_NAME

/* Define to the full name and version of this package. */
#undef PACKAGE_STRING

/* Define to the one symbol short name of this package. */
#undef PACKAGE_TARNAME

/* Define to the home page for this package. */
#undef PACKAGE_URL

/* Define to the version of this package. */
#undef PACKAGE_VERSION

/* Define to 1 if you have the ANSI C header files. */
#define STDC_HEADERS 1

/* Version number of package */
/* #undef VERSION */
