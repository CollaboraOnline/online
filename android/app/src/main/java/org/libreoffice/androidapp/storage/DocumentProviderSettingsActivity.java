/* -*- tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp.storage;

import android.content.Intent;
import android.content.SharedPreferences.OnSharedPreferenceChangeListener;
import android.os.Bundle;
import android.preference.PreferenceManager;

import org.libreoffice.androidapp.R;
import org.libreoffice.androidapp.storage.external.BrowserSelectorActivity;

import java.util.Set;

import androidx.appcompat.app.AppCompatActivity;
import androidx.preference.Preference;
import androidx.preference.PreferenceFragmentCompat;

public class DocumentProviderSettingsActivity extends AppCompatActivity {

    public static final String KEY_PREF_OWNCLOUD_SERVER = "pref_server_url";
    public static final String KEY_PREF_OWNCLOUD_USER_NAME = "pref_user_name";
    public static final String KEY_PREF_OWNCLOUD_PASSWORD = "pref_password";
    public static final String KEY_PREF_EXTERNAL_SD_PATH_URI = "pref_extsd_path_uri";
    public static final String KEY_PREF_OTG_PATH_URI = "pref_otg_path_uri";

    private Set<OnSharedPreferenceChangeListener> listeners;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Display the fragment as the main content.
        getSupportFragmentManager().beginTransaction()
                .replace(android.R.id.content, new SettingsFragment()).commit();
    }

    @Override
    protected void onResume() {
        super.onResume();
        listeners = DocumentProviderFactory.getInstance().getChangeListeners();
        for (OnSharedPreferenceChangeListener listener : listeners) {
            PreferenceManager.getDefaultSharedPreferences(this)
                    .registerOnSharedPreferenceChangeListener(listener);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        for (OnSharedPreferenceChangeListener listener : listeners) {
            PreferenceManager.getDefaultSharedPreferences(this)
                    .unregisterOnSharedPreferenceChangeListener(listener);
        }
    }

    public static class SettingsFragment extends PreferenceFragmentCompat {

        @Override
        public void onCreatePreferences(Bundle savedInstanceState, String rootKey) {
            // Load the preferences from an XML resource
            addPreferencesFromResource(R.xml.documentprovider_preferences);

            Preference extSDPreference = findPreference(KEY_PREF_EXTERNAL_SD_PATH_URI);

            /* FIXME fix or remove
            Preference otgPreference = findPreference(KEY_PREF_OTG_PATH_URI);
            */

            extSDPreference.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                @Override
                public boolean onPreferenceClick(Preference preference) {
                    startBrowserSelectorActivity(KEY_PREF_EXTERNAL_SD_PATH_URI,
                            BrowserSelectorActivity.MODE_EXT_SD);
                    return true;
                }
            });

            /* FIXME fix or remove
            otgPreference.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                @Override
                public boolean onPreferenceClick(Preference preference) {
                    startBrowserSelectorActivity(KEY_PREF_OTG_PATH_URI,
                            BrowserSelectorActivity.MODE_OTG);
                    return true;
                }
            });
            */
        }

        private void startBrowserSelectorActivity(String prefKey, String mode) {
            Intent i = new Intent(getActivity(), BrowserSelectorActivity.class);
            i.putExtra(BrowserSelectorActivity.PREFERENCE_KEY_EXTRA, prefKey);
            i.putExtra(BrowserSelectorActivity.MODE_EXTRA, mode);
            startActivity(i);
        }

    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
