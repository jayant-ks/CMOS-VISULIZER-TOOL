/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BooleanEngine, BooleanNode } from './logic/booleanEngine';
import { CircuitGenerator, Circuit } from './logic/circuitGenerator';
import { CircuitDiagram } from './components/CircuitDiagram';
import { StickDiagram } from './components/StickDiagram';
import { LucideCpu, LucideTerminal, LucideTable, LucideLayers, LucideInfo, LucideZap, LucideLoader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [expression, setExpression] = useState<string>("(A . B) + C");
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const results = useMemo(() => {
    try {
      setError(null);
      const parsed = BooleanEngine.parse(expression);
      const table = BooleanEngine.getTruthTable(parsed);
      const { node: simplified, steps } = BooleanEngine.simplify(parsed);
      const circuit = CircuitGenerator.generate(simplified);
      
      const isConstant = simplified.type === 'CONST';
      const constantValue = simplified.value;

      return {
        original: BooleanEngine.stringify(parsed),
        reduced: BooleanEngine.stringify(simplified),
        steps,
        finalEquation: circuit.finalEquation,
        table,
        circuit,
        isConstant,
        constantValue,
        coreNode: circuit.coreNode
      };
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [expression]);

  useEffect(() => {
    if (!results) {
      setExplanation(null);
      return;
    }

    const fetchExplanation = async () => {
      setIsExplaining(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          We simplify the Boolean expression step-by-step.
          
          Given expression: ${results.original}
          
          Please provide a step-by-step algebraic simplification of this expression to reach the final form: ${results.reduced}.
          Use standard Boolean laws (Distributive, Idempotent, Absorption, De Morgan's, etc.).
          
          Format the output exactly like this:
          Step 1: [Name of law]
          [Intermediate expression]
          
          Step 2: [Name of law]
          [Intermediate expression]
          
          ...
          
          ✅ Final Reduced Boolean Expression
          ${results.reduced}
          
          Keep it concise and clear. Use '.' for AND and '+' for OR.
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
        });

        setExplanation(response.text);
      } catch (err) {
        console.error("Failed to fetch explanation:", err);
        setExplanation("Could not generate step-by-step explanation.");
      } finally {
        setIsExplaining(false);
      }
    };

    fetchExplanation();
  }, [results?.original, results?.reduced]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <LucideCpu className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">CMOS VLSI Logic Visualizer</h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">v1.0.0 // EDA ARCHITECTURE // CADENCE-STYLE</p>
          </div>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">System Status: Nominal</p>
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Core: CMOS Static Logic</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Section */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#141414] p-6 rounded-sm shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <LucideTerminal className="w-4 h-4" />
              <h2 className="text-xs font-mono uppercase tracking-widest italic">Input Expression</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Boolean Equation (A, B, C)</label>
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="w-full bg-[#f5f5f5] border border-[#141414] p-3 font-mono text-lg focus:outline-none focus:ring-1 focus:ring-[#141414]"
                  placeholder="e.g. (A . B) + C"
                />
              </div>
              <div className="bg-zinc-50 p-3 border-l-2 border-[#141414] text-[11px] font-mono space-y-1">
                <p>• Use <span className="font-bold">+</span> for OR</p>
                <p>• Use <span className="font-bold">.</span> for AND</p>
                <p>• Use <span className="font-bold">'</span> for NOT</p>
                <p>• Max 3 variables: A, B, C</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 p-3 text-red-600 text-xs font-mono">
                  ERROR: {error}
                </div>
              )}
            </div>
          </div>

          {results && (
            <div className="bg-white border border-[#141414] p-6 rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <LucideInfo className="w-4 h-4" />
                <h2 className="text-xs font-mono uppercase tracking-widest italic">Logic Analysis</h2>
              </div>
              <div className="space-y-4 font-mono text-xs">
                <div className="border-b border-zinc-100 pb-2">
                  <p className="opacity-50 uppercase text-[9px] mb-1">Original Expression</p>
                  <p className="text-sm">{results.original}</p>
                </div>
                
                <div className="border-b border-zinc-100 pb-2">
                  <p className="opacity-50 uppercase text-[9px] mb-2">Reduction Steps</p>
                  {isExplaining ? (
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 py-2">
                      <LucideLoader2 className="w-3 h-3 animate-spin" />
                      <span>Synthesizing algebraic steps...</span>
                    </div>
                  ) : explanation ? (
                    <div className="whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-700 bg-zinc-50 p-3 border border-zinc-100 rounded-sm">
                      {explanation}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.steps.map((step, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-[9px] bg-zinc-100 px-1 rounded text-zinc-500 mt-0.5">{i + 1}</span>
                          <p className="text-[10px] leading-tight">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-b border-zinc-100 pb-2">
                  <p className="opacity-50 uppercase text-[9px] mb-1">Reduced Expression</p>
                  <p className="text-sm">{results.reduced}</p>
                </div>
                <div className="pb-2">
                  <p className="opacity-50 uppercase text-[9px] mb-1">Final Output Equation</p>
                  <p className="text-sm font-bold text-emerald-700">{results.finalEquation}</p>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="bg-white border border-[#141414] p-6 rounded-sm shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <LucideTable className="w-4 h-4" />
                <h2 className="text-xs font-mono uppercase tracking-widest italic">Truth Table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono text-[10px]">
                  <thead>
                    <tr className="border-b border-[#141414]">
                      <th className="p-2">A</th>
                      <th className="p-2">B</th>
                      <th className="p-2">C</th>
                      <th className="p-2 bg-zinc-100">Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.table.map((y, i) => (
                      <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="p-2">{i & 4 ? '1' : '0'}</td>
                        <td className="p-2">{i & 2 ? '1' : '0'}</td>
                        <td className="p-2">{i & 1 ? '1' : '0'}</td>
                        <td className={`p-2 font-bold ${y ? 'text-emerald-600' : 'text-red-600'} bg-zinc-50`}>
                          {y ? '1' : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Visualization Section */}
        <section className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {results && (
              <motion.div
                key={expression}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-6">
                  <CircuitDiagram 
                    transistors={results.circuit.transistors} 
                    isConstant={results.isConstant}
                    constantValue={results.constantValue}
                    coreNode={results.coreNode}
                  />
                  
                  <div className="bg-white border border-[#141414] p-6 rounded-sm shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <LucideZap className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-xs font-mono uppercase tracking-widest italic">CMOS Synthesis Rules</h2>
                      </div>
                      <div className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 rounded-full">
                        {results.circuit.hasInverter ? '2-STAGE (GATE + INV)' : '1-STAGE (NATIVE)'}
                      </div>
                    </div>
                    <div className="mb-4 pb-4 border-b border-zinc-100 space-y-2">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-zinc-500">Core Logic (f):</span>
                        <span className="font-bold">{results.circuit.coreExpression}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-zinc-500">Gate Output:</span>
                        <span className="font-bold">({results.circuit.coreExpression})'</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-600 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="font-bold text-[#141414]">PDN (NMOS Network):</p>
                        <p>• Logic: {results.circuit.coreExpression}</p>
                        <p>• AND $\rightarrow$ Series, OR $\rightarrow$ Parallel</p>
                      </div>
                      <div className="space-y-2">
                        <p className="font-bold text-[#141414]">PUN (PMOS Network):</p>
                        <p>• Logic: Dual of PDN</p>
                        <p>• AND $\rightarrow$ Parallel, OR $\rightarrow$ Series</p>
                      </div>
                    </div>
                    {results.circuit.hasInverter && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <p className="text-[11px] font-mono">
                          <span className="text-emerald-700 font-bold">[!]</span> Since static CMOS is naturally inverting, an inverter stage is added to achieve the non-inverted output <span className="font-bold text-[#141414]">{results.finalEquation}</span>.
                        </p>
                      </div>
                    )}
                  </div>

                  <StickDiagram 
                    transistors={results.circuit.transistors}
                    isConstant={results.isConstant}
                  />

                  <div className="bg-white border border-[#141414] p-6 rounded-sm shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <LucideLayers className="w-4 h-4" />
                      <h2 className="text-xs font-mono uppercase tracking-widest italic">Stick Diagram Logic</h2>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-600 leading-relaxed">
                      <p>
                        The stick diagram is dynamically generated based on the transistor list. 
                        Vertical <span className="text-red-600 font-bold">Polysilicon</span> lines represent gates, 
                        while horizontal <span className="text-amber-600 font-bold">P-Diffusion</span> and <span className="text-emerald-600 font-bold">N-Diffusion</span> bands represent the active regions. 
                        <span className="text-blue-600 font-bold">Metal 1</span> lines connect the source/drain contacts to VDD, GND, or the output Y.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!results && !error && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
              <LucideLayers className="w-24 h-24 mb-4" />
              <p className="font-mono uppercase tracking-widest text-sm">Awaiting Input Expression</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414] p-6 mt-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[9px] font-mono uppercase tracking-widest opacity-50">
          <p>© 2026 VLSI DESIGN ARCHITECT // EDA TOOLSET</p>
          <p>DETERMINISTIC // ENGINEERING-ACCURATE // CADENCE-STYLE</p>
        </div>
      </footer>
    </div>
  );
}
