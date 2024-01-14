import { Map } from 'immutable'
import * as moment from 'moment'
import { PDFJS } from 'pdfjs-dist'
import { CollectionHelper } from '../helpers/collection-helper'
import { NumberHelper } from '../helpers/number-helper'
import { PromiseHelper } from '../helpers/promise-helper'
import { Line } from './Line'
import { FilesParser } from './files-parser'
import { Operation } from './operation'
import { OperationsAndErrors } from './operations-and-errors'

enum PdfFormat {
  WITH_FRANCS,
  WITHOUT_FRANCS
}

interface XRange {
  credit: [number, number];
  debit: [number, number];
}

class PdfFormatRanges {
  static getXRanges(pdfFormat: PdfFormat): XRange {
    if (pdfFormat === PdfFormat.WITHOUT_FRANCS) {
      return {
        credit: [504, 562],
        debit: [439, 491],
      }
    } else {
      return {
        credit: [400, 442],
        debit: [335, 371],
      }
    }
  }
}

export class PdfParser {
  private static readonly operationXPositions = [52.559999999999995, 53.519999999999996, 53.76, 52.8]
  private static readonly operationXPositions2 = [85.92, 89.28, 86.16]
  private static readonly operationRegex = /^([0-9]{2}\/[0-9]{2})(.+?(?:[0-9]{7})?(?:\/[0-9]{4})?) ([ 0-9+-]+?,[0-9]{2})/
  private static readonly blacklist = /^(?:date| touche)/
  private static readonly yearLineRegex = /[Aa]ncien solde au.+?([0-9]{4})/
  private static readonly withFrancsFormatMarker = 'en francs'

  static async parseFiles(files: File[], progressCallback: (progress: number) => void): Promise<OperationsAndErrors> {
    PdfParser.configPdfJs()
    return await FilesParser.parseFiles(files, progressCallback, PdfParser.operationsFromFile)
  }

  private static configPdfJs() {
    PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    // true means no web worker is used, and everything is done on the UI thread
    // PDFJS.disableWorker = true
  }

  private static async operationsFromFile(file: File): Promise<Operation[]> {
    const fileContents = await PromiseHelper.fileReaderAsArrayBufferP(file)
    const pdfDocument = await PDFJS.getDocument(new Uint8Array(fileContents))
    const [lines, xRanges] = await PdfParser.linesFromDocument(pdfDocument)
    const yearLine = lines.find(line => line.text.match(PdfParser.yearLineRegex) !== null)
    const year = yearLine.text.match(PdfParser.yearLineRegex)[1]
    const operationLines = lines.filter(PdfParser.looksLikeOperationLine)
    return PdfParser.operationsFromLines(operationLines, year, xRanges)
  }

  private static async linesFromDocument(pdfDocument: PDFDocumentProxy): Promise<[Line[], XRange]> {
    const [pdfItems, pdfFormat] = await this.extractItemsAndFormat(pdfDocument)
    return [
      this.extractLines(pdfItems),
      PdfFormatRanges.getXRanges(pdfFormat)
    ];
  }

  private static extractLines<T>(pdfItems: T[]) {
    return pdfItems
      .reduce((linesByY: Map<number, Line>, item: any): Map<number, Line> => {
        const line = {text: item.str, x: item.transform[4], y: item.transform[5], lastX: item.transform[4]}
        const lineAtY = linesByY.get(line.y)
        if (lineAtY === undefined) {
          return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y, lastX: line.x})
        } else {
          return linesByY.set(line.y, Object.assign(lineAtY, {text: lineAtY.text + line.text, lastX: line.x}))
        }
      }, Map<number, Line>())
      .sortBy((line, y) => -y)
      .toArray()
  }

  private static async extractItemsAndFormat<T>(pdfDocument: PDFDocumentProxy): Promise<[T[], PdfFormat]> {
    let pdfFormat = PdfFormat.WITHOUT_FRANCS
    const pdfItems = (await CollectionHelper.reduce(pdfDocument, (items, item: any) => {
      items.push(item)
      if (item.str.indexOf(this.withFrancsFormatMarker) !== -1) {
        pdfFormat = PdfFormat.WITH_FRANCS
      }
      return items
    }, []))
    return [pdfItems, pdfFormat]
  }

  private static looksLikeOperationLine(line: Line): boolean {
    console.debug(line, line.x);
    return (PdfParser.operationXPositions.includes(line.x) && line.text.match(PdfParser.operationRegex) !== null)
      || (PdfParser.operationXPositions2.includes(line.x) && !line.text.match(PdfParser.blacklist))
  }

  private static operationsFromLines(lines: Line[], year: string, xRanges: XRange): Operation[] {
    const debitRanges = xRanges.debit;
    return lines.reduce((operations: Operation[], line: Line) => {
      const matches = line.text.match(PdfParser.operationRegex)
      if (matches) {
        const isDebit = line.lastX >= debitRanges[0] && line.lastX <= debitRanges[1];
        operations.push({
          date: moment(matches[1] + '/' + year, 'DD/MM/YYYY'),
          description: matches[2],
          amount: NumberHelper.parseNumber(matches[3], ',') * (isDebit ? -1 : 1),
        })
      } else if (operations.length > 0) {
        operations[operations.length - 1].description += '\n' + line.text
      }
      return operations
    }, [])
  }
}
