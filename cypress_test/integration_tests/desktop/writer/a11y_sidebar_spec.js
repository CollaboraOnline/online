/* global describe expect it cy before after afterEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var a11yHelper = require('../../common/a11y_helper');

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
			a11yHelper.enableUICoverage(win);
		});

		// Show sidebar again after UICoverage tracking is enabled
		desktopHelper.sidebarToggle();
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');

		cy.cGet('.jsdialog-window').should('not.exist');
	});

	after(function () {
		a11yHelper.reportUICoverage(win);

		cy.get('@uicoverageResult').then(result => {
			expect(result.used, `used .ui files`).to.not.be.empty;
			// TODO: make this true
			// expect(result.CompleteWriterSidebarCoverage, `complete writer sidebar coverage`).to.be.true;
		});
	});

	afterEach(function () {
		a11yHelper.resetState();
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

		cy.cGet('.A11yCheckIssuesPanel .ui-linkbutton').click();

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
		a11yHelper.runA11yValidation(win, 'validatesidebara11y');
	}
});
