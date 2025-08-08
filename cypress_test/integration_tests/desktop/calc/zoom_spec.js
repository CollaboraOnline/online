// Zooming isn't perfect for not causing view jumps yet - it's only "much better than before"
// Therefore, we'll assert that it has to be at somewhere that isn't quite the right position (but is similarly "much better than before")
// If you fix zoom properly, you should update these tests to match
/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

const zoomLevels = [
  [20, 760, 540],
  [25, 760, 540],
  [30, 760, 540],
  [35, 760, 540],
  [40, 760, 540],
  [50, 760, 540],
  [60, 760, 540],
  [70, 760, 540],
  [85, 760, 540],
  [100, 760, 540],
  [120, 760, 524],
  [150, 760, 520],
  [170, 760, 520],
  [200, 760, 520],
  [235, 760, 500],
  [280, 740, 500],
  [335, 740, 500],
  [400, 740, 500],
]; // Array<[zoom, expectedHorizontal, expectedVertical]>

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test jumping on large cell selectionTest zooming on cells far away from the top left', function() {
  beforeEach(function() {
    helper.setupAndLoadDocument('calc/cell_cursor.ods');
    desktopHelper.switchUIToCompact();
    cy.cGet('#toolbar-up .ui-scroll-right').click();
    cy.cGet('#sidebar').click({ force: true });
  });

  it("doesn't jump when zooming at a high cell index", function() {
    helper.typeIntoInputField(helper.addressInputSelector, 'SKY3665');

    desktopHelper.assertScrollbarPosition('horizontal', 540, 560);
    desktopHelper.assertScrollbarPosition('vertical', 360, 380);

    desktopHelper.zoomIn();

    desktopHelper.assertScrollbarPosition('horizontal', 540, 560);
    desktopHelper.assertScrollbarPosition('vertical', 360, 380);

    desktopHelper.zoomOut();

    desktopHelper.assertScrollbarPosition('horizontal', 540, 560);
    desktopHelper.assertScrollbarPosition('vertical', 360, 380);
  });

  it("doesn't jump even when zooming a long way", function() {
    helper.typeIntoInputField(helper.addressInputSelector, 'SKY3665');

    desktopHelper.assertScrollbarPosition('horizontal', 520, 560);
    desktopHelper.assertScrollbarPosition('vertical', 320, 380);

    desktopHelper.selectZoomLevel(20);

    desktopHelper.assertScrollbarPosition('horizontal', 520, 560);
    desktopHelper.assertScrollbarPosition('vertical', 320, 380);

    desktopHelper.selectZoomLevel(400);

    desktopHelper.assertScrollbarPosition('horizontal', 520, 560);
    desktopHelper.assertScrollbarPosition('vertical', 320, 380);

    desktopHelper.selectZoomLevel(100);

    desktopHelper.assertScrollbarPosition('horizontal', 520, 560);
    desktopHelper.assertScrollbarPosition('vertical', 320, 380);
  });

  it("doesn't lose precision on repeated zooms", function() {
    helper.typeIntoInputField(helper.addressInputSelector, 'SKY3665');

    desktopHelper.assertScrollbarPosition('horizontal', 740, 770);
    desktopHelper.assertScrollbarPosition('vertical', 450, 540);

    cy.log("Zooming in")

    for (const [zoomLevel, horizontal, vertical] of zoomLevels.filter(([level, _, __]) => level > 100)) {
      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.zoomIn();

      desktopHelper.shouldHaveZoomLevel(zoomLevel);

      desktopHelper.assertScrollbarPosition('horizontal', horizontal - 10, horizontal + 10);
      desktopHelper.assertScrollbarPosition('vertical', vertical - 10, vertical + 10);
    }

    cy.log("Zooming out")

    for (const [zoomLevel, horizontal, vertical] of zoomLevels.toReversed().slice(1)) {
      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.zoomOut();

      desktopHelper.shouldHaveZoomLevel(zoomLevel);

      desktopHelper.assertScrollbarPosition('horizontal', horizontal - 10, horizontal + 10);
      desktopHelper.assertScrollbarPosition('vertical', vertical - 10, vertical + 10);
    }

    cy.log("Zooming in")

    for (const [zoomLevel, horizontal, vertical] of zoomLevels.filter(([level, _, __]) => level <= 100).slice(1)) {
      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.zoomIn();

      desktopHelper.shouldHaveZoomLevel(zoomLevel);

      desktopHelper.assertScrollbarPosition('horizontal', horizontal - 10, horizontal + 10);
      desktopHelper.assertScrollbarPosition('vertical', vertical - 10, vertical + 10);
    }
  });
});
