/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp.ui;


import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import org.libreoffice.androidapp.R;
import org.libreoffice.androidapp.storage.IFile;

import java.util.List;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

class RecentFilesAdapter extends RecyclerView.Adapter<RecentFilesAdapter.ViewHolder> {

    private LibreOfficeUIActivity mActivity;
    private List<IFile> recentFiles;

    RecentFilesAdapter(LibreOfficeUIActivity activity, List<IFile> recentFiles) {
        this.mActivity = activity;
        this.recentFiles = recentFiles;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View item = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_recent_files, parent, false);
        return new ViewHolder(item);
    }

    @Override
    public void onBindViewHolder(ViewHolder holder, int position) {
        final IFile iFile = recentFiles.get(position);

        holder.itemView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mActivity.open(iFile);
            }
        });

        String filename = iFile.getName();

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
        if (recentFiles.size() == 0) {
            mActivity.noRecentItemsTextView.setVisibility(View.VISIBLE);
        } else {
            mActivity.noRecentItemsTextView.setVisibility(View.GONE);
        }
        return recentFiles.size();
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
