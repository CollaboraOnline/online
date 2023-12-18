/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Doc state functions.
 * This file is meant to be used for setting and getting the document states.
 */

/* global app */

app.isReadOnly = function () {
	return app.file.readOnly;
};

app.isCommentEditingAllowed = function () {
	return app.file.editComment;
};

app.setPermission = function (permission) {
	app.file.permission = permission;
	if (permission === 'edit') {
		app.file.readOnly = false;
		app.file.editComment = true;
	} else if (permission === 'readonly') {
		app.file.readOnly = true;
		app.file.editComment = false;
	}
};

app.setCommentEditingPermission = function (isAllowed) {
	app.file.editComment = isAllowed;
};

app.getPermission = function () {
	return app.file.permission;
};
