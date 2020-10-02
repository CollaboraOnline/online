/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RadioGroup;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.preference.Preference;
import androidx.preference.PreferenceFragmentCompat;
import org.libreoffice.androidapp.ui.LibreOfficeUIActivity;

public class SettingsActivity extends AppCompatActivity {

    private static SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.LibreOfficeTheme_Base);
        super.onCreate(savedInstanceState);

        // Display the fragment as the main content.
        getSupportFragmentManager().beginTransaction()
                .replace(android.R.id.content, new SettingsFragment())
                .commit();
        prefs = getSharedPreferences(LibreOfficeUIActivity.EXPLORER_PREFS_KEY, MODE_PRIVATE);
    }

    public static class SettingsFragment extends PreferenceFragmentCompat implements SharedPreferences.OnSharedPreferenceChangeListener {

        int dayNightMode;
        int selectedThemeBtnId;
        @Override
        public void onCreatePreferences(Bundle savedInstanceState, String rootKey) {
            addPreferencesFromResource(R.xml.libreoffice_preferences);
            if (!BuildConfig.DEBUG) {
                findPreference("ENABLE_SHOW_DEBUG_INFO").setVisible(false);
            }
            Preference themePreference = findPreference("THEME_SELECTION");

            dayNightMode = AppCompatDelegate.getDefaultNightMode();
            selectedThemeBtnId = R.id.radioBtn_default;
            switch (dayNightMode) {
                case AppCompatDelegate.MODE_NIGHT_YES:
                    themePreference.setSummary(R.string.theme_dark);
                    selectedThemeBtnId = R.id.radioBtn_dark;
                    break;
                case AppCompatDelegate.MODE_NIGHT_NO:
                    themePreference.setSummary(R.string.theme_light);
                    selectedThemeBtnId = R.id.radioBtn_light;
                    break;
                case AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM:
                    themePreference.setSummary(R.string.theme_system_default);
                    selectedThemeBtnId = R.id.radioBtn_default;
                    break;
            }

            themePreference.setOnPreferenceClickListener(new Preference.OnPreferenceClickListener() {
                @Override
                public boolean onPreferenceClick(Preference preference) {
                    View view = getLayoutInflater().inflate(R.layout.theme_selection, null);
                    RadioGroup group = (RadioGroup) view.findViewById(R.id.radioGrp_theme);
                    group.check(selectedThemeBtnId);

                    group.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
                        @Override
                        public void onCheckedChanged(RadioGroup radioGroup, int i) {
                            switch (i) {
                                case R.id.radioBtn_dark:
                                    dayNightMode = AppCompatDelegate.MODE_NIGHT_YES;
                                    break;
                                case R.id.radioBtn_light:
                                    dayNightMode = AppCompatDelegate.MODE_NIGHT_NO;
                                    break;
                                case R.id.radioBtn_default:
                                    dayNightMode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
                                    break;
                            }
                            AppCompatDelegate.setDefaultNightMode(dayNightMode);
                            prefs.edit().putInt(LibreOfficeUIActivity.NIGHT_MODE_KEY, dayNightMode).commit();
                            getActivity().recreate();

                        }
                    });

                    AlertDialog.Builder dialog = new AlertDialog.Builder(getActivity());
                    dialog.setView(view);
                    dialog.setTitle(getString(R.string.choose_theme));
                    dialog.setCancelable(true);
                    dialog.setNegativeButton(getString(R.string.cancel_label), null);
                    dialog.show();
                    return false;
                }
            });
        }

        @Override
        public void onResume() {
            super.onResume();
            getPreferenceScreen().getSharedPreferences()
                    .registerOnSharedPreferenceChangeListener(this);
        }

        @Override
        public void onPause() {
            super.onPause();
            getPreferenceScreen().getSharedPreferences()
                    .unregisterOnSharedPreferenceChangeListener(this);
        }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
            SettingsListenerModel.getInstance().changePreferenceState(sharedPreferences, key);
        }
    }
}
/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
