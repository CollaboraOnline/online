/*
 * L.Control.RowHeader
*/

L.Control.RowHeader = L.Control.extend({
        onAdd: function (map) {
                var docContainer = L.DomUtil.get('document-container');
                var divRowHeader = L.DomUtil.create('div', 'spreadsheet-container-row', docContainer.parentElement);
                var divRowInner = L.DomUtil.create('div', 'spreadsheet-container-row-inner', divRowHeader);
                this._table = L.DomUtil.create('table', '', divRowInner);
                this._table.id = 'spreadsheet-table-row';
                this._rows = L.DomUtil.create('tbody', '', this._table);

                this._position = 0;

                // dummy initial row header
                var row = L.DomUtil.create('tr', '', this._rows);
                L.DomUtil.create('th','spreadsheet-table-row-cell', row);

                return document.createElement('div');
        },

        clearRows: function () {
                L.DomUtil.remove(this._rows);
                this._rows = L.DomUtil.create('tbody', '', this._table);
        },

        setScrollPosition: function (position) {
                this._position = position;
                L.DomUtil.setStyle(this._table, 'top', this._position + 'px');
        },

        offsetScrollPosition: function (offset) {
                this._position = this._position - offset;
                L.DomUtil.setStyle(this._table, 'top', this._position + 'px');
        },

        fillRows: function (rows, converter, context) {
                var iterator, twip, height, row, cell;

                this.clearRows();
                var totalHeight = -1;
                for (iterator = 0; iterator < rows.length; iterator++) {
                        twip = new L.Point(parseInt(rows[iterator].size),
                                           parseInt(rows[iterator].size));
                        height =  Math.round(converter.call(context, twip).y) - 2 - totalHeight;
                        row  = L.DomUtil.create('tr', '', this._rows);
                        cell = L.DomUtil.create('th', 'spreadsheet-table-row-cell', row);
                        cell.innerHTML  = rows[iterator].text;
                        cell.twipHeight = rows[iterator].size;
                        cell.height = height + "px";
                        totalHeight += height + 1;
                }
        },

        updateRows: function (converter, context) {
                var iterator, twip, height, row;

                var totalHeight = -1;
                for (iterator = 0; iterator < this._rows.childNodes.length; iterator++) {
                        row  = this._rows.childNodes[iterator].firstChild;
                        twip = new L.Point(parseInt(row.twipHeight),
                                           parseInt(row.twipHeight));
                        height =  Math.round(converter.call(context, twip).y) - 2 - totalHeight;
                        row.height = height + "px";
                        totalHeight += height + 1;
                }
        }
})

L.control.rowHeader = function (options) {
        return new L.Control.RowHeader(options);
};
