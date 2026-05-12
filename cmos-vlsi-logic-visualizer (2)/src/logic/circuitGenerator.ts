/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BooleanNode, BooleanEngine } from './booleanEngine';

export interface Transistor {
  id: string;
  type: 'PMOS' | 'NMOS';
  gate: string;
  source: string;
  drain: string;
}

export interface Circuit {
  transistors: Transistor[];
  nodes: string[];
  outputNode: string;
  hasInverter: boolean;
  coreExpression: string;
  finalEquation: string;
}

export type LogicBlock = 
  | { type: 'TRANSISTOR'; transistor: Transistor }
  | { type: 'SERIES'; children: LogicBlock[] }
  | { type: 'PARALLEL'; children: LogicBlock[] };

export interface Circuit {
  pun: LogicBlock;
  pdn: LogicBlock;
  transistors: Transistor[];
  nodes: string[];
  outputNode: string;
  hasInverter: boolean;
  coreNode: BooleanNode;
  coreExpression: string;
  finalEquation: string;
  inverters: { input: string; output: string; transistors: Transistor[] }[];
}

export class CircuitGenerator {
  private static nodeCounter = 0;

  private static getNextNode(): string {
    return `n${this.nodeCounter++}`;
  }

  static generate(node: BooleanNode): Circuit {
    this.nodeCounter = 0;
    
    // Constant logic case
    if (node.type === 'CONST') {
      return {
        pun: { type: 'SERIES', children: [] },
        pdn: { type: 'SERIES', children: [] },
        transistors: [],
        nodes: ['Y', node.value ? 'VDD' : 'GND'],
        outputNode: 'Y',
        hasInverter: false,
        coreNode: node,
        coreExpression: node.value ? '1' : '0',
        finalEquation: `Y = ${BooleanEngine.stringify(node)}`,
        inverters: []
      };
    }

    const table = BooleanEngine.getTruthTable(node);
    const invTable = table.map(v => !v);

    let coreNode: BooleanNode;
    let needsInverter = false;

    // 1. Try to implement as single stage: Y = (f)'
    // This requires f = Y' to be positive monotonic.
    if (BooleanEngine.isPositiveMonotonic(invTable)) {
      coreNode = BooleanEngine.getPositiveSOP(invTable);
      needsInverter = false;
    } 
    // 2. Try to implement as two stages: Y = ((f)')'
    // This requires f = Y to be positive monotonic.
    else if (BooleanEngine.isPositiveMonotonic(table)) {
      coreNode = BooleanEngine.getPositiveSOP(table);
      needsInverter = true;
    }
    // 3. Fallback to current logic (binate functions)
    else {
      if (node.type === 'NOT') {
        coreNode = node.child!;
        needsInverter = false;
      } else {
        coreNode = node;
        needsInverter = true;
      }
    }

    const gateOutput = needsInverter ? 'out_gate' : 'Y';
    
    // Build blocks and assign nodes
    const pun = this.buildPUNBlock(coreNode);
    const pdn = this.buildPDNBlock(coreNode);
    
    this.assignNodes(pun, 'VDD', gateOutput);
    this.assignNodes(pdn, gateOutput, 'GND');
    
    const inverters: { input: string; output: string; transistors: Transistor[] }[] = [];
    let finalOutput = gateOutput;

    if (needsInverter) {
      const invOut = 'Y';
      const invTrans: Transistor[] = [];
      this.addInverter(gateOutput, invOut, invTrans);
      inverters.push({ input: gateOutput, output: invOut, transistors: invTrans });
      finalOutput = invOut;
    }

    const allTransistors = [...this.flattenBlock(pun), ...this.flattenBlock(pdn), ...inverters.flatMap(i => i.transistors)];

    return {
      pun,
      pdn,
      transistors: allTransistors,
      nodes: Array.from(new Set(allTransistors.flatMap(t => [t.source, t.drain]))),
      outputNode: finalOutput,
      hasInverter: needsInverter,
      coreNode,
      coreExpression: BooleanEngine.stringify(coreNode),
      finalEquation: `Y = ${BooleanEngine.stringify(node)}`,
      inverters
    };
  }

  private static assignNodes(block: LogicBlock, top: string, bottom: string) {
    if (block.type === 'TRANSISTOR') {
      block.transistor.source = top;
      block.transistor.drain = bottom;
    } else if (block.type === 'SERIES') {
      let currentTop = top;
      for (let i = 0; i < block.children.length; i++) {
        const nextTop = (i === block.children.length - 1) ? bottom : this.getNextNode();
        this.assignNodes(block.children[i], currentTop, nextTop);
        currentTop = nextTop;
      }
    } else if (block.type === 'PARALLEL') {
      for (const child of block.children) {
        this.assignNodes(child, top, bottom);
      }
    }
  }

  private static buildPDNBlock(node: BooleanNode): LogicBlock {
    if (node.type === 'VAR' || node.type === 'NOT') {
      return {
        type: 'TRANSISTOR',
        transistor: {
          id: `MN_${this.nodeCounter++}`,
          type: 'NMOS',
          gate: BooleanEngine.stringify(node),
          source: '',
          drain: ''
        }
      };
    }
    if (node.type === 'AND') {
      return {
        type: 'SERIES',
        children: [this.buildPDNBlock(node.left!), this.buildPDNBlock(node.right!)]
      };
    }
    if (node.type === 'OR') {
      return {
        type: 'PARALLEL',
        children: [this.buildPDNBlock(node.left!), this.buildPDNBlock(node.right!)]
      };
    }
    return { type: 'SERIES', children: [] };
  }

  private static buildPUNBlock(node: BooleanNode): LogicBlock {
    if (node.type === 'VAR' || node.type === 'NOT') {
      return {
        type: 'TRANSISTOR',
        transistor: {
          id: `MP_${this.nodeCounter++}`,
          type: 'PMOS',
          gate: BooleanEngine.stringify(node),
          source: '',
          drain: ''
        }
      };
    }
    if (node.type === 'AND') {
      // Dual of AND is parallel in PMOS
      return {
        type: 'PARALLEL',
        children: [this.buildPUNBlock(node.left!), this.buildPUNBlock(node.right!)]
      };
    }
    if (node.type === 'OR') {
      // Dual of OR is series in PMOS
      return {
        type: 'SERIES',
        children: [this.buildPUNBlock(node.left!), this.buildPUNBlock(node.right!)]
      };
    }
    return { type: 'SERIES', children: [] };
  }

  private static flattenBlock(block: LogicBlock): Transistor[] {
    if (block.type === 'TRANSISTOR') return [block.transistor];
    return block.children.flatMap(c => this.flattenBlock(c));
  }

  private static addInverter(input: string, output: string, transistors: Transistor[]) {
    const id = this.nodeCounter++;
    transistors.push({
      id: `MP_INV_${id}`,
      type: 'PMOS',
      gate: input,
      source: 'VDD',
      drain: output
    });
    transistors.push({
      id: `MN_INV_${id}`,
      type: 'NMOS',
      gate: input,
      source: 'GND',
      drain: output
    });
  }
}
