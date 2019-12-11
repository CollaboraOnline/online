/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/*
 * This file is part of the LibreOffice project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.libreoffice.androidapp;

import android.app.Application;
import android.content.Context;
import android.os.Handler;

public class LibreOfficeApplication extends Application {

    private static Handler mainHandler;

    public LibreOfficeApplication() {
    }

    public static Handler getMainHandler() {
        if (mainHandler == null)
            mainHandler = new Handler();

        return mainHandler;
    }
}

/* vim:set shiftwidth=4 softtabstop=4 expandtab: */
