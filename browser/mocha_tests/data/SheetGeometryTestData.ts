import { Bounds } from '../../src/geometry/Bounds';
import { Point } from '../../src/geometry/Point';
import { DimensionPosSize, CellRange, GroupData, SheetGeometryCoreData } from '../../src/layer/tile/SheetGeometry';

export interface PosSizeTestData {
    rowIndex: number,
    possize: DimensionPosSize
}

export interface PointUnitCoversionTest {
    zoomScale?: number;
    inputPoint: Point;
    outputPoint: Point;
}

export interface AreaUnitConversionTest {
    zoomScale?: number;
    inputArea: Bounds;
    outputArea: Bounds;
}

export interface SizeInAllUnitsTest {
    corePixels: Point;
    tileTwips: Point;
    printTwips: Point;
}

export interface CellTest {
    col: number;
    row: number;
    zoomScale: number;
    cpixBoundsAtZoom: Bounds;
    cpixBoundsAtSelfZoom: Bounds;
}

export interface PartTestData {
    part: number,
    description: string,

    viewCellArea: CellRange;
    rowData: PosSizeTestData;

    colGroupLevels: number;
    rowGroupLevels: number;
    colGroupsInView: GroupData[];
    rowGroupsInView: GroupData[];

    tileTwipsAtZoom: PointUnitCoversionTest;
    printTwipsToTile: PointUnitCoversionTest;
    printTwipsSheetAreatoTile: AreaUnitConversionTest;

    sheetSize: SizeInAllUnitsTest;

    cellRectData: CellTest;

    sheetgeometrymsg: SheetGeometryCoreData;
};

export interface TestDataForZoom {
    zoom: number;
    viewBoundsTwips: Bounds;
    partsTestData: PartTestData[];
}

export type TestData = TestDataForZoom[];

export var sheetGeometryMessageObjects: SheetGeometryCoreData[] = [
    // part 0
    {
        commandName: ".uno:SheetGeometryData",
        maxtiledcolumn: "1023",
        maxtiledrow: "500000",
        columns: {
            sizes: "1280:0 1470:1 1280:5 1755:6 1280:7 2145:8 2655:9 1280:22 2025:23 1280:1023 ",
            hidden: "0:1023 ",
            filtered: "0:1023 ",
            groups: ""
        },
        rows: {
            sizes: "256:6 583:7 256:10 264:11 256:13 450:14 256:19 1485:20 256:1048575 ",
            hidden: "0:1048575 ",
            filtered: "0:1048575 ",
            groups: ""
        }
    },

    // part 1
    {
        commandName: ".uno:SheetGeometryData",
        maxtiledcolumn: "1023",
        maxtiledrow: "500000",
        columns: {
            sizes: "1280:9 2640:10 1280:1023 ",
            hidden: "0:1023 ",
            filtered: "0:1023 ",
            groups: ""
        },
        rows: {
            sizes: "256:8 1245:9 256:37 585:38 1155:39 256:79 1470:80 256:1048575 ",
            hidden: "0:21 22 1048575 ",
            filtered: "0:1048575 ",
            groups: ""
        }
    },

    // part 2
    {
        commandName: ".uno:SheetGeometryData",
        maxtiledcolumn: "1023",
        maxtiledrow: "500000",
        columns: {
            sizes: "1280:0 2070:1 1695:2 1280:1023 ",
            hidden: "0:1023 ",
            filtered: "0:1023 ",
            groups: ""
        },
        rows: {
            sizes: "256:1048575 ",
            hidden: "0:3 5 6 9 1048575 ",
            filtered: "0:3 5 6 9 1048575 ",
            groups: ""
        }
    },

    // part 3
    {
        commandName: ".uno:SheetGeometryData",
        maxtiledcolumn: "1023",
        maxtiledrow: "500000",
        columns: {
            sizes: "1280:1023 ",
            hidden: "0:1023 ",
            filtered: "0:1023 ",
            groups: ""
        },
        rows: {
            sizes: "256:1048575 ",
            hidden: "0:16 20 1048575 ",
            filtered: "0:1048575 ",
            groups: "10:14:0:1, 13:9:0:1, 17:4:1:1, "
        }
    },

];

export var testDataForZoom10: PartTestData[] = [

    // 0. Varying row/column sizes
    {
        part: 0,
        description: 'Varying row/column sizes',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 19,
            },
            rowrange: {
                start: 0,
                end: 37,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 728,
                size: 17
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39974, 17002),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39885, 17202),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39375, 17040),
                new Point(44475, 21885)),
        },

        sheetSize: {
            corePixels: new Point(87285, 8500133),
            tileTwips: new Point(1309275, 127501995),
            printTwips: new Point(1314370, 128002014),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2272, 104741),
                new Point(2374, 104761),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1895, 89026),
                new Point(1980, 89043),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[0],
    },

    // 1. Hidden rows
    {
        part: 1,
        description: 'Hidden rows',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 20,
            },
            rowrange: {
                start: 0,
                end: 39,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 661,
                size: 17
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39997, 16977),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39855, 17225),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39615, 17010),
                new Point(44715, 21855)),
        },

        sheetSize: {
            corePixels: new Point(87131, 8500229),
            tileTwips: new Point(1306965, 127503435),
            printTwips: new Point(1312080, 128003431),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2149, 104854),
                new Point(2251, 104874),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1791, 89122),
                new Point(1876, 89139),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[1],
    },

    // 2. Filtered rows
    {
        part: 2,
        description: 'Filtered rows',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 20,
            },
            rowrange: {
                start: 0,
                end: 48,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 527,
                size: 17
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39984, 16945),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39860, 17213),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39465, 17085),
                new Point(44565, 21930)),
        },

        sheetSize: {
            corePixels: new Point(87121, 8499932),
            tileTwips: new Point(1306815, 127498980),
            printTwips: new Point(1311925, 127998976),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2136, 104500),
                new Point(2238, 104520),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1781, 88825),
                new Point(1866, 88842),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[2],
    },

    // 3. Row groups
    {
        part: 3,
        description: 'Row groups',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 21,
            },
            rowrange: {
                start: 0,
                end: 47,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 544,
                size: 17
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 3,
        colGroupsInView: [],
        rowGroupsInView: [
            {
                "endPos": "289",
                "hidden": "1",
                "index": "0",
                "level": "3",
                "startPos": "289",
            },
            {
                "endPos": "306",
                "hidden": "0",
                "index": "0",
                "level": "2",
                "startPos": "221",
            },
            {
                "endPos": "340",
                "hidden": "0",
                "index": "0",
                "level": "1",
                "startPos": "170",
            }
        ],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(40000, 16945),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39845, 17213),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39525, 17085),
                new Point(44625, 21930)),
        },

        sheetSize: {
            corePixels: new Point(87040, 8499949),
            tileTwips: new Point(1305600, 127499235),
            printTwips: new Point(1310720, 127999232),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2040, 104520),
                new Point(2142, 104540),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1700, 88842),
                new Point(1785, 88859),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[3],
    },
];

export var testDataForZoom7: PartTestData[] = [

    // 0. Varying row/column sizes
    {
        part: 0,
        description: 'Varying row/column sizes',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 19,
            },
            rowrange: {
                start: 0,
                end: 40,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 394,
                size: 9
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(40156, 18330),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39703, 15974),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39193, 15812),
                new Point(44274, 20244)),
        },

        sheetSize: {
            corePixels: new Point(50316, 4500079),
            tileTwips: new Point(1304284, 116650485),
            printTwips: new Point(1314370, 128002014),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2272, 104741),
                new Point(2374, 104761),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1091, 47140),
                new Point(1140, 47149),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[0],
    },

    // 1. Hidden rows
    {
        part: 1,
        description: 'Hidden rows',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 20,
            },
            rowrange: {
                start: 0,
                end: 39,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 354,
                size: 9
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(40159, 18306),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39693, 16001),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39453, 15786),
                new Point(44533, 20218)),
        },

        sheetSize: {
            corePixels: new Point(50228, 4500134),
            tileTwips: new Point(1302003, 116651910),
            printTwips: new Point(1312080, 128003431),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2149, 104854),
                new Point(2251, 104874),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1032, 47195),
                new Point(1081, 47204),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[1],
    },

    // 2. Filtered rows
    {
        part: 2,
        description: 'Filtered rows',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 20,
            },
            rowrange: {
                start: 0,
                end: 52,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 279,
                size: 9
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 0,
        colGroupsInView: [],
        rowGroupsInView: [],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(40152, 18517),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39692, 15758),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39297, 15630),
                new Point(44378, 20063)),
        },

        sheetSize: {
            corePixels: new Point(50222, 4499964),
            tileTwips: new Point(1301848, 116647504),
            printTwips: new Point(1311925, 127998976),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2136, 104500),
                new Point(2238, 104520),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(1026, 47025),
                new Point(1075, 47034),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[2],
    },

    // 3. Row groups
    {
        part: 3,
        description: 'Row groups',
        viewCellArea: {
            columnrange: {
                start: 0,
                end: 21,
            },
            rowrange: {
                start: 0,
                end: 51,
            }
        },

        rowData: {
            rowIndex: 36, // Input
            possize: {
                startpos: 288,
                size: 9
            }
        },

        colGroupLevels: 0,
        rowGroupLevels: 3,
        colGroupsInView: [],
        rowGroupsInView: [
            {
                "endPos": "153",
                "hidden": "1",
                "index": "0",
                "level": "3",
                "startPos": "153",
            },
            {
                "endPos": "162",
                "hidden": "0",
                "index": "0",
                "level": "2",
                "startPos": "117",
            },
            {
                "endPos": "180",
                "hidden": "0",
                "index": "0",
                "level": "1",
                "startPos": "90",
            }
        ],

        tileTwipsAtZoom: {
            zoomScale: 1.2,
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(40150, 18517),
        },
        printTwipsToTile: {
            inputPoint: new Point(40000, 17280),
            outputPoint: new Point(39695, 15758),
        },
        printTwipsSheetAreatoTile: {
            inputArea: new Bounds(
                new Point(40000, 17280),
                new Point(44500, 21780)),
            outputArea: new Bounds(
                new Point(39375, 15630),
                new Point(44455, 20063)),
        },

        sheetSize: {
            corePixels: new Point(50176, 4499973),
            tileTwips: new Point(1300655, 116647737),
            printTwips: new Point(1310720, 127999232),
        },

        cellRectData: {
            col: 20,
            row: 5230,
            zoomScale: 1.2,
            cpixBoundsAtZoom: new Bounds(
                new Point(2040, 104520),
                new Point(2142, 104540),
            ),
            cpixBoundsAtSelfZoom: new Bounds(
                new Point(980, 47034),
                new Point(1029, 47043),
            ),
        },

        sheetgeometrymsg: sheetGeometryMessageObjects[3],
    },

];

export var testData: TestData = [
    {
        zoom: 10,
        viewBoundsTwips: new Bounds(
            new Point(0, 0),
            new Point(27240, 11190)),

        partsTestData: testDataForZoom10,
    },

    {
        zoom: 7,
        viewBoundsTwips: new Bounds(
            new Point(0, 0),
            new Point(27240, 11190)
        ),

        partsTestData: testDataForZoom7,
    }
];
