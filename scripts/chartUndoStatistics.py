#!/usr/bin/env python3
# -*- tab-width: 4; indent-tabs-mode: nil; py-indent-offset: 4 -*-
#
# Copyright the Collabora Online contributors.
#
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

from lxml import etree

def update_fods_data(input_file, output_file):
    # Define namespaces
    NSMAP = {
        "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        "chart": "urn:oasis:names:tc:opendocument:xmlns:chart:1.0",
        "draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    }

    SHEET_CHART_MAPPING = {
        "Command_Transitions": "none",
        "Viewer_Editor_Stats": "bar",
        "Undo_Command_Stats": "bar",
        "Total_Users_Per_Document": "bar",
    }

    tree = etree.parse(input_file)
    root = tree.getroot()

    for sheet in root.findall(".//table:table", namespaces=NSMAP):
        sheet_name = sheet.get(f"{{{NSMAP['table']}}}name")

        if sheet_name is None:
            raise ValueError(f"Sheet '{sheet_name}' has no name, Skipping.")
            continue

        chart_type = SHEET_CHART_MAPPING.get(sheet_name, "bar")
        if chart_type == "none":
            removeDrawFrameForSheet(root, sheet_name, NSMAP)
            continue

        rows = sheet.findall("table:table-row", namespaces=NSMAP)

        # Skip empty sheets
        if not rows:
            print(f"No rows found in sheet '{sheet_name}', Skipping.")
            continue

        first_row_cells = rows[0].findall("table:table-cell", namespaces=NSMAP)
        num_rows = len(rows) - 1
        num_cols = len(first_row_cells) - 1

        update_chart_references(root, sheet_name, num_rows, num_cols, NSMAP, chart_type)

    # Write updated tree to output file
    with open(output_file, "wb") as f:
        f.write(etree.tostring(tree, pretty_print=True, xml_declaration=True, encoding="UTF-8"))

    print(f"File '{output_file}' successfully created!")

def update_chart_references(root, sheet_name, num_rows, num_cols, NSMAP, chart_type):
    # Find table/sheet by name
    table = root.find(f".//table:table[@table:name='{sheet_name}']", namespaces=NSMAP)
    if table is None:
        raise ValueError(f"Could not find table for sheet '{sheet_name}'")

    first_row = table.find("table:table-row", namespaces=NSMAP)
    first_cell = first_row.find("table:table-cell", namespaces=NSMAP)

    categories_range = f"{sheet_name}.A2:A{num_rows + 1}"
    first_value = None
    if first_row is not None and first_cell is not None:
        first_value = first_cell.find(".//text:p", namespaces=NSMAP)

    if first_value is not None and first_value.text:
        categories_range = None
        num_cols += 1

    data_range = f"{sheet_name}.B2{chr(65 + num_cols)}{num_rows + 1}"

    chart = table.find(".//office:chart", namespaces=NSMAP)
    if chart is None:
        raise ValueError(f"Could not find chart for sheet '{sheet_name}'")

    plot_area = chart.find(".//chart:plot-area", namespaces=NSMAP)
    if plot_area is None:
        raise ValueError(f"Could not find plot-area in the chart for sheet '{sheet_name}'")

    plot_area.set(f"{{{NSMAP['table']}}}cell-range-address", data_range)
    plot_area.set(f"{{{NSMAP['chart']}}}data-source-has-labels", "row")
    plot_area.set(f"{{{NSMAP['chart']}}}class", f"chart:{chart_type}")

    categories_axis = plot_area.find(".//chart:axis[@chart:dimension='x']", namespaces=NSMAP)
    if categories_axis is not None:
        categories = categories_axis.find(".//chart:categories", namespaces=NSMAP)
        if categories_range is not None:
            categories.set(f"{{{NSMAP['table']}}}cell-range-address", categories_range)
        else:
            categories_axis.remove(categories)

    # Remove old series and add new series
    old_series = plot_area.findall(".//chart:series", namespaces=NSMAP)
    for series in old_series:
        series.getparent().remove(series)

    # If there's no categories range (column A is part of the data), column A is included in series
    skipColA = 0 if categories_range is None else 1

    for cols in range(0, num_cols):
        col = chr(65 + cols + skipColA)
        series_range = f"{sheet_name}.{col}2:{sheet_name}.{col}{num_rows + 1}"
        labels_range = f"{sheet_name}.{col}1:{sheet_name}.{col}1"

        # Create new series element
        series = etree.SubElement(plot_area, f"{{{NSMAP['chart']}}}series")
        series.set(f"{{{NSMAP['chart']}}}style-name", f"ch{str(cols + 10)}")
        series.set(f"{{{NSMAP['chart']}}}values-cell-range-address", series_range)
        series.set(f"{{{NSMAP['chart']}}}label-cell-address", labels_range)
        series.set(f"{{{NSMAP['chart']}}}class", f"chart:{chart_type}")

        # Add data-point element to series
        data_point = etree.SubElement(series, f"{{{NSMAP['chart']}}}data-point")
        data_point.set(f"{{{NSMAP['chart']}}}repeated", str(num_rows))

def removeDrawFrameForSheet(root, sheet_name, NSMAP):
    sheet = root.find(f".//table:table[@table:name='{sheet_name}']", namespaces=NSMAP)

    for draw_frame in sheet.findall(".//draw:frame", namespaces=NSMAP):
        draw_frame.getparent().remove(draw_frame)

if __name__ == "__main__":
  update_fods_data(
            input_file="../test/data/updated-chart.fods",
            output_file="../test/data/updated-chart.fods",
        )