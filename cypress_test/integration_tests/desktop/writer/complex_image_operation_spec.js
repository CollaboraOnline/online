/* global cy expect describe it require afterEach beforeEach */

var helper = require('../../common/helper');

describe('Complex image operation test', function() {
	var origTestFileName = 'complex_image_operation.odt';
	var testFileName;

	beforeEach(function() {
		localStorage.setItem('image_validation_test', true);
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('tile image validation test',function() {
		cy.window().then(win => {
			if (win.imgDatas) {
				for (var i = 0; i < win.imgDatas.length; ++i) {
					var canvas = win.document.createElement('canvas');
					var context = canvas.getContext('2d');
					var img = new Image();

					img.onerror = function() {
						cy.contains('Tile is not valid').should('not.exist');
					};

					img.onload = function() {
						context.drawImage(img, 0, 0);
						var pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;
						var allIsWhite = true;
						for (var i = 0; i < pixelData.length; ++i) {
							allIsWhite = allIsWhite && pixelData[i] == 255;
						}
						expect(allIsWhite).to.be.false;
					};
					img.src = win.imgDatas[i];
				}
			}

		});
	});
});
