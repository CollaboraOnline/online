describe('Example test suit 2', function() {
  it('Example test case 1', function() {
    // Get a clean test document
    cy.task('copyFile', {
      source_dir: Cypress.env('DATA_FOLDER'),
      dest_dir: Cypress.env('WORKDIR'),
      file_name: 'simple.odt',
    });

    // Open test document
    cy.visit('http://localhost:9980/loleaflet/fc04ba550/loleaflet.html?file_path=file://' +
      Cypress.env('WORKDIR') + 'simple.odt')

    // Wait for the document to fully load
    cy.get('.leaflet-tile-loaded')

    // Select a text
    cy.get('#document-container').dblclick()
    cy.get(".leaflet-marker-icon")

    // Click on bold toolbar button
    cy.get('#tb_editbar_item_italic').click()

    // Remove selection and do a reselection
    cy.get('#document-container').click()
    cy.get('.leaflet-marker-icon').should('not.be.visible');

    cy.get('#document-container').dblclick()
    cy.get(".leaflet-marker-icon")

    // Bold toolbar button is checked
    cy.get('#tb_editbar_item_italic table.w2ui-button.checked')

    // Click on bold toolbar button
    cy.get('#tb_editbar_item_italic').click()
  })
})
