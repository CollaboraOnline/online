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

window.addEventListener('load', function () {
	app.calc.cellCursorRectangle = new app.definitions.simpleRectangle(
		0,
		0,
		0,
		0,
	);
	app.calc.cellAddress = new app.definitions.simplePoint(0, 0);
	app.calc.splitCoordinate = new app.definitions.simplePoint(0, 0);
	app.canvasSize = new app.definitions.simplePoint(0, 0);
	app.file.viewedRectangle = new app.definitions.simpleRectangle(0, 0, 0, 0);
	app.file.textCursor.rectangle = new app.definitions.simpleRectangle(
		0,
		0,
		0,
		0,
	);
});

app.getViewRectangles = function () {
	if (app.map._docLayer._splitPanesContext)
		return app.map._docLayer._splitPanesContext.getViewRectangles();
	else return [app.file.viewedRectangle.clone()];
};

// ToDo: _splitPanesContext should be an app variable.
app.isPointVisibleInTheDisplayedArea = function (twipsArray) {
	if (app.map._docLayer._splitPanesContext) {
		let rectangles = app.map._docLayer._splitPanesContext.getViewRectangles();
		for (let i = 0; i < rectangles.length; i++) {
			if (rectangles[i].containsPoint(twipsArray)) return true;
		}
		return false;
	} else {
		return app.file.viewedRectangle.containsPoint(twipsArray);
	}
};

app.isReadOnly = function () {
	return app.file.readOnly;
};

app.getScale = function () {
	return (app.tile.size.pixels[0] / app.tile.size.twips[0]) * 15;
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

app.registerExportFormat = function (label, format) {
	var duplicate = false;
	for (var i = 0; i < app.file.exportFormats.length; i++) {
		if (
			app.file.exportFormats[i].label == label &&
			app.file.exportFormats[i].format == format
		) {
			duplicate = true;
			break;
		}
	}

	if (duplicate == false) {
		app.file.exportFormats.push({ label: label, format: format });
	}
};

app.getFollowedViewId = function () {
	return app.following.viewId;
};

app.setFollowingOff = function () {
	app.following.mode = 'none';
	app.following.viewId = -1;
};

app.setFollowingUser = function (viewId) {
	app.following.mode = 'user';
	app.following.viewId = viewId;
};

app.setFollowingEditor = function (viewId = -1) {
	app.following.mode = 'editor';
	app.following.viewId = viewId;
};

app.isFollowingOff = function () {
	return app.following.mode === 'none';
};

app.isFollowingUser = function () {
	return app.following.mode === 'user';
};

app.isFollowingEditor = function () {
	return app.following.mode === 'editor';
};

app.isCalcRTL = function () {
	return (
		app.map._docLayer._rtlParts.indexOf(app.map._docLayer._selectedPart) >= 0
	);
};
