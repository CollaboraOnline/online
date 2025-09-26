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
 * Socket to be intialized on opening the settings page in Admin console
 */

/* global DlgYesNo $ AdminSocketBase Admin _ */

var AdminSocketSettings = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
		this._init();
	},

	_init: function() {
		var socketSettings = this.socket;
		$(document).ready(function() {
			const adminForm = document.getElementById('admin_settings');
			if (adminForm) {
				adminForm.addEventListener('submit', function(e) {
					e.preventDefault();
					const memStatsSizeEl = document.getElementById('mem_stats_size');
					const memStatsIntervalEl = document.getElementById('mem_stats_interval');
					const cpuStatsSizeEl = document.getElementById('cpu_stats_size');
					const cpuStatsIntervalEl = document.getElementById('cpu_stats_interval');
					var memStatsSize = memStatsSizeEl ? memStatsSizeEl.value : '';
					var memStatsInterval = memStatsIntervalEl ? memStatsIntervalEl.value : '';
					var cpuStatsSize = cpuStatsSizeEl ? cpuStatsSizeEl.value : '';
					var cpuStatsInterval = cpuStatsIntervalEl ? cpuStatsIntervalEl.value : '';
					var command = 'set';
					command += ' mem_stats_size=' + memStatsSize;
					command += ' mem_stats_interval=' + memStatsInterval;
					command += ' cpu_stats_size=' + cpuStatsSize;
					command += ' cpu_stats_interval=' + cpuStatsInterval;
					command += ' limit_virt_mem_mb=' + (document.getElementById('limit_virt_mem_mb') ? document.getElementById('limit_virt_mem_mb').value : '');
					command += ' limit_stack_mem_kb=' + (document.getElementById('limit_stack_mem_kb') ? document.getElementById('limit_stack_mem_kb').value : '');
					command += ' limit_file_size_mb=' + (document.getElementById('limit_file_size_mb') ? document.getElementById('limit_file_size_mb').value : '');
					socketSettings.send(command);
				});
			} else {
				console.warn('Element #admin_settings not found');
			}

			document.getElementById('btnShutdown').onclick = function() {
				var dialog = (new DlgYesNo())
					.title(_('Confirmation'))
					.text(_('Are you sure you want to shut down the server?'))
					.yesButtonText(_('OK'))
					.noButtonText(_('Cancel'))
					.type('warning')
					.yesFunction(function() {
						socketSettings.send('shutdown maintenance');
					});
					dialog.open();
				};
		});
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);
		this.socket.send('subscribe settings');
		this.socket.send('settings');
		this.socket.send('version');
	},

	onSocketMessage: function(e) {
		var textMsg;
		if (typeof e.data === 'string') {
			textMsg = e.data;
		}
		else {
			textMsg = '';
		}

		if (textMsg.startsWith('settings')) {
			textMsg = textMsg.substring('settings '.length);
			var settings = textMsg.split(' ');
			for (var i = 0; i < settings.length; i++) {
				var setting = settings[i].split('=');
				var settingKey = setting[0];
				var settingVal = setting[1];
				var elem = document.getElementById(settingKey);
				if (elem) {
					elem.value = settingVal;
				}
			}
		}
		else if (textMsg.startsWith('coolserver ')) {
			// This must be the first message, unless we reconnect.
			var coolwsdVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			var h = coolwsdVersionObj.Hash;
			if (parseInt(h,16).toString(16) === h.toLowerCase().replace(/^0+/, '')) {
				h = '<a target="_blank" href="https://github.com/CollaboraOnline/online/commits/' + h + '">' + h + '</a>';
					{
						const el = document.getElementById('coolwsd-version');
						if (el) el.innerHTML = coolwsdVersionObj.Version + ' (git hash: ' + h + ')';
						else console.warn('Element #coolwsd-version not found');
					}
			}
			else {
					{
						const el = document.getElementById('coolwsd-version');
						if (el) el.textContent = coolwsdVersionObj.Version;
						else console.warn('Element #coolwsd-version not found');
					}
			}
			let buildConfig = coolwsdVersionObj.BuildConfig;
			if (coolwsdVersionObj.PocoVersion !== undefined) {
				buildConfig += ' (poco version: ' + coolwsdVersionObj.PocoVersion + ')';
			}
				{
					const el = document.getElementById('coolwsd-buildconfig');
					if (el) el.innerHTML = buildConfig;
					else console.warn('Element #coolwsd-buildconfig not found');
				}
		}
		else if (textMsg.startsWith('lokitversion ')) {
			var lokitVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			h = lokitVersionObj.BuildId.substring(0, 10);
			if (parseInt(h,16).toString(16) === h.toLowerCase().replace(/^0+/, '')) {
				h = '<a target="_blank" href="https://git.libreoffice.org/core/+log/' + lokitVersionObj.BuildId + '/">' + h + '</a>';
			}
			{
				const el = document.getElementById('lokit-version');
				if (el) el.innerHTML = lokitVersionObj.ProductName + ' ' +
				                         lokitVersionObj.ProductVersion + lokitVersionObj.ProductExtension +
				                         ' (git hash: ' + h + ')';
				else console.warn('Element #lokit-version not found');
			}
			{
				const el2 = document.getElementById('lokit-buildconfig');
				if (el2) el2.innerHTML = lokitVersionObj.BuildConfig;
				else console.warn('Element #lokit-buildconfig not found');
			}
		}
	},

	onSocketClose: function() {
		clearInterval(this._basicStatsIntervalId);
		this.base.call(this);
	}
});

Admin.Settings = function(host) {
	return new AdminSocketSettings(host);
};
