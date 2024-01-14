import * as FileSaver from 'file-saver'
import { Operation } from './operation'

export class CsvWriter {
  public static readonly columnSeparator = ';'
  public static readonly columnDelimiter = '"'

  static async write(operations: Operation[]) {
    const blob = new Blob([CsvWriter.toCsvRows(operations)], { type: 'text/plain;charset=utf-8' })
    await FileSaver.saveAs(blob, 'operations.csv')
  }

  private static toCsvRows(operations: Operation[]): string {
    // HomeBank-compatible format
    // http://homebank.free.fr/help/misc-csvformat.html
    return 'date;paymode;info;payee;memo;amount;category;tags\n'
      + operations.reduce((result, operation) => {
        return result + [
          operation.date.format('MM/DD/YYYY'), // date
          this.detectPaymentType(operation.description), // payment type, here bank transfer or debit card
          '', // info
          '', // payee
          operation.description.replace(/"/g, '\"').replace(/\n/g, ' '), // memo
          operation.amount, // amount
          '', // category
          '', // tags
        ].join(CsvWriter.columnSeparator) + '\n'
      }, '')
  }

  private static detectPaymentType(description: string) {
    const uppercaseDescription = description.toUpperCase();
    if (uppercaseDescription.includes('VIREMENT')) {
      return 4; // bank tranfer
    }
    if (uppercaseDescription.includes('RETRAIT')) {
      return 3; // cash
    }
    if (uppercaseDescription.includes('PRELEVEMENT')) {
      return 8; // electronic payment
    }
    if (uppercaseDescription.includes('VIREMENT PERMANENT')) {
      return 9; // deposit
    }
    if (uppercaseDescription.includes('COMMISSION')
      || uppercaseDescription.includes('AVANTAGE TARIFAIRE')
      || uppercaseDescription.includes('REMISE COMMERCIALE')
      || uppercaseDescription.includes('MINIMUM FORFAITAIRE')) {
      return 0; // none
    }
    return 6; // debit card
  }
}
