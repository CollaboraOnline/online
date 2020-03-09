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
import java.util.Date;
import java.util.List;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

class RecentFilesAdapter extends RecyclerView.Adapter<RecentFilesAdapter.ViewHolder> {

    private final long KB = 1024;
    private final long MB = 1048576;

    private LibreOfficeUIActivity mActivity;
    private List<Uri> recentUris;

    RecentFilesAdapter(LibreOfficeUIActivity activity, List<Uri> recentUris) {
        this.mActivity = activity;
        this.recentUris = recentUris;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View item = LayoutInflater.from(parent.getContext()).inflate(mActivity.isViewModeList() ? R.layout.file_list_item : R.layout.file_explorer_grid_item, parent, false);
        return new ViewHolder(item);
    }

    /** Return the filename of the given Uri. */
    public static String getUriFilename(Activity activity, Uri uri) {
        String filename = "";
        Cursor cursor = null;
        try {
            cursor = activity.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst())
                filename = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME));
        } finally {
            if (cursor != null)
                cursor.close();
        }

        if (filename.isEmpty()) {
            List<String> segments = uri.getPathSegments();
            if (segments.size() > 0)
                filename = segments.get(segments.size() - 1);
        }

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
        final Uri uri = recentUris.get(position);

        holder.itemView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mActivity.open(uri);
            }
        });

        String filename = getUriFilename(mActivity, uri);
        long length = getUriFileLength(mActivity, uri);
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
        if (recentUris.size() == 0) {
            mActivity.noRecentItemsTextView.setVisibility(View.VISIBLE);
        } else {
            mActivity.noRecentItemsTextView.setVisibility(View.GONE);
        }
        return recentUris.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {

        TextView filenameView, fileSizeView, fileSizeUnitView/*, fileDateView*/;
        ImageView imageView;

        ViewHolder(View itemView) {
            super(itemView);
            this.filenameView = itemView.findViewById(R.id.file_item_name);
            this.imageView = itemView.findViewById(R.id.file_item_icon);
            // Check if view mode is List, only then initialise Size and Date field
            if (mActivity.isViewModeList()) {
                fileSizeView = itemView.findViewById(R.id.file_item_size);
                fileSizeUnitView = itemView.findViewById(R.id.file_item_size_unit);
                //fileDateView = itemView.findViewById(R.id.file_item_date);
            }
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
