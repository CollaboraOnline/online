describe('Toolbar tests', function() {
  beforeEach(function() {
    // Open test documnt
    cy.viewport('iphone-3')
    cy.visit('http://localhost:9980/loleaflet/fc04ba550/loleaflet.html?file_path=file:///home/zolnai/libreoffice/online/test/data/hello-world.odt')

    // Wait for the document to fully load (TODO: find an item which we can be used to wait for instead)
    cy.wait(1000)
  });

  it('State of mobile wizard toolbar item.', function() {
    // Mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_mobile_wizard')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Button should be enabled now
    cy.get('#tb_actionbar_item_mobile_wizard')
      .should('not.have.class', 'disabled')
  })

  it('State of insertion mobile wizard toolbar item.', function() {
    // Insertion mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_insertion_mobile_wizard')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Button should be enabled now
    cy.get('#tb_actionbar_item_insertion_mobile_wizard')
      .should('not.have.class', 'disabled')
  })

  it('State of insert comment toolbar item.', function() {
    // Insertion mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_insertcomment')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Button should be enabled now
    cy.get('#tb_actionbar_item_insertcomment')
      .should('not.have.class', 'disabled')
  })

  it('State of undo toolbar item.', function() {
    // Insertion mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_undo')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Button should be still disabled
    cy.get('#tb_actionbar_item_undo')
      .should('have.class', 'disabled')

    // Type somthing in the document
    cy.get('#document-container').type("x")

    // Button should become enabled
    cy.get('#tb_actionbar_item_undo')
      .should('not.have.class', 'disabled')
  })

  it('State of redo toolbar item.', function() {
    // Insertion mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_redo')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Button should be still disabled
    cy.get('#tb_actionbar_item_redo')
      .should('have.class', 'disabled')

    // Type somthing in the document
    cy.get('#document-container').type("x")

    // Button should be still disabled
    cy.get('#tb_actionbar_item_redo')
      .should('have.class', 'disabled')

    // Do an undo
    cy.get('#tb_actionbar_item_undo')
      .should('not.have.class', 'disabled')
    cy.get('#tb_actionbar_item_undo').click()

    // Button should become enabled
    cy.get('#tb_actionbar_item_redo')
      .should('not.have.class', 'disabled')
  })
})
