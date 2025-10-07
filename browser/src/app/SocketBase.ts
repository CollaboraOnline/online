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

class SocketBase {
	private ProtocolVersionNumber: string = '0.1';
	private ReconnectCount: number = 0;
	private WasShownLimitDialog: boolean = false;
	private WSDServer: WSDServerInfo = {
		Id: '',
		Version: '',
		Hash: '',
		Protocol: '',
		Options: '',
		Timezone: '',
	};
	private IndirectSocketReconnectCount: number = 0;

	/// Whether Trace Event recording is enabled or not. ("Enabled" here means whether it can be
	/// turned on (and off again), not whether it is on.)
	private enableTraceEventLogging: boolean = false;

	// Will be set from lokitversion message
	private TunnelledDialogImageCacheSize: number = 0;

	private _map: MapInterface;
	private _msgQueue: MessageInterface[];
	private _delayedMessages: DelayedMessageInterface[];
	private _slurpQueue: SlurpMessageEvent[];
	private _handlingDelayedMessages: boolean;
	private _inLayerTransaction: boolean;
	private _slurpDuringTransaction: boolean;
	private _accessTokenExpireTimeout: TimeoutHdl | undefined;
	private _reconnecting: boolean;
	private _slurpTimer: TimeoutHdl | undefined;
	private _renderEventTimer: TimeoutHdl | undefined;
	private _renderEventTimerStart: DOMHighResTimeStamp | undefined;
	private _slurpTimerDelay: number | undefined;
	private _slurpTimerLaunchTime: number | undefined;
	private traceEventRecordingToggle: boolean;
	private timer: ReturnType<typeof setInterval> | undefined;
	private asyncTraceEventCounter: number;
	private asyncTracePseudoThread: number;
	private threadLocalLoggingLevelToggle: boolean;

	private socket?: SockInterface;

	constructor(map: MapInterface) {
		window.app.console.debug('socket.initialize:');
		this._map = map;
		this._slurpQueue = [];
		this._msgQueue = [];
		this._delayedMessages = [];
		this._handlingDelayedMessages = false;
		this._inLayerTransaction = false;
		this._slurpDuringTransaction = false;
		this.traceEventRecordingToggle = false;
		this.asyncTraceEventCounter = 0;
		// simulate a threads per live async event to help the chrome
		// renderer.
		this.asyncTracePseudoThread = 1;
		this.threadLocalLoggingLevelToggle = false;
		this._accessTokenExpireTimeout = undefined;
		this._reconnecting = false;
		this._slurpTimer = undefined;
		this._renderEventTimer = undefined;
		this._renderEventTimerStart = undefined;
		this._slurpTimerDelay = undefined;
		this._slurpTimerLaunchTime = undefined;
		this.timer = undefined;
		this.socket = undefined;
	}
}
