---
tags:
  - hdl
  - verilog
  - vhdl
created: 2026-08-23
---
## Introduction

HDL is a specialized computer language used to describe the structure and behavior of electronics circuits. It is usually used to design application-specific intergraded circuit (ASICs) and to program [[field-programmable-gate-arrays-fpgas]]

Hardware Description Language but it does not operate as a programming language, think of it as a markup language

```
module and_gate(
// Inputs
input [1: 0] pmod,
//Outputs
output [2: 0] led
);

	//Wire declration
	wire not_pmod_0;
	//Continous assignment: replicate 1 wire to 2 outputs
	assign not_pmod_0 = ~pmod[0];
	assign led[1:0] = {2{not_pmod_0}};

	assign led[2] = not_pmod_0 & ~pmod[1];
endmodule
```

The above HDL describe this circuit

![[and-gate-circuit.png]]

## Common HDL

Two most common language are VHDL and Verilog. These 2 are examples of Register Transfer Level (RTL) Design. This mean that they describe how a circuit moves and manipulated data between register, but they do not describe the exact hardware to do so

### VHDL

- Invented in 1983
- Developed by the United States Department of Defense
- Strongly-typed and more verbose

### [[verilog]]

- Invented in 1984
- Developed by Gateway Design Automation
- Weakly-type, C-like language

### SystemVerilog

- Extends functionality of Verilog
- Add features for testing/verification (test/benches)
