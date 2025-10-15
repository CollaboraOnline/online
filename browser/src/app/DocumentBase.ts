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

class DocumentBase {
	public readonly type: string = 'DocumentBase';
	public activeView: ViewLayoutBase;
	public tableMiddleware: TableMiddleware;

	protected _fileSize: cool.SimplePoint;

	constructor() {
		if (app.map._docLayer._docType === 'text') {
			this.activeView = new ViewLayoutWriter();
		} else {
			this.activeView = new ViewLayoutBase();
		}
		this._fileSize = new cool.SimplePoint(0, 0);
		this.tableMiddleware = new TableMiddleware();

		this.tableMiddleware.setupTableOverlay();
	}

	public get fileSize(): cool.SimplePoint {
		return this._fileSize;
	}

	public set fileSize(value: cool.SimplePoint) {
		this._fileSize = value;
	}
}
