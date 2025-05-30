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
	cy.log('>> openRepairDialog - start');

	if (mobile) {
		return mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);
	}
	cy.cGet('#menu-editmenu').click()
	cy.cGet('#menu-repair').click();

	cy.log('<< openRepairDialog - end');
}

/**
 * Rolls back past the last change matching the selector using the repair document dialog
 *
 * @param {string} selector - Something to identify the change you want to rollback past. Can be the comment (i.e. 'Typing "World"') or another field (i.e. 'Undo'). The first change that matches this selector will be picked
  * @param {boolean} mobile - True if this is a mobile test, otherwise false
 * @returns {void}
 */
function rollbackPastChange(selector, mobile = false) {
	cy.log('>> rollbackPastChange - start');

	openRepairDialog(mobile);

	cy.cGet('#DocumentRepairDialog').should('exist');

	const versions = cy.cGet('#versions');

	versions
		.contains('.ui-treeview-entry', selector)
		.click();

	if (mobile) {
		cy.cGet('#ok.ui-pushbutton.mobile-wizard').click();
	} else {
		cy.cGet('#ok.ui-pushbutton.jsdialog').click();
	}

	cy.log('<< rollbackPastChange - end');
}

module.exports = {
	openRepairDialog,
	rollbackPastChange,
};
