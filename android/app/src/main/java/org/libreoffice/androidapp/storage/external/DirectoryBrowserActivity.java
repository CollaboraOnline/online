package org.libreoffice.androidapp.storage.external;


import android.app.Fragment;
import android.app.FragmentManager;
import android.content.Intent;
import android.os.Bundle;

import org.libreoffice.androidapp.R;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

/**
 * Container for DirectoryBrowserFragment
 */
public class DirectoryBrowserActivity extends AppCompatActivity {
    public static final String DIRECTORY_PATH_EXTRA = "org.libreoffice.directory_path_extra";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent data = getIntent();
        String initialPath = data.getStringExtra(DIRECTORY_PATH_EXTRA);

        setContentView(R.layout.activity_directory_browser);
        FragmentManager fm = getFragmentManager();
        Fragment fragment = DirectoryBrowserFragment.newInstance(initialPath);
        fm.beginTransaction()
                .add(R.id.fragment_container, fragment)
                .commit();
    }

    @Override
    public void onBackPressed() {
        FragmentManager fm = getFragmentManager();
        if(fm.getBackStackEntryCount() > 0) {
            fm.popBackStack();
        } else {
            super.onBackPressed();
        }
    }
}
