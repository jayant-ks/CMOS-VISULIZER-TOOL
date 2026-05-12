/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Transistor } from '../logic/circuitGenerator';
import { BooleanNode } from '../logic/booleanEngine';

interface CircuitDiagramProps {
  transistors: Transistor[];
  isConstant: boolean;
  constantValue?: boolean;
  coreNode?: BooleanNode;
}

export const CircuitDiagram: React.FC<CircuitDiagramProps> = ({ transistors, isConstant, constantValue, coreNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 60, right: 60, bottom: 60, left: 100 };

    if (isConstant || !coreNode) {
      const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);
      
      if (isConstant) {
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('class', 'text-2xl font-mono font-bold fill-zinc-900')
          .text(`Y = ${constantValue ? 'VDD' : 'GND'}`);
        
        if (constantValue) {
          g.append('line').attr('x1', -20).attr('y1', -40).attr('x2', 20).attr('y2', -40).attr('stroke', '#141414').attr('stroke-width', 2);
          g.append('line').attr('x1', 0).attr('y1', -40).attr('x2', 0).attr('y2', -20).attr('stroke', '#141414').attr('stroke-width', 2);
        } else {
          const gnd = g.append('g').attr('transform', 'translate(0, 40)');
          gnd.append('path').attr('d', 'M -15 0 L 15 0 L 0 15 Z').attr('fill', 'none').attr('stroke', '#141414').attr('stroke-width', 2);
          gnd.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', -20).attr('stroke', '#141414').attr('stroke-width', 2);
        }
      } else {
        g.append('text').attr('text-anchor', 'middle').attr('class', 'text-sm font-mono opacity-50').text('No circuit data');
      }
      return;
    }

    const mainG = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // VDD Rail
    mainG.append('line').attr('x1', 0).attr('y1', 0).attr('x2', innerWidth).attr('y2', 0).attr('stroke', '#141414').attr('stroke-width', 2);
    mainG.append('text').attr('x', 0).attr('y', -10).attr('class', 'text-xs font-bold fill-emerald-600').text('VDD');

    // GND Rail
    mainG.append('line').attr('x1', 0).attr('y1', innerHeight).attr('x2', innerWidth).attr('y2', innerHeight).attr('stroke', '#141414').attr('stroke-width', 2);
    const gndSymbol = mainG.append('g').attr('transform', `translate(${innerWidth / 2}, ${innerHeight})`);
    gndSymbol.append('path').attr('d', 'M -12 0 L 12 0 L 0 12 Z').attr('fill', 'none').attr('stroke', '#141414').attr('stroke-width', 2);
    mainG.append('text').attr('x', 0).attr('y', innerHeight + 20).attr('class', 'text-xs font-bold fill-red-600').text('GND');

    const drawTransistor = (container: any, type: 'PMOS' | 'NMOS', gate: string, x: number, y: number) => {
      const g = container.append('g').attr('transform', `translate(${x}, ${y})`);
      
      // Gate
      g.append('line').attr('x1', -15).attr('y1', -15).attr('x2', -15).attr('y2', 15).attr('stroke', '#141414').attr('stroke-width', 2);
      g.append('line').attr('x1', -7).attr('y1', -18).attr('x2', -7).attr('y2', 18).attr('stroke', '#141414').attr('stroke-width', 2);
      
      const gateX = type === 'PMOS' ? -22 : -15;
      g.append('line').attr('x1', -40).attr('y1', 0).attr('x2', gateX).attr('y2', 0).attr('stroke', '#141414').attr('stroke-width', 2);
      
      if (type === 'PMOS') {
        g.append('circle').attr('cx', -18.5).attr('cy', 0).attr('r', 3.5).attr('fill', 'white').attr('stroke', '#141414').attr('stroke-width', 1.5);
      }

      // S/D
      const sdY = 12;
      g.append('line').attr('x1', -7).attr('y1', -sdY).attr('x2', 10).attr('y2', -sdY).attr('stroke', '#141414').attr('stroke-width', 2);
      g.append('line').attr('x1', 10).attr('y1', -sdY).attr('x2', 10).attr('y2', -sdY - 10).attr('stroke', '#141414').attr('stroke-width', 2);
      
      g.append('line').attr('x1', -7).attr('y1', sdY).attr('x2', 10).attr('y2', sdY).attr('stroke', '#141414').attr('stroke-width', 2);
      g.append('line').attr('x1', 10).attr('y1', sdY).attr('x2', 10).attr('y2', sdY + 10).attr('stroke', '#141414').attr('stroke-width', 2);

      g.append('text').attr('x', -45).attr('y', 4).attr('text-anchor', 'end').attr('class', 'text-[10px] font-mono font-bold fill-emerald-700').text(gate);
      
      return { top: { x: x + 10, y: y - sdY - 10 }, bottom: { x: x + 10, y: y + sdY + 10 } };
    };

    const layoutNetwork = (node: BooleanNode, type: 'PMOS' | 'NMOS'): any => {
      if (node.type === 'VAR') {
        return { type: 'LEAF', gate: node.name, width: 80, height: 80 };
      }
      if (node.type === 'NOT') {
        return { type: 'LEAF', gate: `${node.child?.name}'`, width: 80, height: 80 };
      }
      
      const left = layoutNetwork(node.left!, type);
      const right = layoutNetwork(node.right!, type);
      
      const isSeries = (type === 'NMOS' && node.type === 'AND') || (type === 'PMOS' && node.type === 'OR');
      
      if (isSeries) {
        return {
          type: 'SERIES',
          left,
          right,
          width: Math.max(left.width, right.width),
          height: left.height + right.height + 20
        };
      } else {
        return {
          type: 'PARALLEL',
          left,
          right,
          width: left.width + right.width + 20,
          height: Math.max(left.height, right.height)
        };
      }
    };

    const drawRecursive = (container: any, layout: any, type: 'PMOS' | 'NMOS', x: number, y: number): { top: { x: number, y: number }, bottom: { x: number, y: number } } => {
      if (layout.type === 'LEAF') {
        return drawTransistor(container, type, layout.gate, x + layout.width / 2, y + layout.height / 2);
      }
      
      if (layout.type === 'SERIES') {
        const topRes = drawRecursive(container, layout.left, type, x + (layout.width - layout.left.width) / 2, y);
        const bottomRes = drawRecursive(container, layout.right, type, x + (layout.width - layout.right.width) / 2, y + layout.left.height + 20);
        
        container.append('line').attr('x1', topRes.bottom.x).attr('y1', topRes.bottom.y).attr('x2', bottomRes.top.x).attr('y2', bottomRes.top.y).attr('stroke', '#141414').attr('stroke-width', 2);
        
        return { top: topRes.top, bottom: bottomRes.bottom };
      } else {
        const leftRes = drawRecursive(container, layout.left, type, x, y + (layout.height - layout.left.height) / 2);
        const rightRes = drawRecursive(container, layout.right, type, x + layout.left.width + 20, y + (layout.height - layout.right.height) / 2);
        
        const topY = Math.min(leftRes.top.y, rightRes.top.y) - 10;
        const bottomY = Math.max(leftRes.bottom.y, rightRes.bottom.y) + 10;
        
        container.append('line').attr('x1', leftRes.top.x).attr('y1', leftRes.top.y).attr('x2', leftRes.top.x).attr('y2', topY).attr('stroke', '#141414').attr('stroke-width', 2);
        container.append('line').attr('x1', rightRes.top.x).attr('y1', rightRes.top.y).attr('x2', rightRes.top.x).attr('y2', topY).attr('stroke', '#141414').attr('stroke-width', 2);
        container.append('line').attr('x1', leftRes.top.x).attr('y1', topY).attr('x2', rightRes.top.x).attr('y2', topY).attr('stroke', '#141414').attr('stroke-width', 2);
        
        container.append('line').attr('x1', leftRes.bottom.x).attr('y1', leftRes.bottom.y).attr('x2', leftRes.bottom.x).attr('y2', bottomY).attr('stroke', '#141414').attr('stroke-width', 2);
        container.append('line').attr('x1', rightRes.bottom.x).attr('y1', rightRes.bottom.y).attr('x2', rightRes.bottom.x).attr('y2', bottomY).attr('stroke', '#141414').attr('stroke-width', 2);
        container.append('line').attr('x1', leftRes.bottom.x).attr('y1', bottomY).attr('x2', rightRes.bottom.x).attr('y2', bottomY).attr('stroke', '#141414').attr('stroke-width', 2);
        
        return { 
          top: { x: (leftRes.top.x + rightRes.top.x) / 2, y: topY }, 
          bottom: { x: (leftRes.bottom.x + rightRes.bottom.x) / 2, y: bottomY } 
        };
      }
    };

    const punLayout = layoutNetwork(coreNode, 'PMOS');
    const pdnLayout = layoutNetwork(coreNode, 'NMOS');

    const coreWidth = Math.max(punLayout.width, pdnLayout.width);
    const hasInverter = transistors.some(t => t.id.includes('INV'));
    const totalWidth = coreWidth + (hasInverter ? 200 : 0);
    
    // Center the entire block (core + inverter)
    const startX = (innerWidth - totalWidth) / 2;
    const coreX = startX;

    const punRes = drawRecursive(mainG, punLayout, 'PMOS', coreX + (coreWidth - punLayout.width) / 2, 40);
    const pdnRes = drawRecursive(mainG, pdnLayout, 'NMOS', coreX + (coreWidth - pdnLayout.width) / 2, innerHeight - pdnLayout.height - 40);

    mainG.append('line').attr('x1', punRes.top.x).attr('y1', punRes.top.y).attr('x2', punRes.top.x).attr('y2', 0).attr('stroke', '#141414').attr('stroke-width', 2);
    mainG.append('line').attr('x1', pdnRes.bottom.x).attr('y1', pdnRes.bottom.y).attr('x2', pdnRes.bottom.x).attr('y2', innerHeight).attr('stroke', '#141414').attr('stroke-width', 2);

    const midY = innerHeight / 2;
    mainG.append('line').attr('x1', punRes.bottom.x).attr('y1', punRes.bottom.y).attr('x2', punRes.bottom.x).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
    mainG.append('line').attr('x1', pdnRes.top.x).attr('y1', pdnRes.top.y).attr('x2', pdnRes.top.x).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
    
    const finalX = innerWidth - 40;

    if (hasInverter) {
      const invX = startX + coreWidth + 100;
      mainG.append('line').attr('x1', Math.max(punRes.bottom.x, pdnRes.top.x)).attr('y1', midY).attr('x2', invX - 40).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
      
      const invP = drawTransistor(mainG, 'PMOS', 'Z', invX, 80);
      const invN = drawTransistor(mainG, 'NMOS', 'Z', invX, innerHeight - 80);
      
      mainG.append('line').attr('x1', invP.top.x).attr('y1', invP.top.y).attr('x2', invP.top.x).attr('y2', 0).attr('stroke', '#141414').attr('stroke-width', 2);
      mainG.append('line').attr('x1', invN.bottom.x).attr('y1', invN.bottom.y).attr('x2', invN.bottom.x).attr('y2', innerHeight).attr('stroke', '#141414').attr('stroke-width', 2);
      
      mainG.append('path').attr('d', `M ${invX - 40} ${midY} L ${invX - 40} 80 L ${invX - 22} 80`).attr('fill', 'none').attr('stroke', '#141414').attr('stroke-width', 2);
      mainG.append('path').attr('d', `M ${invX - 40} ${midY} L ${invX - 40} ${innerHeight - 80} L ${invX - 15} ${innerHeight - 80}`).attr('fill', 'none').attr('stroke', '#141414').attr('stroke-width', 2);
      
      mainG.append('line').attr('x1', invP.bottom.x).attr('y1', invP.bottom.y).attr('x2', invP.bottom.x).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
      mainG.append('line').attr('x1', invN.top.x).attr('y1', invN.top.y).attr('x2', invN.top.x).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
      mainG.append('line').attr('x1', invP.bottom.x).attr('y1', midY).attr('x2', finalX).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
    } else {
      mainG.append('line').attr('x1', Math.max(punRes.bottom.x, pdnRes.top.x)).attr('y1', midY).attr('x2', finalX).attr('y2', midY).attr('stroke', '#141414').attr('stroke-width', 2);
    }

    mainG.append('text').attr('x', finalX + 10).attr('y', midY + 5).attr('class', 'text-xl font-mono font-bold fill-emerald-600').text('Y');

  }, [transistors, isConstant, constantValue, coreNode]);

  return (
    <div className="bg-white border border-zinc-900 p-4 rounded-sm shadow-sm overflow-hidden">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4 italic">Transistor-Level Circuit</h3>
      <div className="w-full overflow-x-auto">
        <svg ref={svgRef} viewBox="0 0 800 600" className="min-w-[800px] h-auto mx-auto" />
      </div>
    </div>
  );
};
