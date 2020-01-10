describe('Example test suit 1', function() {
  it('Example test case 1', function() {
    // Open test documnt
    cy.viewport('iphone-3')
    cy.visit('http://localhost:9980/loleaflet/fc04ba550/loleaflet.html?file_path=file:///home/zolnai/libreoffice/online/test/data/hello-world.odt')

    // Wait for the document to fully load (TODO: find an item which we can be used to wait for instead)
    cy.wait(1000)

    // Mobile wizard toolbar button is disabled by default
    cy.get('#tb_actionbar_item_mobile_wizard')
      .should('have.class', 'disabled')

    // Click on edit button
    cy.get('#mobile-edit-button').click()

    // Mobile wizard should be enabled now
    cy.get('#tb_actionbar_item_mobile_wizard')
      .should('not.have.class', 'disabled')
  })
})
