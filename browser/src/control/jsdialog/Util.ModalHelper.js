/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/*
 * JSDialog.ModalHelper - helper functions for manipulating modals built using jsdialog
 */

/* global JSDialog app */

var modalIdPretext = 'modal-dialog-';

/// Returns generated (or to be generated) id for the modal container.
function generateModalId(givenId) {
	return modalIdPretext + givenId;
}

function sendJSON(json) {
	if (!app.socket)
		return;

	app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json)});
}

function setMessageInModal(id, msg1) {
	var dialogId = generateModalId(id);

	var json = {
		id: dialogId,
		jsontype: 'dialog',
		type: 'modalpopup',
		action: 'update',
		control: {
			id: 'info-modal-label1',
			type: 'fixedtext',
			text: msg1
		}
	};

	sendJSON(json);
}

function enableButtonInModal(id, buttonId, enable) {
	var dialogId = generateModalId(id);

	var json = {
		id: dialogId,
		jsontype: 'dialog',
		type: 'modalpopup',
		action: 'action',
		data: {
			'control_id': buttonId,
			'action_type': (enable ? 'enable' : 'disable')
		}
	};

	sendJSON(json);
}

JSDialog.generateModalId = generateModalId;
JSDialog.sendJSON = sendJSON;
JSDialog.setMessageInModal = setMessageInModal;
JSDialog.enableButtonInModal = enableButtonInModal;
