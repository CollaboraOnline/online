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
	private asyncCounter: number;
	private asyncPseudoThread: number;
	private socket: SocketBase;

	constructor(socket: SocketBase) {
		this.socket = socket;
		this.recordingToggle = false;
		this.asyncCounter = 0;
		// simulate a threads per live async event to help the chrome
		// renderer.
		this.asyncPseudoThread = 1;
	}

	public getRecordingToggle(): boolean {
		return this.recordingToggle;
	}

	public decrementAsyncPseudoThread(): void {
		this.asyncPseudoThread--;
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

	public createAsyncTraceEvent(
		name: string,
		args?: any,
	): CompleteTraceEvent | null {
		if (!this.recordingToggle) return null;

		const result: CompleteTraceEvent = {
			id: -1,
			tid: -1,
			active: false,
			args: {},
			begin: 0,
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			finish: () => {},
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			abort: () => {},
		};

		result.id = this.asyncCounter++;
		result.tid = this.asyncPseudoThread++;
		result.active = true;
		result.args = args;

		this.socket.sendTraceEvent(
			name,
			'S',
			undefined,
			args,
			result.id,
			result.tid,
		);

		const sockObj = this.socket;
		result.finish = function (this: CompleteTraceEvent) {
			sockObj.traceEvents.decrementAsyncPseudoThread();
			if (this.active) {
				sockObj.sendTraceEvent(
					name,
					'F',
					undefined,
					this.args,
					this.id,
					this.tid,
				);
				this.active = false;
			}
		};
		result.abort = function (this: CompleteTraceEvent) {
			sockObj.traceEvents.decrementAsyncPseudoThread();
			this.active = false;
		};
		return result;
	}

	public send(
		name: any,
		ph: string,
		timeRange: undefined | string,
		args?: any,
		id?: number | string,
		tid?: number | string,
	): void {
		if (timeRange === undefined)
			timeRange = 'ts=' + Math.round(performance.now() * 1000);
		if (!id) id = 1;
		if (!tid) tid = 1;

		this.socket.sendMessage(
			'TRACEEVENT name=' +
				JSON.stringify(name) +
				' ph=' +
				ph +
				' ' +
				timeRange +
				' id=' +
				id +
				' tid=' +
				tid +
				this.socket._stringifyArgs(args),
		);
	}
}
