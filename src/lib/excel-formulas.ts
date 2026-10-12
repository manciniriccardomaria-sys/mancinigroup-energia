/** Evaluates only the scalar formulas present in the supplied fixed-price workbook.
 * No eval, macros, external references or formula execution outside the cell map.
 */
export type ExcelValue = number | string | boolean | null;
export class ExcelFormulaError extends Error {
  constructor(public readonly code: string) { super(code); }
}
type CellMap = Record<string, Record<string, ExcelValue>>;
type Expression =
  | { kind: "literal"; value: ExcelValue }
  | { kind: "error"; code: string }
  | { kind: "reference"; sheet?: string; start: string; end?: string }
  | { kind: "call"; name: string; args: Expression[] }
  | { kind: "binary"; operator: string; left: Expression; right: Expression }
  | { kind: "unary"; operator: string; value: Expression };
type Result = ExcelValue | ExcelValue[][];

function parse(formula: string): Expression {
  const tokens = formula.slice(1).match(/"(?:[^"]|"")*"|#REF!|'(?:[^']|'')*'|\$?[A-Z]+\$?\d+|[A-Z_][A-Z_\d]*|\d+(?:\.\d+)?|<=|>=|<>|[+\-*/=<>(),!:]/gi) ?? [];
  let index = 0;
  function primary(): Expression {
    const token = tokens[index++];
    if (!token) throw new ExcelFormulaError("#VALUE!");
    if (token === "+" || token === "-") return { kind: "unary", operator: token, value: primary() };
    if (token === "(") {
      const value = expression(0);
      if (tokens[index++] !== ")") throw new ExcelFormulaError("#VALUE!");
      return value;
    }
    if (token.startsWith('"')) return { kind: "literal", value: token.slice(1, -1).replaceAll('""', '"') };
    if (token === "#REF!") return { kind: "error", code: token };
    if (/^\d/.test(token)) return { kind: "literal", value: Number(token) };
    if (tokens[index] === "(") {
      index++;
      const args: Expression[] = [];
      if (tokens[index] !== ")") {
        do { args.push(expression(0)); } while (tokens[index] === "," && index++);
      }
      if (tokens[index++] !== ")") throw new ExcelFormulaError("#VALUE!");
      return { kind: "call", name: token.toUpperCase(), args };
    }
    let sheet: string | undefined;
    let start = token;
    if (tokens[index] === "!") {
      index++;
      sheet = token.replace(/^'|'$/g, "").replaceAll("''", "'");
      start = tokens[index++];
    }
    if (!/^\$?[A-Z]+\$?\d+$/i.test(start)) throw new ExcelFormulaError("#NAME?");
    let end: string | undefined;
    if (tokens[index] === ":") { index++; end = tokens[index++].replaceAll("$", ""); }
    return { kind: "reference", sheet, start: start.replaceAll("$", ""), end };
  }
  const priority: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "+": 2, "-": 2, "*": 3, "/": 3 };
  function expression(minimum: number): Expression {
    let left = primary();
    while ((priority[tokens[index]] ?? 0) > minimum) {
      const operator = tokens[index++];
      left = { kind: "binary", operator, left, right: expression(priority[operator]) };
    }
    return left;
  }
  const result = expression(0);
  if (index !== tokens.length) throw new ExcelFormulaError("#VALUE!");
  return result;
}

function numeric(value: Result): number {
  if (Array.isArray(value)) throw new ExcelFormulaError("#VALUE!");
  if (value === null) return 0;
  if (value === "") throw new ExcelFormulaError("#VALUE!");
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "number") return value;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new ExcelFormulaError("#VALUE!");
  return number;
}
function compare(left: Result, right: Result) {
  if (Array.isArray(left) || Array.isArray(right)) throw new ExcelFormulaError("#VALUE!");
  const a = left ?? (typeof right === "string" ? "" : 0);
  const b = right ?? (typeof left === "string" ? "" : 0);
  const rank = (value: ExcelValue) => typeof value === "boolean" ? 2 : typeof value === "string" ? 1 : 0;
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string" && typeof b === "string") {
    const x = a.toUpperCase(), y = b.toUpperCase();
    return x === y ? 0 : x < y ? -1 : 1;
  }
  return numeric(a) - numeric(b);
}

export function excelModel(sheets: CellMap, overrides: CellMap = {}) {
  const cache = new Map<string, ExcelValue>();
  const visiting = new Set<string>();
  function cell(sheet: string, address: string): ExcelValue {
    const key = `${sheet}!${address}`;
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) throw new ExcelFormulaError("#REF!");
    if (!sheets[sheet]) throw new ExcelFormulaError("#REF!");
    visiting.add(key);
    try {
      const value = Object.hasOwn(overrides[sheet] ?? {}, address) ? overrides[sheet][address] : sheets[sheet][address] ?? null;
      const formula = typeof value === "string" && value.startsWith("=");
      const calculated = formula ? evaluate(parse(value), sheet) : value;
      const evaluated = formula && calculated === null ? 0 : calculated;
      if (Array.isArray(evaluated)) throw new ExcelFormulaError("#VALUE!");
      cache.set(key, evaluated);
      return evaluated;
    } finally { visiting.delete(key); }
  }
  function range(sheet: string, start: string, end: string): ExcelValue[][] {
    const columnNumber = (name: string) => [...name].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
    const columnName = (number: number): string => number > 26 ? columnName(Math.floor((number - 1) / 26)) + String.fromCharCode((number - 1) % 26 + 65) : String.fromCharCode(number + 64);
    const a = start.match(/^([A-Z]+)(\d+)$/)!, b = end.match(/^([A-Z]+)(\d+)$/)!;
    return Array.from({ length: Number(b[2]) - Number(a[2]) + 1 }, (_, row) =>
      Array.from({ length: columnNumber(b[1]) - columnNumber(a[1]) + 1 }, (_, column) => cell(sheet, `${columnName(columnNumber(a[1]) + column)}${Number(a[2]) + row}`)));
  }
  function evaluate(node: Expression, sheet: string): Result {
    if (node.kind === "literal") return node.value;
    if (node.kind === "error") throw new ExcelFormulaError(node.code);
    if (node.kind === "reference") return node.end ? range(node.sheet ?? sheet, node.start, node.end) : cell(node.sheet ?? sheet, node.start);
    if (node.kind === "unary") return numeric(evaluate(node.value, sheet)) * (node.operator === "-" ? -1 : 1);
    if (node.kind === "binary") {
      const left = evaluate(node.left, sheet), right = evaluate(node.right, sheet);
      switch (node.operator) {
        case "+": return numeric(left) + numeric(right);
        case "-": return numeric(left) - numeric(right);
        case "*": return numeric(left) * numeric(right);
        case "/": if (numeric(right) === 0) throw new ExcelFormulaError("#DIV/0!"); return numeric(left) / numeric(right);
        case "=": return compare(left, right) === 0;
        case "<>": return compare(left, right) !== 0;
        case "<": return compare(left, right) < 0;
        case ">": return compare(left, right) > 0;
        case "<=": return compare(left, right) <= 0;
        case ">=": return compare(left, right) >= 0;
      }
    }
    if (node.kind === "call") {
      if (node.name === "IF") {
        const condition = evaluate(node.args[0], sheet);
        return evaluate(node.args[condition ? 1 : 2], sheet);
      }
      if (node.name === "FALSE") return false;
      const args = node.args.map((arg) => evaluate(arg, sheet));
      const values = args.flat(2) as ExcelValue[];
      if (node.name === "COUNTA") return values.filter((value) => value !== null).length;
      if (node.name === "SUM") return values.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
      if (node.name === "AVERAGE") {
        const numbers = values.filter((value): value is number => typeof value === "number");
        if (!numbers.length) throw new ExcelFormulaError("#DIV/0!");
        return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
      }
      if (node.name === "VLOOKUP") {
        if (!Array.isArray(args[1]) || args[3] !== false) throw new ExcelFormulaError("#VALUE!");
        const row = args[1].find((row) => compare(row[0], args[0]) === 0);
        if (!row) throw new ExcelFormulaError("#N/A");
        const index = numeric(args[2]) - 1;
        if (index < 0 || index >= row.length) throw new ExcelFormulaError("#REF!");
        return row[index] ?? 0;
      }
    }
    throw new ExcelFormulaError("#NAME?");
  }
  return {
    value: cell,
    number(sheet: string, address: string) {
      const result = numeric(cell(sheet, address));
      if (!Number.isFinite(result)) throw new ExcelFormulaError("#NUM!");
      return result;
    }
  };
}
