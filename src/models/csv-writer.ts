import * as FileSaver from 'file-saver'
import {Operation} from './operation'

export class CsvWriter {
  public static readonly columnSeparator = ';'
  public static readonly columnDelimiter = '"'

  static async write(operations: Operation[]) {
    const blob = new Blob([CsvWriter.toCsvRows(operations)], {type: 'text/plain;charset=utf-8'})
    await FileSaver.saveAs(blob, 'operations.csv')
  }

  private static toCsvRows(operations: Operation[]): string {
    // HomeBank-compatible format
    return 'date;paymode;info;payee;memo;amount;category;tags\n'
      + operations.reduce((result, operation) => {
      return result + [
        operation.date.format('MM/DD/YYYY'), // date
        operation.description.toUpperCase().includes('VIREMENT') ? 4 : 6, // payment type, here bank transfer or debit card
        '', // info
        '', // payee
        operation.description.replace(/"/g, '\"').replace(/\n/g, ' '), // memo
        operation.amount, // amount
        '', // category
        '', // tags
      ].join(CsvWriter.columnSeparator) + '\n'
    }, '')
  }
}
