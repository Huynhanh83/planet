import { Injectable } from '@angular/core';
import { ExportToCsv } from 'export-to-csv/build';

@Injectable({
  providedIn: 'root'
})
export class CsvService {

  default = {
    showLabels: true,
    useKeysAsHeaders: true
  };

  constructor() {}

  private generate(data, options?) {
    if (data.length > 0) {
      new ExportToCsv({ ...this.default, ...options }).generateCsv(data);
    }
  }

  exportCSV({ data, title }: { data: any[], title: string }) {
    const options = { title, filename: `Report of ${title} on ${new Date().toDateString()}`, showTitle: true };
    const formattedData = data.map(({ _id, _rev, resourceId, type, createdOn, parentCode, ...dataToDisplay }) =>
      Object.entries(dataToDisplay).reduce((object, [ key, value ]: [ string, any ]) => ({
        ...object,
        [key]: key.toLowerCase().indexOf('time') === -1 ? value : new Date(value).toString()
      }), {}
    ));
    this.generate(formattedData, options);
  }

  exportSummaryCSV(charts: any[], planetName: string) {
    const options = {
      title: `Summary report for ${planetName}`,
      filename: `Report of ${planetName} on ${new Date().toDateString()}`,
      showTitle: true,
      showLabels: false,
      useKeysAsHeaders: false
    };
    const chartLabels = (chart, header: boolean) => chart.data.datasets[0].data.reduce(
      (csvObj, { x: label }) => ({ ...csvObj, [label]: header ? label : '' }),
      {}
    );
    const formattedData = charts.reduce((exportData, chart) => {
      return [ ...exportData, { label: chart.config.options.title.text, ...chartLabels(chart, true) }, chart.data.datasets.map(dataset =>
        ({
          label: dataset.label,
          ...dataset.data.reduce((csvObj, { x: label, y: number }) => ({ ...csvObj, [label]: number }), {})
        })
      ), { label: '', ...chartLabels(chart, false) } ];
    }, []).flat();
    this.generate(formattedData, options);
  }

}
