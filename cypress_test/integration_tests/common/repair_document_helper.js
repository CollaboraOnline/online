'use strict';
/* global cy require */

var mobileHelper = require('./mobile_helper');

/**
 * Opens the document repair dialog in the given frame
 *
 * @param {boolean} mobile - True if this is a mobile test, otherwise false
 * @returns {void}
 */
function openRepairDialog(mobile = false) {
	if (mobile) {
		return mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);
	}
	cy.cGet('#menu-editmenu').click().cGet('#menu-repair').click();
}

/**
 * Rolls back past the last change matching the selector using the repair document dialog
 *
 * @param {string} selector - Something to identify the change you want to rollback past. Can be the comment (i.e. 'Typing "World"') or another field (i.e. 'Undo'). The first change that matches this selector will be picked
  * @param {boolean} mobile - True if this is a mobile test, otherwise false
 * @returns {void}
 */
function rollbackPastChange(selector, mobile = false) {
	openRepairDialog(mobile);

	cy.cGet('#DocumentRepairDialog').should('exist');

	const versions = cy.cGet('#versions');

	versions
		.contains('.ui-listview-entry', selector)
		.click();

	if (mobile) {
		cy.cGet('#ok.ui-pushbutton.mobile-wizard').click();
	} else {
		cy.cGet('#ok.ui-pushbutton.jsdialog').click();
	}
}

module.exports = {
	openRepairDialog,
	rollbackPastChange,
};
