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

/* global app _ */

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
app.isPointVisibleInTheDisplayedArea = function (twipsArray /* x, y */) {
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

app.isRectangleVisibleInTheDisplayedArea = function (
	twipsArray /* x, y, width, height */,
) {
	if (app.map._docLayer._splitPanesContext) {
		let rectangles = app.map._docLayer._splitPanesContext.getViewRectangles();
		for (let i = 0; i < rectangles.length; i++) {
			if (rectangles[i].intersectsRectangle(twipsArray)) return true;
		}
		return false;
	} else {
		return app.file.viewedRectangle.intersectsRectangle(twipsArray);
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
	console.debug('user following: OFF');
	app.following.mode = 'none';
	app.following.viewId = -1;
};

app.setFollowingUser = function (viewId) {
	console.debug('user following: USER - ' + viewId);
	app.following.mode = 'user';
	app.following.viewId = viewId;
};

app.setFollowingEditor = function (viewId = -1) {
	console.debug('user following: EDITOR - ' + viewId);
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

app.updateFollowingUsers = function () {
	console.debug('user following: update');
	var isCellCursorVisible = app.calc.cellCursorVisible;
	var isTextCursorVisible = app.file.textCursor.visible;

	if (isCellCursorVisible || isTextCursorVisible) {
		let twipsArray = [];
		if (isCellCursorVisible)
			twipsArray = [
				app.calc.cellCursorRectangle.x2,
				app.calc.cellCursorRectangle.y2,
			];
		else
			twipsArray = [
				app.file.textCursor.rectangle.x2,
				app.file.textCursor.rectangle.y2,
			];

		const cursorPositionInView =
			app.isPointVisibleInTheDisplayedArea(twipsArray);

		if (
			parseInt(app.getFollowedViewId()) ===
				parseInt(app.map._docLayer._viewId) &&
			!cursorPositionInView
		) {
			app.setFollowingOff();
		} else if (
			parseInt(app.getFollowedViewId()) === -1 &&
			cursorPositionInView
		) {
			app.setFollowingUser(parseInt(app.map._docLayer._viewId));
		}
	}
};

app.showAsyncDownloadError = function (response, initialMsg) {
	const reader = new FileReader();
	const timeout = 10000;
	reader.onload = function () {
		if (reader.result === 'wrong server') {
			initialMsg += _(', cluster configuration error: mis-matching serverid');
			app.map.uiManager.showSnackbar(initialMsg, '', null, timeout);
		} else {
			app.map.uiManager.showSnackbar(initialMsg, '', null, timeout);
		}
	};
	reader.readAsText(response);
};

app.calc.isRTL = function () {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return false;

	const part =
		app.map._docLayer._lastStatusJSON.parts[app.map._docLayer._selectedPart];

	if (part) return part.rtllayout !== 0;
	else return false;
};

app.setServerAuditFromCore = function (entries) {
	app.serverAudit = entries;
	app.map.fire('receivedserveraudit');
};

app.isExperimentalMode = function () {
	if (app.socket && app.socket.WSDServer && app.socket.WSDServer.Options)
		return app.socket.WSDServer.Options.indexOf('E') !== -1;
	return false;
};

app.calc.isPartHidden = function (part) {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return false;

	return app.map._docLayer._lastStatusJSON.parts[part].visible === 0; // ToDo: Move _lastStatusJSON into docstate.js
};

app.calc.isPartProtected = function (part) {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return false;

	return app.map._docLayer._lastStatusJSON.parts[part].protected === 1;
};

app.calc.isAnyPartHidden = function () {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return false;

	for (let i = 0; i < app.map._docLayer._lastStatusJSON.parts.length; i++) {
		if (app.map._docLayer._lastStatusJSON.parts[i].visible === 0) return true;
	}
	return false;
};

app.calc.getHiddenPartCount = function () {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return 0;

	let count = 0;

	for (let i = 0; i < app.map._docLayer._lastStatusJSON.parts.length; i++) {
		if (app.map._docLayer._lastStatusJSON.parts[i].visible === 0) count++;
	}

	return count;
};

app.calc.getVisiblePartCount = function () {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return 0;

	let count = 0;

	for (let i = 0; i < app.map._docLayer._lastStatusJSON.parts.length; i++) {
		if (app.map._docLayer._lastStatusJSON.parts[i].visible === 1) count++;
	}

	return count;
};

app.calc.getHiddenPartNameArray = function () {
	if (!app.map._docLayer || !app.map._docLayer._lastStatusJSON) return [];

	let array = [];

	for (let i = 0; i < app.map._docLayer._lastStatusJSON.parts.length; i++) {
		let part = app.map._docLayer._lastStatusJSON.parts[i];
		if (part.visible === 0) array.push(part.name);
	}

	return array;
};

app.impress.isSlideHidden = function (index) {
	if (app.impress.partList) {
		if (app.impress.partList.length > index)
			return !app.impress.partList[index].visible;
		else {
			console.warn(
				'Index is bigger than the part count (isSlideHidden): ' + index,
			);
			return true;
		}
	} else return false;
};

app.impress.areAllSlidesHidden = function () {
	if (app.impress.partList) {
		for (let i = 0; i < app.impress.partList.length; i++) {
			if (app.impress.partList[i].visible === 1) return false;
		}
		return true;
	} else return false;
};

app.impress.getSelectedSlidesCount = function () {
	let count = 0;

	if (app.impress.partList) {
		for (let i = 0; i < app.impress.partList.length; i++) {
			if (app.impress.partList[i].selected === 1) count++;
		}
	}

	return count;
};

app.impress.getIndexFromSlideHash = function (hash) {
	if (app.impress.partList) {
		for (let i = 0; i < app.impress.partList.length; i++) {
			if (app.impress.partList[i].hash === hash) return i;
		}

		console.warn('No part with hash (getIndexFromSlideHash): ' + hash);

		return 0;
	} else return 0;
};

app.impress.isSlideSelected = function (index) {
	if (
		app.impress.partList &&
		index >= 0 &&
		index < app.impress.partList.length
	) {
		return app.impress.partList[index].selected === 1;
	} else return false;
};

let _layoutTaskFlush = null;

let _flushLayoutingQueue = function () {
	if (app.layoutTasks.length) {
		window.requestAnimationFrame(() => {
			const task = app.layoutTasks.shift();
			if (task) {
				task.call(this);
				app.scheduleLayouting();
			}
		});
		_layoutTaskFlush = null;
	}
};

app.appendLayoutingTask = function (task) {
	app.layoutTasks.push(task);
};

app.scheduleLayouting = function () {
	if (_layoutTaskFlush) clearTimeout(_layoutTaskFlush);

	_layoutTaskFlush = setTimeout(_flushLayoutingQueue, 10);
};
