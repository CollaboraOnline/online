/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp.ui;

import android.app.Activity;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import org.libreoffice.androidapp.R;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

class RecentFilesAdapter extends RecyclerView.Adapter<RecentFilesAdapter.ViewHolder> {

    private final long KB = 1024;
    private final long MB = 1048576;

    private LibreOfficeUIActivity mActivity;
    private ArrayList<RecentFile> recentFiles;

    RecentFilesAdapter(LibreOfficeUIActivity activity, List<Uri> recentUris) {
        this.mActivity = activity;
        initRecentFiles(recentUris);
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View item = LayoutInflater.from(parent.getContext()).inflate(mActivity.isViewModeList() ? R.layout.file_list_item : R.layout.file_explorer_grid_item, parent, false);
        return new ViewHolder(item);
    }

    /** Validate uris in case of removed/renamed documents and return RecentFile ArrayList from the valid uris */
    public void initRecentFiles(List<Uri> recentUris) {
        this.recentFiles = new ArrayList<>();
        boolean invalidUriFound = false;
        String joined = "";
        for (Uri u: recentUris) {
            String filename = getUriFilename(mActivity, u);
            if (null != filename) {
                long length = getUriFileLength(mActivity, u);
                recentFiles.add(new RecentFile(u, filename, length));
                joined = joined.concat(u.toString()+"\n");
            }
            else
                invalidUriFound = true;
        }
        if (invalidUriFound) {
            mActivity.getPrefs().edit().putString(mActivity.RECENT_DOCUMENTS_KEY, joined).apply();
        }
    }

    /** Return the filename of the given Uri. */
    public static String getUriFilename(Activity activity, Uri uri) {
        String filename = "";
        Cursor cursor = null;
        try {
            cursor = activity.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst())
                filename = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME));
        } catch (Exception e) {
            return null;
        } finally {
            if (cursor != null)
                cursor.close();
        }

        if (filename.isEmpty())
            return null;

        return filename;
    }

    /** Return the size of the given Uri. */
    public static long getUriFileLength(Activity activity, Uri uri) {
        long length = 0;
        Cursor cursor = null;
        try {
            cursor = activity.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst())
                length = cursor.getLong(cursor.getColumnIndex(OpenableColumns.SIZE));
        } catch (Exception e) {
            return 0;
        } finally {
            if (cursor != null)
                cursor.close();
        }

        if (length == 0) {
            // TODO maybe try to get File & return File.length()?
        }

        return length;
    }

    @Override
    public void onBindViewHolder(ViewHolder holder, int position) {
        final RecentFile file = recentFiles.get(position);

        View.OnClickListener clickListener = new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mActivity.open(file.uri);

            }
        };

        holder.filenameView.setOnClickListener(clickListener);
        holder.imageView.setOnClickListener(clickListener);

        holder.fileActionsImageView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mActivity.openContextMenu(view, file.uri);
            }
        });

        String filename = file.filename;
        long length = file.fileLength;

        // TODO Date not avaiable now
        //Date date = null;

        holder.filenameView.setText(filename);

        int compoundDrawableInt = 0;

        switch (FileUtilities.getType(filename)) {
            case FileUtilities.DOC:
                compoundDrawableInt = R.drawable.writer;
                break;
            case FileUtilities.CALC:
                compoundDrawableInt = R.drawable.calc;
                break;
            case FileUtilities.DRAWING:
                compoundDrawableInt = R.drawable.draw;
                break;
            case FileUtilities.IMPRESS:
                compoundDrawableInt = R.drawable.impress;
                break;
        }

        if (compoundDrawableInt != 0)
            holder.imageView.setImageDrawable(ContextCompat.getDrawable(mActivity, compoundDrawableInt));

        // Date and Size field only exist when we are displaying items in a list.
        if (mActivity.isViewModeList()) {
            String size;
            String unit = "B";
            if (length < KB) {
                size = Long.toString(length);
            } else if (length < MB) {
                size = Long.toString(length / KB);
                unit = "KB";
            } else {
                size = Long.toString(length / MB);
                unit = "MB";
            }
            holder.fileSizeView.setText(size);
            holder.fileSizeUnitView.setText(unit);

            /* TODO Date not avaiable now
            if (date != null) {
                SimpleDateFormat df = new SimpleDateFormat("dd MMM yyyy hh:ss");
                //TODO format date
                holder.fileDateView.setText(df.format(date));
            }
            */
        }
    }

    @Override
    public int getItemCount() {
        if (recentFiles.size() == 0) {
            mActivity.noRecentItemsTextView.setVisibility(View.VISIBLE);
        } else {
            mActivity.noRecentItemsTextView.setVisibility(View.GONE);
        }
        return recentFiles.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {

        TextView filenameView, fileSizeView, fileSizeUnitView/*, fileDateView*/;
        ImageView imageView, fileActionsImageView;

        ViewHolder(View itemView) {
            super(itemView);
            this.filenameView = itemView.findViewById(R.id.file_item_name);
            this.imageView = itemView.findViewById(R.id.file_item_icon);
            this.fileActionsImageView = itemView.findViewById(R.id.file_actions_button);
            // Check if view mode is List, only then initialise Size and Date field
            if (mActivity.isViewModeList()) {
                fileSizeView = itemView.findViewById(R.id.file_item_size);
                fileSizeUnitView = itemView.findViewById(R.id.file_item_size_unit);
                //fileDateView = itemView.findViewById(R.id.file_item_date);
            }
        }
    }
    /** Cache the name & size so that we don't have ask later. */
    private class RecentFile {
        public Uri uri;
        public String filename;
        public long fileLength;

        public RecentFile(Uri uri, String filename, long fileLength) {
            this.uri = uri;
            this.filename = filename;
            this.fileLength = fileLength;
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
