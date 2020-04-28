module.exports = {
	rules: {
		'no-get-contains-chain': {
			/**
			* Catches cy.get(selector).contains(content) calls in the code.
			*
			* Issue: In cypress test framework only the last command is retried.
			* In this case it's the contains method and so the get() method is
			* not retried. Sometimes, it behaves unexpectedly, because the DOM
			* has the correct item matching with both the selector and the content,
			* but the test still fails on this command chain.
			*
			* Fix 1: When we use the content as a selector. In this case, we can use
			* cy.contains(selector, content) instead. This is compact command which
			* will retry to match both the selector and the content.
			*
			* Fix 2: When we need an assertion about the content. In this case, we can
			* use cy.contains(selector, content) or cy.get(selector).should('have.text', content)
			* is also a good replacement.
			*
			**/
			create: function(context) {
				return {
					'CallExpression[callee.property.name=\'contains\'][callee.object.callee.property.name=\'get\']': function(node) {
						context.report(node, 'Do not chain get() and contains(). Use cy.contains(selector, content) instead for better retriability!');
					}
				};
			}
		}
	}
};
