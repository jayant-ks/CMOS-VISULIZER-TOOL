/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Transistor } from '../logic/circuitGenerator';

interface StickDiagramProps {
  transistors: Transistor[];
  isConstant: boolean;
}

export const StickDiagram: React.FC<StickDiagramProps> = ({ transistors, isConstant }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 500;
    const margin = { top: 60, right: 60, bottom: 60, left: 100 };

    if (isConstant) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-2xl font-mono fill-zinc-900')
        .text('No Stick Diagram Required (Constant Logic)');
      return;
    }

    // 1. Extract unique gates and nodes
    const uniqueGates = Array.from(new Set(transistors.map(t => t.gate))).filter(g => g !== 'Z');
    const pmosTransistors = transistors.filter(t => t.type === 'PMOS' && t.gate !== 'Z');
    const nmosTransistors = transistors.filter(t => t.type === 'NMOS' && t.gate !== 'Z');
    const invTransistors = transistors.filter(t => t.id.includes('INV'));

    const gateSpacing = Math.min(100, (width - 200) / (uniqueGates.length + (invTransistors.length > 0 ? 1 : 0)));
    const startX = 150;

    // 2. Draw N-well and P-substrate
    svg.append('rect')
      .attr('x', 50)
      .attr('y', 60)
      .attr('width', width - 100)
      .attr('height', 120)
      .attr('fill', '#e0f2fe')
      .attr('stroke', '#0ea5e9')
      .attr('stroke-dasharray', '4,4');
    
    svg.append('text').attr('x', 60).attr('y', 75).attr('class', 'text-[9px] font-mono fill-sky-700 opacity-50').text('N-WELL');

    svg.append('rect')
      .attr('x', 50)
      .attr('y', 240)
      .attr('width', width - 100)
      .attr('height', 120)
      .attr('fill', '#fef2f2')
      .attr('stroke', '#ef4444')
      .attr('stroke-dasharray', '4,4');
    
    svg.append('text').attr('x', 60).attr('y', 255).attr('class', 'text-[9px] font-mono fill-red-700 opacity-50').text('P-SUBSTRATE');

    // 3. Draw VDD and GND Metal lines
    svg.append('line').attr('x1', 30).attr('y1', 40).attr('x2', width - 30).attr('y2', 40).attr('stroke', '#3b82f6').attr('stroke-width', 10);
    svg.append('text').attr('x', 10).attr('y', 45).attr('class', 'text-[10px] font-mono font-bold fill-blue-700').text('VDD');

    svg.append('line').attr('x1', 30).attr('y1', 380).attr('x2', width - 30).attr('y2', 380).attr('stroke', '#3b82f6').attr('stroke-width', 10);
    svg.append('text').attr('x', 10).attr('y', 385).attr('class', 'text-[10px] font-mono font-bold fill-blue-700').text('GND');

    // 4. Draw Diffusion bands
    svg.append('rect').attr('x', 100).attr('y', 100).attr('width', width - 200).attr('height', 40).attr('fill', '#fbbf24').attr('fill-opacity', 0.4).attr('stroke', '#d97706');
    svg.append('rect').attr('x', 100).attr('y', 280).attr('width', width - 200).attr('height', 40).attr('fill', '#22c55e').attr('fill-opacity', 0.4).attr('stroke', '#16a34a');

    const drawContact = (x: number, y: number) => {
      svg.append('rect').attr('x', x - 4).attr('y', y - 4).attr('width', 8).attr('height', 8).attr('fill', '#141414');
    };

    // 5. Draw Gates and Transistors
    const gateMap = new Map<string, number>();
    uniqueGates.forEach((gate, i) => {
      const x = startX + i * gateSpacing;
      gateMap.set(gate as string, x);
      
      // Poly line
      svg.append('line').attr('x1', x).attr('y1', 30).attr('x2', x).attr('y2', 390).attr('stroke', '#ef4444').attr('stroke-width', 4);
      svg.append('text').attr('x', x).attr('y', 25).attr('text-anchor', 'middle').attr('class', 'text-[10px] font-mono font-bold fill-red-700').text(String(gate));
    });

    // Inverter gate if exists
    if (invTransistors.length > 0) {
      const x = startX + uniqueGates.length * gateSpacing;
      svg.append('line').attr('x1', x).attr('y1', 30).attr('x2', x).attr('y2', 390).attr('stroke', '#ef4444').attr('stroke-width', 4);
      svg.append('text').attr('x', x).attr('y', 25).attr('text-anchor', 'middle').attr('class', 'text-[10px] font-mono font-bold fill-red-700').text('INV');
      gateMap.set('INV', x);
    }

    // 6. Draw Connections
    const nodeYMap = new Map<string, number>();
    nodeYMap.set('VDD', 40);
    nodeYMap.set('GND', 380);
    nodeYMap.set('Y', 210);
    nodeYMap.set('out_gate', 210);

    const drawNodeConnection = (node: string, x: number, y: number) => {
      const targetY = nodeYMap.get(node);
      if (targetY !== undefined) {
        svg.append('line').attr('x1', x).attr('y1', y).attr('x2', x).attr('y2', targetY).attr('stroke', '#3b82f6').attr('stroke-width', 2);
        drawContact(x, targetY);
        drawContact(x, y);
        
        if (node === 'Y' || node === 'out_gate') {
          svg.append('line').attr('x1', x).attr('y1', targetY).attr('x2', width - 80).attr('y2', targetY).attr('stroke', '#3b82f6').attr('stroke-width', 4);
        }
      } else {
        // Internal node connection
        // For internal nodes, we might need a more complex routing, but for now let's just draw a small stub or label
        svg.append('circle').attr('cx', x).attr('cy', y).attr('r', 2).attr('fill', '#141414');
        svg.append('text').attr('x', x + 5).attr('y', y).attr('class', 'text-[6px] font-mono fill-zinc-400').text(node);
      }
    };

    // Draw PMOS connections
    pmosTransistors.forEach((t) => {
      const gateX = gateMap.get(t.gate) || 0;
      drawNodeConnection(t.source, gateX - 20, 120);
      drawNodeConnection(t.drain, gateX + 20, 120);
    });

    // Draw NMOS connections
    nmosTransistors.forEach((t) => {
      const gateX = gateMap.get(t.gate) || 0;
      drawNodeConnection(t.source, gateX - 20, 300);
      drawNodeConnection(t.drain, gateX + 20, 300);
    });

    // Draw Inverter connections
    invTransistors.forEach(t => {
      const gateX = gateMap.get('INV') || 0;
      const y = t.type === 'PMOS' ? 120 : 300;
      drawNodeConnection(t.source, gateX - 20, y);
      drawNodeConnection(t.drain, gateX + 20, y);
    });

    svg.append('text')
      .attr('x', width - 70)
      .attr('y', 215)
      .attr('class', 'text-xs font-mono font-bold fill-blue-700')
      .text('Y (Output)');

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${width - 120}, 60)`);
    const items = [
      { color: '#ef4444', label: 'Polysilicon' },
      { color: '#3b82f6', label: 'Metal 1' },
      { color: '#fbbf24', label: 'P-Diffusion' },
      { color: '#22c55e', label: 'N-Diffusion' },
      { color: '#141414', label: 'Contact' }
    ];

    items.forEach((item, i) => {
      legend.append('rect').attr('x', 0).attr('y', i * 15).attr('width', 10).attr('height', 10).attr('fill', item.color);
      legend.append('text').attr('x', 15).attr('y', i * 15 + 8).attr('class', 'text-[8px] font-mono fill-zinc-500').text(item.label);
    });

  }, [transistors, isConstant]);

  return (
    <div className="bg-white border border-zinc-900 p-4 rounded-sm shadow-sm overflow-hidden">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4 italic">CMOS Stick Diagram</h3>
      <div className="w-full overflow-x-auto">
        <svg ref={svgRef} viewBox="0 0 800 500" className="min-w-[800px] h-auto mx-auto" />
      </div>
    </div>
  );
};
