/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType = 'VAR' | 'NOT' | 'AND' | 'OR' | 'CONST';

export interface BooleanNode {
  type: NodeType;
  name?: 'A' | 'B' | 'C';
  value?: boolean;
  child?: BooleanNode;
  left?: BooleanNode;
  right?: BooleanNode;
}

export class BooleanEngine {
  static parse(expression: string): BooleanNode {
    const tokens = expression.replace(/\s+/g, '').split(/([ABC+.*'()!])|/).filter(Boolean);
    let pos = 0;

    const parseExpression = (): BooleanNode => {
      let node = parseTerm();
      while (pos < tokens.length && tokens[pos] === '+') {
        pos++;
        node = { type: 'OR', left: node, right: parseTerm() };
      }
      return node;
    };

    const parseTerm = (): BooleanNode => {
      let node = parseFactor();
      while (pos < tokens.length && (tokens[pos] === '.' || tokens[pos] === '*')) {
        pos++;
        node = { type: 'AND', left: node, right: parseFactor() };
      }
      return node;
    };

    const parseFactor = (): BooleanNode => {
      let node: BooleanNode;
      let isNegated = false;
      
      if (pos < tokens.length && tokens[pos] === '!') {
        pos++;
        isNegated = true;
      }

      const token = tokens[pos++];
      if (token === '(') {
        node = parseExpression();
        if (tokens[pos++] !== ')') throw new Error('Missing closing parenthesis');
      } else if (token === 'A' || token === 'B' || token === 'C') {
        node = { type: 'VAR', name: token as 'A' | 'B' | 'C' };
      } else if (token === '1') {
        node = { type: 'CONST', value: true };
      } else if (token === '0') {
        node = { type: 'CONST', value: false };
      } else {
        throw new Error(`Unexpected token: ${token}`);
      }

      if (isNegated) {
        node = { type: 'NOT', child: node };
      }

      while (pos < tokens.length && tokens[pos] === "'") {
        pos++;
        node = { type: 'NOT', child: node };
      }
      return node;
    };

    return parseExpression();
  }

  static evaluate(node: BooleanNode, a: boolean, b: boolean, c: boolean): boolean {
    switch (node.type) {
      case 'VAR':
        if (node.name === 'A') return a;
        if (node.name === 'B') return b;
        if (node.name === 'C') return c;
        return false;
      case 'NOT':
        return !this.evaluate(node.child!, a, b, c);
      case 'AND':
        return this.evaluate(node.left!, a, b, c) && this.evaluate(node.right!, a, b, c);
      case 'OR':
        return this.evaluate(node.left!, a, b, c) || this.evaluate(node.right!, a, b, c);
      case 'CONST':
        return node.value!;
      default:
        return false;
    }
  }

  static getTruthTable(node: BooleanNode): boolean[] {
    const table: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      const a = !!(i & 4);
      const b = !!(i & 2);
      const c = !!(i & 1);
      table.push(this.evaluate(node, a, b, c));
    }
    return table;
  }

  static isPositiveMonotonic(table: boolean[]): boolean {
    for (let i = 0; i < 8; i++) {
      const a = (i >> 2) & 1;
      const b = (i >> 1) & 1;
      const c = i & 1;

      // Check A: 0 -> 1
      if (a === 0) {
        const next = i | 4;
        if (table[i] && !table[next]) return false;
      }
      // Check B: 0 -> 1
      if (b === 0) {
        const next = i | 2;
        if (table[i] && !table[next]) return false;
      }
      // Check C: 0 -> 1
      if (c === 0) {
        const next = i | 1;
        if (table[i] && !table[next]) return false;
      }
    }
    return true;
  }

  static getPositiveSOP(table: boolean[]): BooleanNode {
    const trueIndices = table.map((v, i) => v ? i : -1).filter(i => i !== -1);
    if (trueIndices.length === 0) return { type: 'CONST', value: false };
    if (trueIndices.length === 8) return { type: 'CONST', value: true };

    // Find prime implicants using only positive literals (1 and -)
    const primes = this.findPrimeImplicants(trueIndices).filter(p => !p.includes('0'));
    const essential = this.findEssentialPrimeImplicants(primes, trueIndices);

    return this.implicantsToNode(essential);
  }

  static stringify(node: BooleanNode): string {
    switch (node.type) {
      case 'VAR': return node.name!;
      case 'NOT': 
        if (node.child?.type === 'VAR') return `${node.child.name}'`;
        return `(${this.stringify(node.child!)})'`;
      case 'AND': return `${this.stringify(node.left!)} . ${this.stringify(node.right!)}`;
      case 'OR': return `${this.stringify(node.left!)} + ${this.stringify(node.right!)}`;
      case 'CONST': return node.value ? '1' : '0';
      default: return '';
    }
  }

  // Improved simplification logic using Truth Table and Prime Implicants
  static simplify(node: BooleanNode): { node: BooleanNode, steps: string[] } {
    const table = this.getTruthTable(node);
    const trueIndices = table.map((v, i) => v ? i : -1).filter(i => i !== -1).sort((a, b) => a - b);
    
    if (trueIndices.length === 0) return { node: { type: 'CONST', value: false }, steps: ["Expression evaluates to constant 0"] };
    if (trueIndices.length === 8) return { node: { type: 'CONST', value: true }, steps: ["Expression evaluates to constant 1"] };

    const steps: string[] = [];
    steps.push(`Minterm Expansion: Σm(${trueIndices.join(', ')})`);

    // Find prime implicants for 3 variables
    const primeImplicants = this.findPrimeImplicants(trueIndices);
    steps.push(`Prime Implicants: ${primeImplicants.map(p => this.implicantToString(p)).join(', ')}`);

    const essential = this.findEssentialPrimeImplicants(primeImplicants, trueIndices);
    if (essential.length < primeImplicants.length) {
      steps.push(`Essential Prime Implicants: ${essential.map(p => this.implicantToString(p)).join(', ')}`);
    }

    const simplifiedNode = this.implicantsToNode(essential);
    steps.push(`Final Reduced Form: ${this.stringify(simplifiedNode)}`);

    return { node: simplifiedNode, steps };
  }

  private static implicantToString(p: string): string {
    let parts: string[] = [];
    if (p[0] !== '-') parts.push(p[0] === '1' ? 'A' : "A'");
    if (p[1] !== '-') parts.push(p[1] === '1' ? 'B' : "B'");
    if (p[2] !== '-') parts.push(p[2] === '1' ? 'C' : "C'");
    if (parts.length === 0) return "1";
    return parts.join('.');
  }

  private static findPrimeImplicants(minterms: number[]): string[] {
    let groups: string[][] = [[], [], [], []];
    minterms.forEach(m => {
      const bin = m.toString(2).padStart(3, '0');
      const ones = (bin.match(/1/g) || []).length;
      groups[ones].push(bin);
    });

    let allPrimes = new Set<string>();
    let combined = new Set<string>();

    const combine = (g1: string[], g2: string[]) => {
      let next: string[] = [];
      for (const s1 of g1) {
        let s1Used = false;
        for (const s2 of g2) {
          let diffs = 0;
          let res = "";
          for (let i = 0; i < 3; i++) {
            if (s1[i] !== s2[i]) {
              diffs++;
              res += "-";
            } else {
              res += s1[i];
            }
          }
          if (diffs === 1) {
            next.push(res);
            combined.add(s1);
            combined.add(s2);
            s1Used = true;
          }
        }
      }
      return next;
    };

    // Level 1 to 2
    let level2: string[][] = [[], [], []];
    for (let i = 0; i < 3; i++) {
      level2[i] = combine(groups[i], groups[i+1]);
    }

    // Level 2 to 3
    let level3: string[][] = [[], []];
    for (let i = 0; i < 2; i++) {
      level3[i] = combine(level2[i], level2[i+1]);
    }

    // Collect all that were never combined
    const check = (list: string[]) => {
      list.forEach(s => {
        if (!combined.has(s)) allPrimes.add(s);
      });
    };

    groups.forEach(check);
    level2.forEach(check);
    level3.forEach(check);

    return Array.from(allPrimes);
  }

  private static findEssentialPrimeImplicants(primes: string[], minterms: number[]): string[] {
    // For 3 variables, we can just pick a minimal set that covers all minterms
    // This is a simple greedy approach which is usually fine for 3 variables
    let remaining = new Set(minterms);
    let result: string[] = [];
    
    while (remaining.size > 0) {
      let bestPrime = "";
      let bestCover = -1;
      
      for (const p of primes) {
        let cover = 0;
        for (const m of remaining) {
          if (this.implicantCovers(p, m)) cover++;
        }
        if (cover > bestCover) {
          bestCover = cover;
          bestPrime = p;
        }
      }
      
      if (bestPrime) {
        result.push(bestPrime);
        for (const m of Array.from(remaining)) {
          if (this.implicantCovers(bestPrime, m)) remaining.delete(m);
        }
      } else break;
    }
    
    return result;
  }

  private static implicantCovers(prime: string, minterm: number): boolean {
    const bin = minterm.toString(2).padStart(3, '0');
    for (let i = 0; i < 3; i++) {
      if (prime[i] !== '-' && prime[i] !== bin[i]) return false;
    }
    return true;
  }

  private static implicantsToNode(primes: string[]): BooleanNode {
    const terms = primes.map(p => {
      let nodes: BooleanNode[] = [];
      if (p[0] !== '-') nodes.push(p[0] === '1' ? { type: 'VAR', name: 'A' } : { type: 'NOT', child: { type: 'VAR', name: 'A' } });
      if (p[1] !== '-') nodes.push(p[1] === '1' ? { type: 'VAR', name: 'B' } : { type: 'NOT', child: { type: 'VAR', name: 'B' } });
      if (p[2] !== '-') nodes.push(p[2] === '1' ? { type: 'VAR', name: 'C' } : { type: 'NOT', child: { type: 'VAR', name: 'C' } });
      
      if (nodes.length === 0) return { type: 'CONST', value: true } as BooleanNode;
      return nodes.reduce((acc, curr) => ({ type: 'AND', left: acc, right: curr } as BooleanNode));
    });

    return terms.reduce((acc, curr) => ({ type: 'OR', left: acc, right: curr } as BooleanNode));
  }
}
