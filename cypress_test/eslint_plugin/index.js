/* -*- js-indent-level: 8 -*- */
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
		},
		'no-get-invoke-match-chain': {
			/**
			* Catches cy.get(selector).invoke('text').should('match',...) calls in the code.
			*
			* Issue: In cypress test framework only the last getter command is retried.
			* In this case it's the invoke method and so the get() method is
			* not retried. Sometimes, it behaves unexpectedly, because the test
			* retries to call the text method on an element, which might be removed
			* in the meantime. Instead of searching for a new element matching both
			* with the selector and the regular expression.
			*
			* Fix: We can use cy.contains(seletor, regexp) method instead.
			* This is a compact command which will retry to match both the
			* selector and the text matcher.
			*
			**/
			create: function(context) {
				return {
					'CallExpression[callee.property.name=\'should\'][callee.object.callee.property.name=\'invoke\'][callee.object.callee.object.callee.property.name=\'get\']': function(expr) {
						if (expr.arguments && expr.arguments.length === 2 && expr.arguments[0].value === 'match' &&
							expr.callee.object.arguments &&
							expr.callee.object.arguments.length === 1 &&
							expr.callee.object.arguments[0].value === 'text') {
							context.report(expr, 'Do not use this long chain for matching text. Use cy.contains(selector, regexp) instead for better retriability!');
						}
					}
				};
			}
		}
	}
};
