/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp.storage.external;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.SharedPreferences.OnSharedPreferenceChangeListener;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.preference.PreferenceManager;
import android.util.Log;

import org.libreoffice.androidapp.R;
import org.libreoffice.androidapp.storage.DocumentProviderSettingsActivity;
import org.libreoffice.androidapp.storage.IFile;

import java.io.File;
import java.net.URI;

import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;

/**
 * Implementation of IDocumentProvider for the external file system.
 *
 * https://stackoverflow.com/questions/40068984/universal-way-to-write-to-external-sd-card-on-android
 * https://developer.android.com/training/data-storage/shared/documents-files
 *
 * On the Android versions we target, it's not possible to access files on a
 * SD card directly, first you need to trigger the system file picker
 * (Intert.ACTION_OPEN_DOCUMENT_TREE), and then you have to access the files
 * via the content provider you've got.
 */
public class ExtsdDocumentsProvider implements IExternalDocumentProvider,
        OnSharedPreferenceChangeListener{
    private static final String LOGTAG = ExtsdDocumentsProvider.class.getSimpleName();

    private int id;
    private File cacheDir;
    private boolean hasRemovableStorage = false;

    public ExtsdDocumentsProvider(int id, Context context) {
        this.id = id;
        setupRootPathUri(context);
        setupCache(context);
    }

    private void setupRootPathUri(Context context) {
        String rootURI = guessRootURI(context);
        if (rootURI != null && !rootURI.isEmpty())
            hasRemovableStorage = true;
    }

    /**
     * Even though this provides a file:///-like path, it is not possible to
     * use the files there directly, we have to go through the content:// url
     * that we get from the Intent.ACTION_OPEN_DOCUMENT_TREE.
     *
     * But it is useful to still keep this code, to decide whether we should
     * show the "External SD" in the menu or not.
     */
    @Override
    public String guessRootURI(Context context) {
        // TODO: unfortunately the getExternalFilesDirs function relies on devices to actually
        // follow guidelines re external storage. Of course device manufacturers don't and as such
        // you cannot rely on it returning the actual paths (neither the compat, nor the native variant)
        File[] possibleRemovables = ContextCompat.getExternalFilesDirs(context, null);

        // the primary dir that is already covered by the "LocalDocumentsProvider"
        // might be emulated/part of internal memory or actual SD card
        // TODO: change to not confuse android's "external storage" with "expandable storage"
        String primaryExternal = Environment.getExternalStorageDirectory().getAbsolutePath();

        for (File option: possibleRemovables) {
            // Returned paths may be null if a storage device is unavailable.
            if (null == option) {
                Log.w(LOGTAG, "path was a null option :-/");
                continue;
            }

            String optionPath = option.getAbsolutePath();
            if (optionPath.startsWith(primaryExternal)) {
                Log.v(LOGTAG, "did get file path - but is same as primary storage ("+ primaryExternal +")");
                continue;
            }

            String optionURI = Uri.fromFile(option).toString();

            Log.d(LOGTAG, "got the path: " + optionURI);
            return optionURI;
        }

        Log.i(LOGTAG, "no secondary storage reported");
        return null;
    }

    private void setupCache(Context context) {
        // TODO: probably we should do smarter cache management
        cacheDir = new File(context.getExternalCacheDir(), "externalFiles");
        if (cacheDir.exists()) {
            deleteRecursive(cacheDir);
        }
        cacheDir.mkdirs();
    }

    private static void deleteRecursive(File file) {
        if (file.isDirectory()) {
            for (File child : file.listFiles())
                deleteRecursive(child);
        }
        file.delete();
    }

    public File getCacheDir() {
        return cacheDir;
    }

    @Override
    public IFile getRootDirectory(Context context) {
        SharedPreferences preferences = PreferenceManager.getDefaultSharedPreferences(context);
        String rootPathURI = preferences.getString(DocumentProviderSettingsActivity.KEY_PREF_EXTERNAL_SD_PATH_URI, "");
        if (rootPathURI.isEmpty())
            throw buildRuntimeExceptionForInvalidFileURI(context);

        try {
            return new ExternalFile(this,
                                    DocumentFile.fromTreeUri(context, Uri.parse(rootPathURI)),
                                    context);
        } catch (Exception e) {
            //invalid rootPathURI
            throw buildRuntimeExceptionForInvalidFileURI(context);
        }
    }

    private RuntimeException buildRuntimeExceptionForInvalidFileURI(Context context) {
        // ToDo: discarding the original exception / catch-all handling is bad style
        return new RuntimeException(context.getString(R.string.ext_document_provider_error));
    }

    @Override
    public IFile createFromUri(Context context, URI javaURI) {
        //TODO: refactor when new DocumentFile API exist
        //uri must be of a DocumentFile file, not directory.
        Uri androidUri = Uri.parse(javaURI.toString());
        return new ExternalFile(this,
                                DocumentFile.fromSingleUri(context, androidUri),
                                context);
    }

    @Override
    public int getNameResource() {
        return R.string.external_sd_file_system;
    }

    @Override
    public int getId() {
        return id;
    }

    @Override
    public boolean checkProviderAvailability(Context context) {
        SharedPreferences preferences = PreferenceManager.getDefaultSharedPreferences(context);
        String rootPathURI = preferences.getString(DocumentProviderSettingsActivity.KEY_PREF_EXTERNAL_SD_PATH_URI, "");

        // either we know we have the storage or the user has set something explicitly
        return (hasRemovableStorage || !rootPathURI.isEmpty()) && ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
