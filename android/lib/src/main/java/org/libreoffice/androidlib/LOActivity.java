/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4; fill-column: 100 -*- */
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidlib;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.preference.PreferenceManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.RatingBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.BufferedWriter;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.ByteBuffer;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.ReadableByteChannel;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import org.libreoffice.androidlib.lok.LokClipboardData;
import org.libreoffice.androidlib.lok.LokClipboardEntry;

public class LOActivity extends AppCompatActivity {
    final static String TAG = "LOActivity";

    private static final String ASSETS_EXTRACTED_GIT_COMMIT = "ASSETS_EXTRACTED_GIT_COMMIT";
    private static final int PERMISSION_WRITE_EXTERNAL_STORAGE = 777;
    private static final String KEY_ENABLE_SHOW_DEBUG_INFO = "ENABLE_SHOW_DEBUG_INFO";

    private static final String KEY_PROVIDER_ID = "providerID";
    private static final String KEY_DOCUMENT_URI = "documentUri";
    private static final String KEY_IS_EDITABLE = "isEditable";
    private static final String KEY_INTENT_URI = "intentUri";
    private static final String CLIPBOARD_FILE_PATH = "LibreofficeClipboardFile.data";
    private static final String CLIPBOARD_LOOL_SIGNATURE = "lool-clip-magic-4a22437e49a8-";
    public static final String RECENT_DOCUMENTS_KEY = "RECENT_DOCUMENTS_LIST";

    private File mTempFile = null;

    private int providerId;

    /// Unique number identifying this app + document.
    private long loadDocumentMillis = 0;

    @Nullable
    private URI documentUri;

    private String urlToLoad;
    private WebView mWebView = null;
    private SharedPreferences sPrefs;
    private Handler mMainHandler = null;
    private RateAppController rateAppController;

    private boolean isDocEditable = false;
    private boolean isDocDebuggable = BuildConfig.DEBUG;
    private boolean documentLoaded = false;

    private ClipboardManager clipboardManager;
    private ClipData clipData;
    private Thread nativeMsgThread;
    private Handler nativeHandler;
    private Looper nativeLooper;
    private Bundle savedInstanceState;

    private ProgressDialog mProgressDialog = null;

    /** In case the mobile-wizard is visible, we have to intercept the Android's Back button. */
    private boolean mMobileWizardVisible = false;
    private boolean mIsEditModeActive = false;

    private ValueCallback<Uri[]> valueCallback;

    public static final int REQUEST_SELECT_IMAGE_FILE = 500;
    public static final int REQUEST_SAVEAS_PDF = 501;
    public static final int REQUEST_SAVEAS_RTF = 502;
    public static final int REQUEST_SAVEAS_ODT = 503;
    public static final int REQUEST_SAVEAS_ODP = 504;
    public static final int REQUEST_SAVEAS_ODS = 505;
    public static final int REQUEST_SAVEAS_DOCX = 506;
    public static final int REQUEST_SAVEAS_PPTX = 507;
    public static final int REQUEST_SAVEAS_XLSX = 508;
    public static final int REQUEST_SAVEAS_DOC = 509;
    public static final int REQUEST_SAVEAS_PPT = 510;
    public static final int REQUEST_SAVEAS_XLS = 511;
    public static final int REQUEST_SAVEAS_EPUB = 512;
    public static final int REQUEST_COPY = 600;

    /** Broadcasting event for passing info back to the shell. */
    public static final String LO_ACTIVITY_BROADCAST = "LOActivityBroadcast";

    /** Event description for passing info back to the shell. */
    public static final String LO_ACTION_EVENT = "LOEvent";

    /** Data description for passing info back to the shell. */
    public static final String LO_ACTION_DATA = "LOData";

    /** shared pref key for recent files. */
    public static final String EXPLORER_PREFS_KEY = "EXPLORER_PREFS";

    private static boolean copyFromAssets(AssetManager assetManager,
                                          String fromAssetPath, String targetDir) {
        try {
            String[] files = assetManager.list(fromAssetPath);
            boolean res = true;
            for (String file : files) {
                String[] dirOrFile = assetManager.list(fromAssetPath + "/" + file);
                if (dirOrFile.length == 0) {
                    // noinspection ResultOfMethodCallIgnored
                    new File(targetDir).mkdirs();
                    res &= copyAsset(assetManager,
                            fromAssetPath + "/" + file,
                            targetDir + "/" + file);
                } else
                    res &= copyFromAssets(assetManager,
                            fromAssetPath + "/" + file,
                            targetDir + "/" + file);
            }
            return res;
        } catch (Exception e) {
            e.printStackTrace();
            Log.e(TAG, "copyFromAssets failed: " + e.getMessage());
            return false;
        }
    }

    private static boolean copyAsset(AssetManager assetManager, String fromAssetPath, String toPath) {
        ReadableByteChannel source = null;
        FileChannel dest = null;
        try {
            try {
                source = Channels.newChannel(assetManager.open(fromAssetPath));
                dest = new FileOutputStream(toPath).getChannel();
                long bytesTransferred = 0;
                // might not copy all at once, so make sure everything gets copied....
                ByteBuffer buffer = ByteBuffer.allocate(4096);
                while (source.read(buffer) > 0) {
                    buffer.flip();
                    bytesTransferred += dest.write(buffer);
                    buffer.clear();
                }
                Log.v(TAG, "Success copying " + fromAssetPath + " to " + toPath + " bytes: " + bytesTransferred);
                return true;
            } finally {
                if (dest != null) dest.close();
                if (source != null) source.close();
            }
        } catch (FileNotFoundException e) {
            Log.e(TAG, "file " + fromAssetPath + " not found! " + e.getMessage());
            return false;
        } catch (IOException e) {
            Log.e(TAG, "failed to copy file " + fromAssetPath + " from assets to " + toPath + " - " + e.getMessage());
            return false;
        }
    }

    private Handler getMainHandler() {
        if (mMainHandler == null) {
            mMainHandler = new Handler(getMainLooper());
        }
        return mMainHandler;
    }

    /** True if the App is running under ChromeOS. */
    public static boolean isChromeOS(Context context) {
        return context.getPackageManager().hasSystemFeature("org.chromium.arc.device_management");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.savedInstanceState = savedInstanceState;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        sPrefs = PreferenceManager.getDefaultSharedPreferences(getApplicationContext());

        setContentView(R.layout.lolib_activity_main);
        mProgressDialog = new ProgressDialog(this);
        if (BuildConfig.GOOGLE_PLAY_ENABLED)
            this.rateAppController = new RateAppController(this);
        else
            this.rateAppController = null;

        init();
    }

    /** Initialize the app - copy the assets and create the UI. */
    private void init() {
        if (sPrefs.getString(ASSETS_EXTRACTED_GIT_COMMIT, "").equals(BuildConfig.GIT_COMMIT)) {
            // all is fine, we have already copied the assets
            initUI();
            return;
        }

        mProgressDialog.indeterminate(R.string.preparing_for_the_first_start_after_an_update);

        new AsyncTask<Void, Void, Void>() {
            @Override
            protected Void doInBackground(Void... voids) {
                // copy the new assets
                if (copyFromAssets(getAssets(), "unpack", getApplicationInfo().dataDir)) {
                    sPrefs.edit().putString(ASSETS_EXTRACTED_GIT_COMMIT, BuildConfig.GIT_COMMIT).apply();
                }
                return null;
            }

            @Override
            protected void onPostExecute(Void aVoid) {
                initUI();
            }
        }.execute();
    }

    /** Actual initialization of the UI. */
    private void initUI() {
        isDocDebuggable = sPrefs.getBoolean(KEY_ENABLE_SHOW_DEBUG_INFO, false) && BuildConfig.DEBUG;

        if (getIntent().getData() != null) {

            if (getIntent().getData().getScheme().equals(ContentResolver.SCHEME_CONTENT)) {
                isDocEditable = true;

                // is it read-only?
                if ((getIntent().getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0) {
                    isDocEditable = false;
                    Log.d(TAG, "Disabled editing: Read-only");
                    Toast.makeText(this, getResources().getString(R.string.temp_file_saving_disabled), Toast.LENGTH_SHORT).show();
                }

                // turns out that on ChromeOS, it is not possible to save back
                // to Google Drive; detect it already here to avoid disappointment
                // also the volumeprovider does not work for saving back,
                // which is much more serious :-(
                if (isDocEditable && (getIntent().getData().toString().startsWith("content://org.chromium.arc.chromecontentprovider/externalfile") ||
                                      getIntent().getData().toString().startsWith("content://org.chromium.arc.volumeprovider/"))) {
                    isDocEditable = false;
                    Log.d(TAG, "Disabled editing: Chrome OS unsupported content providers");
                    Toast.makeText(this, getResources().getString(R.string.file_chromeos_read_only), Toast.LENGTH_LONG).show();
                }

                if (copyFileToTemp() && mTempFile != null) {
                    documentUri = mTempFile.toURI();
                    urlToLoad = documentUri.toString();
                    Log.d(TAG, "SCHEME_CONTENT: getPath(): " + getIntent().getData().getPath());
                } else {
                    // TODO: can't open the file
                    Log.e(TAG, "couldn't create temporary file from " + getIntent().getData());
                }
            } else if (getIntent().getData().getScheme().equals(ContentResolver.SCHEME_FILE)) {
                isDocEditable = true;
                urlToLoad = getIntent().getData().toString();
                Log.d(TAG, "SCHEME_FILE: getPath(): " + getIntent().getData().getPath());
                // Gather data to rebuild IFile object later
                providerId = getIntent().getIntExtra(
                        "org.libreoffice.document_provider_id", 0);
                documentUri = (URI) getIntent().getSerializableExtra(
                        "org.libreoffice.document_uri");
            }
        } else if (savedInstanceState != null) {
            getIntent().setAction(Intent.ACTION_VIEW)
                    .setData(Uri.parse(savedInstanceState.getString(KEY_INTENT_URI)));
            urlToLoad = getIntent().getData().toString();
            providerId = savedInstanceState.getInt(KEY_PROVIDER_ID);
            if (savedInstanceState.getString(KEY_DOCUMENT_URI) != null) {
                try {
                    documentUri = new URI(savedInstanceState.getString(KEY_DOCUMENT_URI));
                    urlToLoad = documentUri.toString();
                } catch (URISyntaxException e) {
                    e.printStackTrace();
                }
            }
            isDocEditable = savedInstanceState.getBoolean(KEY_IS_EDITABLE);
        } else {
            //User can't reach here but if he/she does then
            Toast.makeText(this, getString(R.string.failed_to_load_file), Toast.LENGTH_SHORT).show();
            finish();
        }

        mWebView = findViewById(R.id.browser);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        mWebView.addJavascriptInterface(this, "LOOLMessageHandler");

        // allow debugging (when building the debug version); see details in
        // https://developers.google.com/web/tools/chrome-devtools/remote-debugging/webviews
        boolean isChromeDebugEnabled = sPrefs.getBoolean("ENABLE_CHROME_DEBUGGING", false);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 || isChromeDebugEnabled) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        getMainHandler();

        clipboardManager = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        nativeMsgThread = new Thread(new Runnable() {
            @Override
            public void run() {
                Looper.prepare();
                nativeLooper = Looper.myLooper();
                nativeHandler = new Handler(nativeLooper);
                Looper.loop();
            }
        });
        nativeMsgThread.start();

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView mWebView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (valueCallback != null) {
                    valueCallback.onReceiveValue(null);
                    valueCallback = null;
                }

                valueCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();

                try {
                    intent.setType("image/*");
                    startActivityForResult(intent, REQUEST_SELECT_IMAGE_FILE);
                } catch (ActivityNotFoundException e) {
                    valueCallback = null;
                    Toast.makeText(LOActivity.this, getString(R.string.cannot_open_file_chooser), Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            Log.i(TAG, "asking for read storage permission");
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    PERMISSION_WRITE_EXTERNAL_STORAGE);
        } else {
            loadDocument();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {

        Log.i(TAG, "onNewIntent");

        if (documentLoaded) {
            postMobileMessageNative("save dontTerminateEdit=true dontSaveIfUnmodified=true");
        }

        final Intent finalIntent = intent;
        mProgressDialog.indeterminate(R.string.exiting);
        getMainHandler().post(new Runnable() {
            @Override
            public void run() {
                documentLoaded = false;
                postMobileMessageNative("BYE");
                copyTempBackToIntent();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        mProgressDialog.dismiss();
                        setIntent(finalIntent);
                        init();
                    }
                });
            }
        });
        super.onNewIntent(intent);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(KEY_INTENT_URI, getIntent().getData().toString());
        outState.putInt(KEY_PROVIDER_ID, providerId);
        if (documentUri != null) {
            outState.putString(KEY_DOCUMENT_URI, documentUri.toString());
        }
        //If this activity was opened via contentUri
        outState.putBoolean(KEY_IS_EDITABLE, isDocEditable);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        switch (requestCode) {
            case PERMISSION_WRITE_EXTERNAL_STORAGE:
                if (permissions.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    loadDocument();
                } else {
                    Toast.makeText(this, getString(R.string.storage_permission_required), Toast.LENGTH_SHORT).show();
                    finishAndRemoveTask();
                    break;
                }
                break;
            default:
                super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        }
    }

    /** When we get the file via a content: URI, we need to put it to a temp file. */
    private boolean copyFileToTemp() {
        ContentResolver contentResolver = getContentResolver();
        InputStream inputStream = null;
        OutputStream outputStream = null;

        // CSV files need a .csv suffix to be opened in Calc.
        String suffix = null;
        String intentType = getIntent().getType();
        // K-9 mail uses the first, GMail uses the second variant.
        if ("text/comma-separated-values".equals(intentType) || "text/csv".equals(intentType))
            suffix = ".csv";

        try {
            try {
                Uri uri = getIntent().getData();
                inputStream = contentResolver.openInputStream(uri);

                mTempFile = File.createTempFile("LibreOffice", suffix, this.getCacheDir());
                outputStream = new FileOutputStream(mTempFile);

                byte[] buffer = new byte[1024];
                int length;
                long bytes = 0;
                while ((length = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, length);
                    bytes += length;
                }

                Log.i(TAG, "Success copying " + bytes + " bytes from " + uri + " to " + mTempFile);
            } finally {
                if (inputStream != null)
                    inputStream.close();
                if (outputStream != null)
                    outputStream.close();
            }
        } catch (FileNotFoundException e) {
            Log.e(TAG, "file not found: " + e.getMessage());
            return false;
        } catch (IOException e) {
            Log.e(TAG, "exception: " + e.getMessage());
            return false;
        }

        return true;
    }

    /** Check that we have created a temp file, and if yes, copy it back to the content: URI. */
    private void copyTempBackToIntent() {
        if (!isDocEditable || mTempFile == null || getIntent().getData() == null || !getIntent().getData().getScheme().equals(ContentResolver.SCHEME_CONTENT))
            return;

        ContentResolver contentResolver = getContentResolver();
        InputStream inputStream = null;
        OutputStream outputStream = null;

        try {
            try {
                inputStream = new FileInputStream(mTempFile);

                Uri uri = getIntent().getData();
                try {
                    outputStream = contentResolver.openOutputStream(uri, "wt");
                }
                catch (FileNotFoundException e) {
                    Log.i(TAG, "failed with the 'wt' mode, trying without: " + e.getMessage());
                    outputStream = contentResolver.openOutputStream(uri);
                }

                byte[] buffer = new byte[1024];
                int length;
                long bytes = 0;
                while ((length = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, length);
                    bytes += length;
                }

                Log.i(TAG, "Success copying " + bytes + " bytes from " + mTempFile + " to " + uri);
            } finally {
                if (inputStream != null)
                    inputStream.close();
                if (outputStream != null)
                    outputStream.close();
            }
        } catch (FileNotFoundException e) {
            Log.e(TAG, "file not found: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "exception: " + e.getMessage());
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.i(TAG, "onResume..");
    }

    @Override
    protected void onPause() {
        // A Save similar to an autosave
        if (documentLoaded)
            postMobileMessageNative("save dontTerminateEdit=true dontSaveIfUnmodified=true");

        super.onPause();
        Log.d(TAG, "onPause() - hinting to save, we might need to return to the doc");
    }

    @Override
    protected void onDestroy() {
        nativeLooper.quit();

        // Remove the webview from the hierarchy & destroy
        final ViewGroup viewGroup = (ViewGroup) mWebView.getParent();
        if (viewGroup != null)
            viewGroup.removeView(mWebView);
        mWebView.destroy();
        mWebView = null;

        // Most probably the native part has already got a 'BYE' from
        // finishWithProgress(), but it is actually better to send it twice
        // than never, so let's call it from here too anyway
        documentLoaded = false;
        postMobileMessageNative("BYE");

        mProgressDialog.dismiss();

        super.onDestroy();
        Log.i(TAG, "onDestroy() - we know we are leaving the document");
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        if (resultCode != RESULT_OK) {
            if (requestCode == REQUEST_SELECT_IMAGE_FILE) {
                valueCallback.onReceiveValue(null);
                valueCallback = null;
            }
            return;
        }

        switch (requestCode) {
            case REQUEST_SELECT_IMAGE_FILE:
                if (valueCallback == null)
                    return;
                valueCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, intent));
                valueCallback = null;
                return;
            case REQUEST_SAVEAS_PDF:
            case REQUEST_SAVEAS_RTF:
            case REQUEST_SAVEAS_ODT:
            case REQUEST_SAVEAS_ODP:
            case REQUEST_SAVEAS_ODS:
            case REQUEST_SAVEAS_DOCX:
            case REQUEST_SAVEAS_PPTX:
            case REQUEST_SAVEAS_XLSX:
            case REQUEST_SAVEAS_DOC:
            case REQUEST_SAVEAS_PPT:
            case REQUEST_SAVEAS_XLS:
            case REQUEST_SAVEAS_EPUB:
                if (intent == null) {
                    return;
                }
                String format = getFormatForRequestCode(requestCode);
                if (format != null) {
                    InputStream inputStream = null;
                    OutputStream outputStream = null;
                    try {
                        final File tempFile = File.createTempFile("LibreOffice", "." + format, this.getCacheDir());
                        LOActivity.this.saveAs(tempFile.toURI().toString(), format);

                        inputStream = new FileInputStream(tempFile);
                        try {
                            outputStream = getContentResolver().openOutputStream(intent.getData(), "wt");
                        }
                        catch (FileNotFoundException e) {
                            Log.i(TAG, "failed with the 'wt' mode, trying without: " + e.getMessage());
                            outputStream = getContentResolver().openOutputStream(intent.getData());
                        }

                        byte[] buffer = new byte[4096];
                        int len;
                        while ((len = inputStream.read(buffer)) != -1) {
                            outputStream.write(buffer, 0, len);
                        }
                        outputStream.flush();
                    } catch (Exception e) {
                        Toast.makeText(this, "Something went wrong while Saving as: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        e.printStackTrace();
                    } finally {
                        try {
                            if (inputStream != null)
                                inputStream.close();
                            if (outputStream != null)
                                outputStream.close();
                        } catch (Exception e) {
                        }
                    }
                    return;
                }
                break;
            case REQUEST_COPY:
                if (intent == null) {
                    return;
                }
                Uri treeFileUri = intent.getData();
                Uri uri = getIntent().getData();
                InputStream inputStream = null;
                OutputStream outputStream = null;
                try {
                    ContentResolver contentResolver = getContentResolver();
                    contentResolver.takePersistableUriPermission(treeFileUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                    inputStream = contentResolver.openInputStream(uri);
                    outputStream = contentResolver.openOutputStream(treeFileUri);
                    byte[] buffer = new byte[1024];
                    int length;
                    while ((length = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, length);
                    }

                    /** add the document to recents */
                    SharedPreferences recentPrefs = getSharedPreferences(EXPLORER_PREFS_KEY, MODE_PRIVATE);
                    String recentList =  recentPrefs.getString(RECENT_DOCUMENTS_KEY, "");
                    recentList = treeFileUri.toString() + "\n" + recentList;
                    recentPrefs.edit().putString(RECENT_DOCUMENTS_KEY, recentList).apply();

                    /** recreate activity with the copied file */
                    getIntent().setData(treeFileUri);
                    getIntent().addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    getIntent().addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    // because finishing the app takes some time, should show progressbar
                    finishWithProgress(true);
                } catch (FileNotFoundException e) {
                    Log.e(TAG, "file not found: " + e.getMessage());
                    return;
                } catch (Exception e) {
                    Log.e(TAG, "exception: " + e.getMessage());
                    return;
                } finally {
                    try {
                        if (inputStream != null)
                            inputStream.close();
                        if (outputStream != null)
                            outputStream.close();
                    } catch (Exception e) {}
                }
                return;
        }
        Toast.makeText(this, "Unknown request", Toast.LENGTH_LONG).show();
    }

    private String getFormatForRequestCode(int requestCode) {
        switch(requestCode) {
            case REQUEST_SAVEAS_PDF: return "pdf";
            case REQUEST_SAVEAS_RTF: return "rtf";
            case REQUEST_SAVEAS_ODT: return "odt";
            case REQUEST_SAVEAS_ODP: return "odp";
            case REQUEST_SAVEAS_ODS: return "ods";
            case REQUEST_SAVEAS_DOCX: return "docx";
            case REQUEST_SAVEAS_PPTX: return "pptx";
            case REQUEST_SAVEAS_XLSX: return "xlsx";
            case REQUEST_SAVEAS_DOC: return "doc";
            case REQUEST_SAVEAS_PPT: return "ppt";
            case REQUEST_SAVEAS_XLS: return "xls";
            case REQUEST_SAVEAS_EPUB: return "epub";
        }
        return null;
    }

    /** Show the Saving progress and finish the app. */
    private void finishWithProgress(final boolean restartApp) {
        mProgressDialog.indeterminate(restartApp ? R.string.restarting : R.string.exiting);

        // The 'BYE' takes a considerable amount of time, we need to post it
        // so that it starts after the saving progress is actually shown
        getMainHandler().post(new Runnable() {
            @Override
            public void run() {
                documentLoaded = false;
                postMobileMessageNative("BYE");
                copyTempBackToIntent();

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        mProgressDialog.dismiss();
                        if (restartApp == true)
                            recreate();
                    }
                });
                if (restartApp == false)
                    finishAndRemoveTask();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (mMobileWizardVisible)
        {
            // just return one level up in the mobile-wizard (or close it)
            callFakeWebsocketOnMessage("'mobile: mobilewizardback'");
            return;
        } else if (mIsEditModeActive) {
            callFakeWebsocketOnMessage("'mobile: readonlymode'");
            return;
        }

        finishWithProgress(false);
    }

    private void loadDocument() {
        mProgressDialog.determinate(R.string.loading);

        // setup the LOOLWSD
        ApplicationInfo applicationInfo = getApplicationInfo();
        String dataDir = applicationInfo.dataDir;
        Log.i(TAG, String.format("Initializing LibreOfficeKit, dataDir=%s\n", dataDir));

        String cacheDir = getApplication().getCacheDir().getAbsolutePath();
        String apkFile = getApplication().getPackageResourcePath();
        AssetManager assetManager = getResources().getAssets();

        createLOOLWSD(dataDir, cacheDir, apkFile, assetManager, urlToLoad);

        // trigger the load of the document
        String finalUrlToLoad = "file:///android_asset/dist/loleaflet.html?file_path=" +
                urlToLoad + "&closebutton=1";

        // set the language
        String language = getResources().getConfiguration().locale.toLanguageTag();

        Log.i(TAG, "Loading with language:  " + language);

        finalUrlToLoad += "&lang=" + language;

        if (isDocEditable) {
            finalUrlToLoad += "&permission=edit";
        } else {
            finalUrlToLoad += "&permission=readonly";
        }

        if (isDocDebuggable) {
            finalUrlToLoad += "&debug=true";
        }

        // load the page
        mWebView.loadUrl(finalUrlToLoad);

        documentLoaded = true;

        loadDocumentMillis = android.os.SystemClock.uptimeMillis();
    }

    static {
        System.loadLibrary("androidapp");
    }

    public SharedPreferences getPrefs() {
        return sPrefs;
    }

    /**
     * Initialize the LOOLWSD to load 'loadFileURL'.
     */
    public native void createLOOLWSD(String dataDir, String cacheDir, String apkFile, AssetManager assetManager, String loadFileURL);

    /**
     * Passing messages from JS (instead of the websocket communication).
     */
    @JavascriptInterface
    public void postMobileMessage(String message) {
        Log.d(TAG, "postMobileMessage: " + message);

        String[] messageAndParameterArray= message.split(" ", 2); // the command and the rest (that can potentially contain spaces too)

        if (beforeMessageFromWebView(messageAndParameterArray)) {
            postMobileMessageNative(message);
            afterMessageFromWebView(messageAndParameterArray);
        }
    }

    /**
     * Call the post method form C++
     */
    public native void postMobileMessageNative(String message);

    /**
     * Passing messages from JS (instead of the websocket communication).
     */
    @JavascriptInterface
    public void postMobileError(String message) {
        // TODO handle this
        Log.d(TAG, "postMobileError: " + message);
    }

    /**
     * Passing messages from JS (instead of the websocket communication).
     */
    @JavascriptInterface
    public void postMobileDebug(String message) {
        // TODO handle this
        Log.d(TAG, "postMobileDebug: " + message);
    }

    /**
     * Provide the info that this app is actually running under ChromeOS - so
     * has to mostly look like on desktop.
     */
    @JavascriptInterface
    public boolean isChromeOS() {
        return isChromeOS(this);
    }

    /**
     * Passing message the other way around - from Java to the FakeWebSocket in JS.
     */
    void callFakeWebsocketOnMessage(final String message) {
        // call from the UI thread
        if (mWebView != null)
            mWebView.post(new Runnable() {
                public void run() {
                    if (mWebView == null) {
                        Log.i(TAG, "Skipped forwarding to the WebView: " + message);
                        return;
                    }

                    Log.i(TAG, "Forwarding to the WebView: " + message);

                    /* Debug only: in case the message is too long, truncated in the logcat, and you need to see it.
                    final int size = 80;
                    for (int start = 0; start < message.length(); start += size) {
                        Log.i(TAG, "split: " + message.substring(start, Math.min(message.length(), start + size)));
                    }
                    */

                    mWebView.loadUrl("javascript:window.TheFakeWebSocket.onmessage({'data':" + message + "});");
                }
            });

        // update progress bar when loading
        if (message.startsWith("'statusindicator") || message.startsWith("'error:")) {
            runOnUiThread(new Runnable() {
                public void run() {
                    // update progress bar if it exists
                    final String statusIndicatorSetValue = "'statusindicatorsetvalue: ";
                    if (message.startsWith(statusIndicatorSetValue)) {
                        int start = statusIndicatorSetValue.length();
                        int end = message.indexOf("'", start);

                        int progress = 0;
                        try {
                            progress = Integer.parseInt(message.substring(start, end));
                        } catch (Exception e) {
                        }

                        mProgressDialog.determinateProgress(progress);
                    }
                    else if (message.startsWith("'statusindicatorfinish:") || message.startsWith("'error:")) {
                        mProgressDialog.dismiss();
                        if (BuildConfig.GOOGLE_PLAY_ENABLED && rateAppController != null)
                            rateAppController.askUserForRating();
                    }
                }
            });
        }
    }

    /**
     * return true to pass the message to the native part or false to block the message
     */
    private boolean beforeMessageFromWebView(String[] messageAndParam) {
        switch (messageAndParam[0]) {
            case "BYE":
                finishWithProgress(false);
                return false;
            case "PRINT":
                getMainHandler().post(new Runnable() {
                    @Override
                    public void run() {
                        LOActivity.this.initiatePrint();
                    }
                });
                return false;
            case "SLIDESHOW":
                initiateSlideShow();
                return false;
            case "SAVE":
                copyTempBackToIntent();
                sendBroadcast(messageAndParam[0], messageAndParam[1]);
                return false;
            case "downloadas":
                initiateSaveAs(messageAndParam[1]);
                return false;
            case "uno":
                switch (messageAndParam[1]) {
                    case ".uno:Paste":
                        return performPaste();
                    default:
                        break;
                }
                break;
            case "DIM_SCREEN": {
                getMainHandler().post(new Runnable() {
                    @Override
                    public void run() {
                        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                });
                return false;
            }
            case "LIGHT_SCREEN": {
                getMainHandler().post(new Runnable() {
                    @Override
                    public void run() {
                        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    }
                });
                return false;
            }
            case "MOBILEWIZARD": {
                switch (messageAndParam[1]) {
                    case "show":
                        mMobileWizardVisible = true;
                        break;
                    case "hide":
                        mMobileWizardVisible = false;
                        break;
                }
                return false;
            }
            case "HYPERLINK": {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(messageAndParam[1]));
                startActivity(intent);
                return false;
            }
            case "EDITMODE": {
                switch (messageAndParam[1]) {
                    case "on":
                        mIsEditModeActive = true;
                        break;
                    case "off":
                        mIsEditModeActive = false;
                        break;
                }
                return false;
            }
            case "loadwithpassword": {
                mProgressDialog.determinate(R.string.loading);
                return true;
            }
            case "REQUESTFILECOPY": {
                requestForCopy();
                return false;
            }
        }
        return true;
    }

    public static void createNewFileInputDialog(Activity activity, final String defaultFileName, final String mimeType, final int requestCode) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);

        // The mime type and category must be set
        i.setType(mimeType);
        i.addCategory(Intent.CATEGORY_OPENABLE);

        i.putExtra(Intent.EXTRA_TITLE, defaultFileName);

        // Try to default to the Documents folder
        Uri documentsUri = Uri.parse("content://com.android.externalstorage.documents/document/home%3A");
        i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, documentsUri);

        activity.startActivityForResult(i, requestCode);
    }

    private void requestForCopy() {
        Cursor cursor = null;
        String filename = null;
        try {
            cursor = getContentResolver().query(getIntent().getData(), null, null, null, null);
            if (cursor != null && cursor.moveToFirst())
                filename = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME));
        } catch (Exception e) {
            return;
        }
        final String _filename = filename;
        final Activity mActivity = this;
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(getString(R.string.ask_for_copy));
        builder.setPositiveButton(getString(R.string.edit_copy), new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialogInterface, int i) {
                createNewFileInputDialog(mActivity, _filename, getIntent().getType(), REQUEST_COPY);
            }
        });
        builder.setNegativeButton(getString(R.string.view_only), null);
        builder.setCancelable(true);
        builder.show();
    }

    private void initiateSaveAs(String optionsString) {
        Map<String, String> optionsMap = new HashMap<>();
        String[] options = optionsString.split(" ");
        for (String option : options) {
            String[] keyValue = option.split("=", 2);
            if (keyValue.length == 2)
                optionsMap.put(keyValue[0], keyValue[1]);
        }
        String format = optionsMap.get("format");
        String mime = getMimeForFormat(format);
        if (format != null && mime != null) {
            String filename = optionsMap.get("name");
            if (filename == null)
                filename = "document." + format;
            int requestID = getRequestIDForFormat(format);

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            intent.putExtra(Intent.EXTRA_LOCAL_ONLY, false);
            File folder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.fromFile(folder).toString());
            intent.putExtra("android.content.extra.SHOW_ADVANCED", true);
            startActivityForResult(intent, requestID);
        }
    }

    private int getRequestIDForFormat(String format) {
        switch (format) {
            case "pdf": return REQUEST_SAVEAS_PDF;
            case "rtf": return REQUEST_SAVEAS_RTF;
            case "odt": return REQUEST_SAVEAS_ODT;
            case "odp": return REQUEST_SAVEAS_ODP;
            case "ods": return REQUEST_SAVEAS_ODS;
            case "docx": return REQUEST_SAVEAS_DOCX;
            case "pptx": return REQUEST_SAVEAS_PPTX;
            case "xlsx": return REQUEST_SAVEAS_XLSX;
            case "doc": return REQUEST_SAVEAS_DOC;
            case "ppt": return REQUEST_SAVEAS_PPT;
            case "xls": return REQUEST_SAVEAS_XLS;
            case "epub": return REQUEST_SAVEAS_EPUB;
        }
        return 0;
    }

    private String getMimeForFormat(String format) {
        switch(format) {
            case "pdf": return "application/pdf";
            case "rtf": return "text/rtf";
            case "odt": return "application/vnd.oasis.opendocument.text";
            case "odp": return "application/vnd.oasis.opendocument.presentation";
            case "ods": return "application/vnd.oasis.opendocument.spreadsheet";
            case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "doc": return "application/msword";
            case "ppt": return "application/vnd.ms-powerpoint";
            case "xls": return "application/vnd.ms-excel";
            case "epub": return "application/epub+zip";
        }
        return null;
    }

    private void afterMessageFromWebView(String[] messageAndParameterArray) {
        switch (messageAndParameterArray[0]) {
            case "uno":
                switch (messageAndParameterArray[1]) {
                    case ".uno:Copy":
                    case ".uno:Cut":
                        populateClipboard();
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }
    }

    private void initiatePrint() {
        PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
        PrintDocumentAdapter printAdapter = new PrintAdapter(LOActivity.this);
        printManager.print("Document", printAdapter, new PrintAttributes.Builder().build());
    }

    private void initiateSlideShow() {
        mProgressDialog.indeterminate(R.string.loading);

        nativeHandler.post(new Runnable() {
            @Override
            public void run() {
                Log.v(TAG, "saving svg for slideshow by " + Thread.currentThread().getName());
                final String slideShowFileUri = new File(LOActivity.this.getCacheDir(), "slideShow.svg").toURI().toString();
                LOActivity.this.saveAs(slideShowFileUri, "svg");
                LOActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        mProgressDialog.dismiss();
                        Intent slideShowActIntent = new Intent(LOActivity.this, SlideShowActivity.class);
                        slideShowActIntent.putExtra(SlideShowActivity.SVG_URI_KEY, slideShowFileUri);
                        LOActivity.this.startActivity(slideShowActIntent);
                    }
                });
            }
        });
    }

    /** Send message back to the shell (for example for the cloud save). */
    public void sendBroadcast(String event, String data) {
        Intent intent = new Intent(LO_ACTIVITY_BROADCAST);
        intent.putExtra(LO_ACTION_EVENT, event);
        intent.putExtra(LO_ACTION_DATA, data);
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }

    public native void saveAs(String fileUri, String format);

    public native boolean getClipboardContent(LokClipboardData aData);

    public native void setClipboardContent(LokClipboardData aData);

    public native void paste(String mimeType, byte[] data);

    public native void postUnoCommand(String command, String arguments, boolean bNotifyWhenFinished);

    /// Returns a magic that specifies this application - and this document.
    private final String getClipboardMagic() {
        return CLIPBOARD_LOOL_SIGNATURE + Long.toString(loadDocumentMillis);
    }

    /// Needs to be executed after the .uno:Copy / Paste has executed
    public final void populateClipboard()
    {
        File clipboardFile = new File(getApplicationContext().getCacheDir(), CLIPBOARD_FILE_PATH);
        if (clipboardFile.exists())
            clipboardFile.delete();

        LokClipboardData clipboardData = new LokClipboardData();
        if (!LOActivity.this.getClipboardContent(clipboardData))
            Log.e(TAG, "no clipboard to copy");
        else
        {
            clipboardData.writeToFile(clipboardFile);

            String text = clipboardData.getText();
            String html = clipboardData.getHtml();

            if (html != null) {
                int idx = html.indexOf("<meta name=\"generator\" content=\"");

                if (idx < 0)
                    idx = html.indexOf("<meta http-equiv=\"content-type\" content=\"text/html;");

                if (idx >= 0) { // inject our magic
                    StringBuffer newHtml = new StringBuffer(html);
                    newHtml.insert(idx, "<meta name=\"origin\" content=\"" + getClipboardMagic() + "\"/>\n");
                    html = newHtml.toString();
                }

                if (text == null || text.length() == 0)
                    Log.i(TAG, "set text to clipoard with: text '" + text + "' and html '" + html + "'");

                clipData = ClipData.newHtmlText(ClipDescription.MIMETYPE_TEXT_HTML, text, html);
                clipboardManager.setPrimaryClip(clipData);
            }
        }
    }

    /// Do the paste, and return true if we should short-circuit the paste locally
    private final boolean performPaste()
    {
        clipData = clipboardManager.getPrimaryClip();
        ClipDescription clipDesc = clipData != null ? clipData.getDescription() : null;
        if (clipDesc != null) {
            if (clipDesc.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML)) {
                final String html = clipData.getItemAt(0).getHtmlText();
                // Check if the clipboard content was made with the app
                if (html.contains(CLIPBOARD_LOOL_SIGNATURE)) {
                    // Check if the clipboard content is from the same app instance
                    if (html.contains(getClipboardMagic())) {
                        Log.i(TAG, "clipboard comes from us - same instance: short circuit it " + html);
                        return true;
                    } else {
                        Log.i(TAG, "clipboard comes from us - other instance: paste from clipboard file");

                        File clipboardFile = new File(getApplicationContext().getCacheDir(), CLIPBOARD_FILE_PATH);
                        LokClipboardData clipboardData = null;
                        if (clipboardFile.exists())
                            clipboardData = LokClipboardData.createFromFile(clipboardFile);

                        if (clipboardData != null) {
                            LOActivity.this.setClipboardContent(clipboardData);
                            LOActivity.this.postUnoCommand(".uno:Paste", null, false);
                        } else {
                            // Couldn't get data from the clipboard file, but we can still paste html
                            byte[] htmlByteArray = html.getBytes(Charset.forName("UTF-8"));
                            LOActivity.this.paste("text/html", htmlByteArray);
                        }
                    }
                } else {
                    Log.i(TAG, "foreign html '" + html + "'");
                    byte[] htmlByteArray = html.getBytes(Charset.forName("UTF-8"));
                    LOActivity.this.paste("text/html", htmlByteArray);
                }
            }
            else if (clipDesc.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN)) {
                final ClipData.Item clipItem = clipData.getItemAt(0);
                String text = clipItem.getText().toString();
                byte[] textByteArray = text.getBytes(Charset.forName("UTF-16"));
                LOActivity.this.paste("text/plain;charset=utf-16", textByteArray);
            }
        }
        return false;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
