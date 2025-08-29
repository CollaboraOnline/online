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
 * Socket to be intialized on opening the history page in Admin console
 */

/* global Admin $ AdminSocketBase */

var AdminSocketHistory = AdminSocketBase.extend({
	constructor: function(host) {
		this.base(host);
	},

	refreshHistory: function() {
		this.socket.send('history');
	},

	onSocketOpen: function() {
		// Base class' onSocketOpen handles authentication
		this.base.call(this);

		var socketHistory = this;
		const refreshHistoryBtn = document.getElementById('refreshHistory');
		if (refreshHistoryBtn) {
			refreshHistoryBtn.addEventListener('click', function () {
				return socketHistory.refreshHistory();
			});
		} else {
			console.warn('Element #refreshHistory not found');
		}
		this.refreshHistory();
	},

	onSocketMessage: function(e) {
		//if (e.data == 'InvalidAuthToken' || e.data == 'NotAuthenticated') {
		//	this.base.call(this);
		//	this.refreshHistory();
		//} else {
		var jsonObj;
		try {
			jsonObj = JSON.parse(e.data);
			var doc = jsonObj['History']['documents'];
			var exdoc = jsonObj['History']['expiredDocuments'];
				const jsonDocEl = document.getElementById('json-doc');
				if (jsonDocEl) {
					const ta = jsonDocEl.querySelector('textarea');
					if (ta) ta.textContent = JSON.stringify(doc);
				} else {
					console.warn('Element #json-doc not found');
				}
				const jsonExDocEl = document.getElementById('json-ex-doc');
				if (jsonExDocEl) {
					const ta2 = jsonExDocEl.querySelector('textarea');
					if (ta2) ta2.textContent = JSON.stringify(exdoc);
				} else {
					console.warn('Element #json-ex-doc not found');
				}
		} catch (e) {
			$('document').alert(e.message);
		}
	},

	onSocketClose: function() {
		this.base.call(this);
	}
});

Admin.History = function(host) {
	return new AdminSocketHistory(host);
};
