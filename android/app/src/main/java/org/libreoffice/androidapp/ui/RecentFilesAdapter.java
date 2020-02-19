/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp.ui;

import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import org.libreoffice.androidapp.R;

import java.util.List;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

class RecentFilesAdapter extends RecyclerView.Adapter<RecentFilesAdapter.ViewHolder> {

    private LibreOfficeUIActivity mActivity;
    private List<Uri> recentUris;

    RecentFilesAdapter(LibreOfficeUIActivity activity, List<Uri> recentUris) {
        this.mActivity = activity;
        this.recentUris = recentUris;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View item = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_recent_files, parent, false);
        return new ViewHolder(item);
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

        String filename = "";

        // Try to get it from the content resolver first, fallback to path
        Cursor cursor = mActivity.getContentResolver().query(uri, null, null, null, null);
        try {
            if (cursor != null && cursor.moveToFirst()) {
                filename = cursor.getString(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME));
            }
        } finally {
            if (cursor != null)
                cursor.close();
        }

        if (filename.isEmpty()) {
            List<String> segments = uri.getPathSegments();
            if (segments.size() > 0)
                filename = segments.get(segments.size() - 1);
        }

        holder.textView.setText(filename);

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

        TextView textView;
        ImageView imageView;

        ViewHolder(View itemView) {
            super(itemView);
            this.textView = itemView.findViewById(R.id.textView);
            this.imageView = itemView.findViewById(R.id.imageView);
        }
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
