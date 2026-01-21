/* global describe expect it cy before after afterEach require Cypress */

var helper = require('../../common/helper');
var ceHelper = require('../../common/contenteditable_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Accessibility Writer Sidebar Tests', { testIsolation: false }, function () {
	let win;

	before(function () {
		helper.setupAndLoadDocument('writer/help_dialog.odt');

		// to make insertImage use the correct buttons
		desktopHelper.switchUIToNotebookbar();

		// Hide sidebar before enabling UICoverage tracking
		desktopHelper.sidebarToggle();
		cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

		cy.getFrameWindow().then(function (frameWindow) {
			win = frameWindow;

			const enableUICoverage = {
				'Track': { 'type': 'boolean', 'value': true }
			};
			win.app.map.sendUnoCommand('.uno:UICoverage', enableUICoverage);
		});

		// Show sidebar again after UICoverage tracking is enabled
		desktopHelper.sidebarToggle();
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');

		cy.cGet('.jsdialog-window').should('not.exist');
	});

	after(function () {
		cy.spy(win.app.socket, '_onMessage').as('onMessage').log(false);

		// Run after the sidebars are processed and errors checked
		cy.then(() => {
			const endUICoverage = {
				'Report': { 'type': 'boolean', 'value': true },
				'Track': { 'type': 'boolean', 'value': false }
			};
			win.app.map.sendUnoCommand('.uno:UICoverage', endUICoverage);
		});

		cy.get('@onMessage').should(onMessage => {
			const matchingCall = onMessage.getCalls().find(call => {
				const evt = call.args && call.args[0]
				const textMsg = evt && evt.textMsg;
				if (!textMsg || !textMsg.startsWith('unocommandresult:')) {
					return false;
				}
				const jsonPart = textMsg.replace('unocommandresult:', '').trim();
				const data = JSON.parse(jsonPart);
				return data.commandName === '.uno:UICoverage';
			});

			expect(matchingCall, '.uno:UICoverage result').to.be.an('object');

			const textMsg = matchingCall.args[0].textMsg;
			const jsonPart = textMsg.replace('unocommandresult:', '').trim();
			const result = JSON.parse(jsonPart).result;

			Cypress.log({name: 'UICoverage Message: ', message: JSON.stringify(result)});

			expect(result.used, `used .ui files`).to.not.be.empty;

			// TODO: make these true
			// expect(result.CompleteWriterSidebarCoverage, `complete writer sidebar coverage`).to.be.true;
		});
	});

	afterEach(function () {
		desktopHelper.undoAll();
		cy.cGet('div.clipboard').as('clipboard');
		// double click on field at initial cursor position
		ceHelper.moveCaret('home', 'ctrl');
	});

	it('PropertyDeck: Table Context', function () {
		helper.processToIdle(win);
		runA11yValidation(win);
	});

	it.skip('PropertyDeck: Graphic Context: (Buggy)', function () {
		helper.clearAllText();
		desktopHelper.insertImage();

		helper.processToIdle(win);
		runA11yValidation(win);
	});

	it('A11yCheckDeck', function() {
		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.A11yCheckDeck');
			helper.processToIdle(win);
		});

		cy.cGet('#updateLinkButton').click();

		helper.processToIdle(win);
		runA11yValidation(win);

		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.PropertyDeck');
			helper.processToIdle(win);
		});
	});

	it('WriterPageDeck', function() {
		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.WriterPageDeck');
			helper.processToIdle(win);
		});

		runA11yValidation(win);

		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.PropertyDeck');
			helper.processToIdle(win);
		});
	});

	it('StyleListDeck', function() {
		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.StyleListDeck');
			helper.processToIdle(win);
		});

		// Maybe we should click on every style-type toolbar button.
		runA11yValidation(win);

		cy.then(() => {
			win.app.map.sendUnoCommand('.uno:SidebarDeck.PropertyDeck');
			helper.processToIdle(win);
		});
	});

	function runA11yValidation(win) {
		helper.runA11yValidation(win, 'validatesidebara11y');
	}
});
