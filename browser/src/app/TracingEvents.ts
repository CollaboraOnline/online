/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class TraceEvents {
	private recordingToggle: boolean;
	private socket: SocketBase;

	constructor(socket: SocketBase) {
		this.socket = socket;
		this.recordingToggle = false;
	}

	public getRecordingToggle(): boolean {
		return this.recordingToggle;
	}

	public setLogging(enabled: boolean) {
		this.recordingToggle = enabled;
		this.socket.sendMessage(
			'traceeventrecording ' + (this.recordingToggle ? 'start' : 'stop'),
		);

		// Just as a test, uncomment this to toggle SAL_WARN and
		// SAL_INFO selection between two states: 1) the default
		// as directed by the SAL_LOG environment variable, and
		// 2) all warnings on plus SAL_INFO for sc.
		//
		// (Note that coolwsd sets the SAL_LOG environment variable
		// to "-WARN-INFO", i.e. the default is that nothing is
		// logged from core.)

		// app.socket.sendMessage('sallogoverride ' + (app.socket.traceEventRecordingToggle ? '+WARN+INFO.sc' : 'default'));
	}
}
