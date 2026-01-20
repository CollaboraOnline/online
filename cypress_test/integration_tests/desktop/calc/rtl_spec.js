/* -*- js-indent-level: 8 -*- */

/* global describe it require beforeEach */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'RTL sheet tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/rtl-load.ods');
	});

	it('RTL sheet load', function() {
		// just load...
	});
});

/* vim:set shiftwidth=8 softtabstop=8 noexpandtab: */
