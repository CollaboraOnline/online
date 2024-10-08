/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var { selectZoomLevel } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {

	beforeEach(function() {
		cy.viewport(1400, 600);
		helper.setupAndLoadDocument('writer/annotation.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');
	});

	it('Insert', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item', 'Remove').click();
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
	});

});

describe(['tagdesktop'], 'Collapsed Annotation Tests', function() {
	var newFilePath;

	beforeEach(function() {
		newFilePath = helper.setupAndLoadDocument('writer/annotation.odt');
		desktopHelper.switchUIToNotebookbar();

		// TODO: skip sidebar detection on reload
		// cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
	});

	it('Insert', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
	});

	it('Autosave Collapse', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		helper.typeIntoDocument('{home}');
		cy.cGet('.cool-annotation-info-collapsed').should('have.text','!');
		cy.cGet('.cool-annotation-info-collapsed').should('be.visible');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		helper.typeIntoDocument('{home}');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-info-collapsed').should('not.have.text','!');
		cy.cGet('#map').focus();
		helper.typeIntoDocument('{home}');
		cy.cGet('.cool-annotation-info-collapsed').should('be.not.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // show sidebar.
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-info-collapsed').should('be.not.visible');
	})

});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var newFilePath;

	beforeEach(function() {
		cy.viewport(1400, 600);
		newFilePath = helper.setupAndLoadDocument('writer/annotation.odt');
		desktopHelper.switchUIToNotebookbar();
		// TODO: skip sidebar detection on reload
		//cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');
	});

	it('Insert autosave', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave save', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave cancel', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#comment-container-1').should('not.exist');
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Modify autosave', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
	});

	it('Modify autosave save', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
	});

	it('Modify autosave cancel', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Reply autosave', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');
	});

	it('Reply autosave save', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('have.text','some reply text');
		cy.cGet('#annotation-save-2').click();
		cy.cGet('#annotation-modify-textarea-2').should('be.not.visible');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');
	});

	it('Reply autosave cancel', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('have.text','some reply text');
		cy.cGet('#annotation-cancel-2').click();
		cy.cGet('#annotation-modify-textarea-2').should('not.exist');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('not.exist');
		cy.cGet('#comment-container-1 .cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#comment-container-2 .cool-annotation-autosavelabel').should('not.exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('not.exist');
	});
});

describe(['tagdesktop'], 'Annotation with @mention', function() {
	beforeEach(function() {
		cy.viewport(1400, 600);
		helper.setupAndLoadDocument('writer/annotation.odt');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		desktopHelper.switchUIToNotebookbar();
		selectZoomLevel('50');
	});

	it('Insert comment with mention', function() {
		desktopHelper.insertComment('some text0', false);
		
		cy.cGet('.cool-annotation').find('#annotation-modify-textarea-new').type(' @Ale');
		cy.cGet('#mentionPopup').should('be.visible');
		cy.cGet('#mentionPopupList li.jsdialog:nth-child(1)').type('{enter}');
		
		cy.cGet('#annotation-modify-textarea-new a').should('exist');
		cy.cGet('#annotation-modify-textarea-new a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-modify-textarea-new a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-modify-textarea-new').should('have.text','some text0 @Alexandra');

		cy.cGet('#annotation-save-new').click();
		
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1 a').should('exist');
		cy.cGet('#annotation-content-area-1 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-content-area-1 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0 @Alexandra');
	});

	it('Modify comment by adding mention', function () {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain', 'some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();

		cy.cGet('#annotation-modify-textarea-1').type('{end}');
		cy.cGet('#annotation-modify-textarea-1').type(' @Ale');
		cy.cGet('#mentionPopup').should('be.visible');
		cy.cGet('#mentionPopupList li.jsdialog:nth-child(1)').type('{enter}');

		cy.cGet('#annotation-modify-textarea-1 a').should('exist');
		cy.cGet('#annotation-modify-textarea-1 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-modify-textarea-1 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-modify-textarea-1').should('have.text', 'some text0 @Alexandra');

		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');

		cy.cGet('#annotation-content-area-1 a').should('exist');
		cy.cGet('#annotation-content-area-1 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-content-area-1 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-content-area-1').should('have.text', 'some text0 @Alexandra');
	})

	it('Reply to parent comment by adding mention', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();

		cy.cGet('#annotation-reply-textarea-1').type('some reply text @Ale');

		cy.cGet('#mentionPopup').should('be.visible');
		cy.cGet('#mentionPopupList li.jsdialog:nth-child(1)').type('{enter}');

		cy.cGet('#annotation-reply-textarea-1 a').should('exist');
		cy.cGet('#annotation-reply-textarea-1 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-reply-textarea-1 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-reply-textarea-1').should('have.text', 'some reply text @Alexandra');

		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text @Alexandra');
	});

	it('Reply to reply comment by adding mention', function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();

		cy.cGet('#annotation-reply-textarea-1').type('some reply text @Ale');

		cy.cGet('#mentionPopup').should('be.visible');
		cy.cGet('#mentionPopupList li.jsdialog:nth-child(1)').type('{enter}');

		cy.cGet('#annotation-reply-textarea-1 a').should('exist');
		cy.cGet('#annotation-reply-textarea-1 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-reply-textarea-1 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-reply-textarea-1').should('have.text', 'some reply text @Alexandra');

		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text @Alexandra');

		cy.cGet('#comment-annotation-menu-2').should('exist').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-2').type('some reply to reply text @Ale');

		cy.cGet('#mentionPopup').should('be.visible');
		cy.cGet('#mentionPopupList li.jsdialog:nth-child(1)').type('{enter}');

		cy.cGet('#annotation-reply-textarea-2 a').should('exist');
		cy.cGet('#annotation-reply-textarea-2 a').should('have.text', '@Alexandra');
		cy.cGet('#annotation-reply-textarea-2 a').should('have.attr', 'href', 'https://github.com/CollaboraOnline/online');
		cy.cGet('#annotation-reply-textarea-2').should('have.text', 'some reply to reply text @Alexandra');

		cy.cGet('#annotation-reply-2').click();
		cy.cGet('#annotation-content-area-3').should('contain','some reply to reply text @Alexandra');
	});

	it('Escape should close the mentionPopup, comment should be in focus', function() {
		desktopHelper.insertComment('some text0', false);

		cy.cGet('.cool-annotation').find('#annotation-modify-textarea-new').type(' @Ale');
		cy.cGet('#mentionPopup').should('be.visible');
		helper.typeIntoDocument('{esc}');

		cy.cGet('#mentionPopup').should('not.exist');
		cy.cGet('#annotation-modify-textarea-new').should('have.focus');
	});
});
