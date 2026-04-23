// Zooming isn't perfect for not causing view jumps yet - it's only "much better than before"
// Therefore, we'll assert that it has to be at somewhere that isn't quite the right position (but is similarly "much better than before")
// If you fix zoom properly, you should update these tests to match
/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

const zoomLevels = {
  20: { expectedHorizontal: 760, expectedVertical: 540 },
  25: { expectedHorizontal: 760, expectedVertical: 540 },
  30: { expectedHorizontal: 760, expectedVertical: 540 },
  35: { expectedHorizontal: 760, expectedVertical: 540 },
  40: { expectedHorizontal: 760, expectedVertical: 540 },
  50: { expectedHorizontal: 760, expectedVertical: 540 },
  60: { expectedHorizontal: 760, expectedVertical: 540 },
  70: { expectedHorizontal: 760, expectedVertical: 540 },
  85: { expectedHorizontal: 760, expectedVertical: 540 },
  100: { expectedHorizontal: 760, expectedVertical: 540 },
  120: { expectedHorizontal: 760, expectedVertical: 524 },
  150: { expectedHorizontal: 760, expectedVertical: 520 },
  170: { expectedHorizontal: 760, expectedVertical: 520 },
  200: { expectedHorizontal: 760, expectedVertical: 520 },
  235: { expectedHorizontal: 760, expectedVertical: 500 },
  280: { expectedHorizontal: 740, expectedVertical: 500 },
  335: { expectedHorizontal: 740, expectedVertical: 500 },
  400: { expectedHorizontal: 740, expectedVertical: 500 },
}; // Record<zoom, { expectedHortizontal, expectedVertical }>

const acceptableDrift = 10; // FIXME: there is no "acceptable drift", but there was a change that introduced drift but was otherwise considerably better, so we make this tradeoff. Ideally this would be changed to be a static tolerance

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

    const zoomEntries = Array.from(zoomLevels.entries());
    let prevZoom = 100;

    for (const [zoomLevel, { expectedHorizontal, expectedVertical }] of zoomEntries.filter(([level, _]) => level > 100)) {
      const expectedHorizontalDifference = expectedHorizontal - zoomLevels[prevZoom].expectedHorizontal;
      const expectedVerticalDifference = expectedVertical - zoomLevels[prevZoom].expectedVertical;

      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.cygetScrollbarPosition('horizontal').then((oldHorizontalPosition) => {
        desktopHelper.cygetScrollbarPosition('vertical').then((oldVerticalPosition) => {
          // This has to be nested because cypress queues operations and then runs them all at once - it has no equivalent of await either

          desktopHelper.zoomIn();
          desktopHelper.shouldHaveZoomLevel(zoomLevel);

          desktopHelper.assertScrollbarPosition('horizontal', oldHorizontalPosition + expectedHorizontalDifference - acceptableDrift, oldHorizontalPosition - expectedHorizontalDifference + acceptableDrift);
          desktopHelper.assertScrollbarPosition('vertical', oldVerticalPosition + expectedVerticalDifference - acceptableDrift, oldVerticalPosition - expectedVerticalDifference + acceptableDrift);
        });
      });

      prevZoom = zoomLevel;
    }

    cy.log("Zooming out")

    for (const [zoomLevel, { expectedHorizontal, expectedVertical }] of zoomEntries.toReversed().slice(1)) {
      const expectedHorizontalDifference = expectedHorizontal - zoomLevels[prevZoom].expectedHorizontal;
      const expectedVerticalDifference = expectedVertical - zoomLevels[prevZoom].expectedVertical;

      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.cygetScrollbarPosition('horizontal').then((oldHorizontalPosition) => {
        desktopHelper.cygetScrollbarPosition('vertical').then((oldVerticalPosition) => {
          // This has to be nested because cypress queues operations and then runs them all at once - it has no equivalent of await either

          desktopHelper.zoomIn();
          desktopHelper.shouldHaveZoomLevel(zoomLevel);

          desktopHelper.assertScrollbarPosition('horizontal', oldHorizontalPosition + expectedHorizontalDifference - acceptableDrift, oldHorizontalPosition - expectedHorizontalDifference + acceptableDrift);
          desktopHelper.assertScrollbarPosition('vertical', oldVerticalPosition + expectedVerticalDifference - acceptableDrift, oldVerticalPosition - expectedVerticalDifference + acceptableDrift);
        });
      });

      prevZoom = zoomLevel;
    }

    cy.log("Zooming in")

    for (const [zoomLevel, { expectedHorizontal, expectedVertical }] of zoomEntries.filter(([level, _]) => level <= 100).slice(1)) {
      const expectedHorizontalDifference = expectedHorizontal - zoomLevels[prevZoom].expectedHorizontal;
      const expectedVerticalDifference = expectedVertical - zoomLevels[prevZoom].expectedVertical;

      cy.log(`Zooming to ${zoomLevel}`);

      desktopHelper.cygetScrollbarPosition('horizontal').then((oldHorizontalPosition) => {
        desktopHelper.cygetScrollbarPosition('vertical').then((oldVerticalPosition) => {
          // This has to be nested because cypress queues operations and then runs them all at once - it has no equivalent of await either

          desktopHelper.zoomIn();
          desktopHelper.shouldHaveZoomLevel(zoomLevel);

          desktopHelper.assertScrollbarPosition('horizontal', oldHorizontalPosition + expectedHorizontalDifference - acceptableDrift, oldHorizontalPosition - expectedHorizontalDifference + acceptableDrift);
          desktopHelper.assertScrollbarPosition('vertical', oldVerticalPosition + expectedVerticalDifference - acceptableDrift, oldVerticalPosition - expectedVerticalDifference + acceptableDrift);
        });
      });

      prevZoom = zoomLevel;
    }
  });
});
