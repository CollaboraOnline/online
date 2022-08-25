'use strict';
/* global cy require */

var mobileHelper = require('./mobile_helper');

/**
 * Opens the document repair dialog in the given frame
 *
 * @param {string|undefined} frameId - The ID of the frame to execute in, or undefined if you're not running in a framed environment
 * @param {boolean} mobile - True if this is a mobile test, otherwise false
 * @returns {void}
 */
function openRepairDialog(frameId = undefined, mobile = false) {
	if (mobile) {
		return mobileHelper.selectHamburgerMenuItem(['Edit', 'Repair']);
	}

	cy.customGet('#menu-editmenu', frameId)
		.click()
		.customGet('#menu-repair', frameId)
		.click();
}

/**
 * Rolls back past the last change matching the selector using the repair document dialog
 *
 * @param {string} selector - Something to identify the change you want to rollback past. Can be the comment (i.e. 'Typing "World"') or another field (i.e. 'Undo'). The first change that matches this selector will be picked
 * @param {string|undefined} frameId - The ID of the frame to execute in, or undefined if you're not running in a framed environment
 * @param {boolean} mobile - True if this is a mobile test, otherwise false
 * @returns {void}
 */
function rollbackPastChange(selector, frameId = undefined, mobile = false) {
	openRepairDialog(frameId, mobile);

	cy.customGet('#DocumentRepairDialog', frameId).should('exist');
	
	const versions = cy.customGet('#versions', frameId);

	versions
		.contains('.ui-listview-entry', selector)
		.click();

	if (mobile) {
		cy.customGet('#ok.ui-pushbutton.mobile-wizard', frameId).click();
	} else {
		cy.customGet('#ok.ui-pushbutton.jsdialog', frameId).click();
	}
}

module.exports = {
	openRepairDialog,
	rollbackPastChange,
};
