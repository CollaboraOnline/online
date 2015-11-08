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

                // dummy initial row header
                var row = L.DomUtil.create('tr', '', this._rows);
                L.DomUtil.create('th','spreadsheet-table-row-cell', row);

                return document.createElement('div');
        },

        clearRows: function () {
                L.DomUtil.remove(this._rows);
                this._rows = L.DomUtil.create('tbody', '', this._table);
        },

        offsetRow: function (value) {
                L.DomUtil.setStyle(this._table, 'top', value + 'px');
        },

        fillRows: function (rows, converter, context) {
                var iterator, twip, height, row, cell;

                this.clearRows();
                for (iterator = 0; iterator < rows.length; iterator++) {
                        twip = new L.Point(parseInt(rows[iterator].size),
                                           parseInt(rows[iterator].size));
                        height =  Math.round(converter.call(context, twip).y) - 2;
                        row  = L.DomUtil.create('tr', '', this._rows);
                        cell = L.DomUtil.create('th', 'spreadsheet-table-row-cell', row);
                        cell.innerHTML  = rows[iterator].text;
                        cell.twipHeight = rows[iterator].size;
                        cell.height = height + "px";
                }
        },

        updateRows: function (converter, context) {
                var iterator, twip, height, row;

                for (iterator = 0; iterator < this._rows.childNodes.length; iterator++) {
                        row  = this._rows.childNodes[iterator].firstChild;
                        twip = new L.Point(parseInt(row.twipHeight),
                                           parseInt(row.twipHeight));
                        height =  Math.round(converter.call(context, twip).y) - 1;
                        row.height = height + "px";
                }
        }
})

L.control.rowHeader = function (options) {
        return new L.Control.RowHeader(options);
};
