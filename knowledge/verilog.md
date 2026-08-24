---
tags:
  - verilog
  - hdl
created: 2026-08-23
---
 One of the most important aspect of Verilog is that it allows designers to simulate and verify their designs before implementation

## Module

Module is the fundamental building block in verilog

![[verilog-module.png]]

## Data Types

### Wire (Net Type)
- Represents continuous values (combinational logic)
- Default value: `Z` (high impedance)
- Cannot store values, only transmits them

```verilog
wire [7:0] data_bus;    // 8-bit wire
wire clk, reset;        // Single-bit wires
assign data_bus = a + b; // Continuous assignment
```

### Vector
#### Declaring Vectors
Vectors must be declared:

```verilog
type [upper:lower] vector_name;
```

type specifies the datatype of the vector. This is usually wire or reg. If you are declaring a input or output port, the type can additionally include the port type (e.g., input or output) as well. Some examples:

```verilog
wire [7:0] w;         // 8-bit wire
reg  [4:1] x;         // 4-bit reg
output reg [0:0] y;   // 1-bit reg that is also an output port (this is still a vector)
input wire [3:-2] z;  // 6-bit wire input (negative ranges are allowed)
output [3:0] a;       // 4-bit output wire. Type is 'wire' unless specified otherwise.
wire [0:7] b;         // 8-bit wire where b[0] is the most-significant bit.
```

The endianness (or, informally, "direction") of a vector is whether the the least significant bit has a lower index (little-endian, e.g., [3:0]) or a higher index (big-endian, e.g., [0:3]). In Verilog, once a vector is declared with a particular endianness, it must always be used the same way. e.g., ***writing vec[0:3] when vec is declared wire [3:0] vec***; is illegal. Being consistent with endianness is good practice, as weird bugs occur if vectors of different endianness are assigned or used together. 

#### Implicit net
Implicit nets are often a source of hard-to-detect bugs. In Verilog, net-type signals can be implicitly created by an `assign` statement or by attaching something undeclared to a module port. Implicit nets are always one-bit wires and causes bugs if you had intended to use a vector. Disabling creation of implicit nets can be done using the `` `default_nettype none `` directive.

```verilog
wire [2:0] a, c;   // Two vectors
assign a = 3'b101;  // a = 101
assign b = a;       // b = 1  implicitly-created wire (b automatically a 1-bit wire)
assign c = b;       // c = 001  <-- bug
my_module i1 (d,e); // d and e are implicitly one-bit wide if not declared.
                    // This could be a bug if the port was intended to be a vector.
```

Adding `` `default_nettype none `` would make the second line of code an error, which makes the bug more visible.
#### Accessing Vector Elements: Part-Select
Accessing an entire vector is done using the vector name. For example:

```verilog
assign w = a;
```

takes the entire 4-bit vector _a_ and assigns it to the entire 8-bit vector _w_ (declarations are taken from above). If the lengths of the right and left sides don't match, it is zero-extended or truncated as appropriate.

The part-select operator can be used to access a portion of a vector:

```verilog
w[3:0]      // Only the lower 4 bits of w
x[1]        // The lowest bit of x
x[1:1]      // ...also the lowest bit of x
z[-1:-2]    // Two lowest bits of z
b[3:0]      // Illegal. Vector part-select must match the direction of the declaration. Since b is declare as [0:7] b
b[0:3]      // The *upper* 4 bits of b.
assign w[3:0] = b[0:3];    // Assign upper 4 bits of b to lower 4 bits of w. w[3]=b[0], w[2]=b[1], etc.
```

#### Short hand syntax on vector
- Bitwise on a vector itself
```verilog
w[3:0] = 4'b1010;
&w == w[3] & w[2] & w[1] & w[0] // equivalent, same with |, ^ and bitwise operator
```
- part selection to reverse the vector order ABCD -> DCBA where A, B, C, D is 8 bit vector
```verilog
module top_module( 
    input [31:0] in,
    output [31:0] out );//

    // assign out[31:24] = ...;
    assign out = {in[7:0], in[15:8], in[23:16], in[31:24]};

endmodule

/*
Concatenation needs to know the width of every component (or how would you know the length of the result?). Thus, {1, 2, 3} is illegal and results in the error message: unsized constants are not allowed in concatenations.
*/
```

- Can also do this
```verilog
input [4:0] a, b, c, d, e, f,
output [7:0] w, x, y, z );//

// assign { ... } = { ... };
assign {w, x, y, z} = {a, b, c, d, e, f, 2'b11};
```

- Replicating operator applies the vector nums time while in concanating {5{1'b1}} -> {5'b11111}
```verilog
module top_module (
    input [7:0] in,
    output [31:0] out );//

    // assign out = { replicate-sign-bit , the-input };
    assign out = { {24{in[7]}}, in};

endmodule
```
### Reg
- Stores values over time (used in procedural blocks)
- Default value: `X` (unknown)
- Can be assigned in `always` or `initial` blocks

```verilog
reg [3:0] counter;      // 4-bit register
reg enable, flag;       // Single-bit registers

always @(posedge clk) begin
    counter <= counter + 1;
    flag <= enable;
end
```

### Integer
- Stores 32-bit signed integers
- Useful for loop counters and temporary calculations
- Default value: `X`

```verilog
integer i, j;           // Loop counters
integer temp_result;    // Temporary storage

initial begin
    for (i = 0; i < 8; i = i + 1) begin
        temp_result = i * 2;
        $display("Result: %d", temp_result);
    end
end
```

### Real
- Stores floating-point numbers (IEEE 754 double precision)
- Not synthesizable (simulation only)
- Used for modeling and verification

```verilog
real frequency;         // Clock frequency
real voltage;          // Analog values
real delay_time;       // Timing calculations

initial begin
    frequency = 100.5;
    voltage = 3.3;
    delay_time = 1.5e-9;  // 1.5 nanoseconds
end
```

## Operators in Verilog

![[verilog-operators.png]]

## Assignment Types in Verilog

### Continuous Assignment
- Outside of procedural blocks
- Drives values onto **nets** (wire types only)
- Automatically active at time 0
- Continuously updates whenever right-hand side operands change
- Uses `assign` keyword
- **Cannot** be used with `reg` data types

```verilog
wire [3:0] sum, a, b;
wire carry_out, carry_in;

// Basic continuous assignment
assign sum = a + b;

// Multiple assignments
assign {carry_out, sum} = a + b + carry_in;

// Conditional assignment (ternary operator)
assign result = (select) ? input_a : input_b;

// Gate-level modeling
assign and_out = a & b;
assign or_out = a | b;
assign not_out = ~a;
```

### Procedural Assignment
- Inside procedural blocks (`always`, `initial`, `task`, `function`)
- Updates **register** and **memory** data types
- Evaluated when the statement is encountered during simulation
- Can use both `reg` and `integer` data types

#### **initial** Block
- Executes **once** at the beginning of simulation
- Used for initialization, testbench stimulus, and one-time setup
- Cannot be synthesized (simulation only)

```verilog
reg [7:0] memory [0:255];  // Memory array
reg clk, reset;
integer i;

initial begin
    // Initialize signals
    clk = 0;
    reset = 1;
    
    // Initialize memory
    for (i = 0; i < 256; i = i + 1) begin
        memory[i] = 8'h00;
    end
    
    // Stimulus generation
    #10 reset = 0;
    #100 $finish;
end

// Clock generation
initial begin
    forever #5 clk = ~clk;  // 10ns period clock
end
```

#### **always** Block
- Executes when signals in sensitivity list change
- Used for sequential and combinational logic
- **Blocking** (`=`) vs **Non-blocking** (`<=`) assignments

##### **Blocking Assignment** (`=`)
- Executes immediately in sequential order
- Next statement waits until current assignment completes
- Used for **combinational logic** in always blocks
- Creates expected behavior in procedural code

```verilog
// Combinational logic - use blocking
always @(*) begin     // * mean sesitive to ALL signal equivalent to (a, b,c, sel)
    temp = a + b;        // Executes first
    result = temp * c;   // Uses updated temp value
end

// Priority encoder
always @(*) begin
    if (req[3])      grant = 4'b1000;
    else if (req[2]) grant = 4'b0100;
    else if (req[1]) grant = 4'b0010;
    else if (req[0]) grant = 4'b0001;
    else             grant = 4'b0000;
end
```

##### **Non-blocking Assignment** (`<=`)
- Schedules assignment for end of time step
- All assignments execute simultaneously/parallel
- Used for **sequential logic** (clocked processes)
- Models real hardware behavior

```verilog
// Sequential logic - use non-blocking
always @(posedge clk or negedge reset) begin
    if (!reset) begin
        q1 <= 1'b0;
        q2 <= 1'b0;
        q3 <= 1'b0;
    end else begin
        q1 <= d;     // All use OLD values
        q2 <= q1;    // Perfect shift register
        q3 <= q2;
    end
end

// State machine
always @(posedge clk or negedge reset) begin
    if (!reset)
        state <= IDLE;
    else
        state <= next_state;  // Non-blocking for state updates
end
```

### Weird thing that I will just record and research later
For hardware synthesis, there are two types of always blocks that are relevant:
- Combinational: always @(*)
- Clocked: always @(posedge clk)
In a **combinational** always block, use **blocking** assignments. In a **clocked** always block, use **non-blocking** assignments. A full understanding of why is not particularly useful for hardware design and requires a good understanding of how Verilog simulators keep track of events. Not following this rule results in extremely hard to find errors that are both non-deterministic and differ between simulation and synthesized hardware. ( Quote from: https://hdlbits.01xz.net/wiki/Alwaysblock2)

### Generate block
- A namespace introduced by generate construct???. Used to either conditionally or multiply instantiate generate blocks into a model. A generate block is a collection of one or more module items. A generate block may not contain port declarations, parameters declarations, specify blocks, or specparam declarations. There are 2 types of generate constructs: loop and conditional
- Usually it is used to instantiate a bunch of module: https://hdlbits.01xz.net/wiki/Bcdadd100
- For now think of it as macro in C that's can generate a bunch of module
#### Tips and trick for generate block

```verilog
module top_module ( 
    input [15:0] a, b,
    input cin,
    output cout,
    output [15:0] sum );
    
    logic [4:0] c = 0;
    assign c[0] = cin;
    assign cout = c[4];
    
    genvar i;
    generate
        for (i = 0; i < 4; i++) begin: GEN_BCD
            bcd_fadd m (
                .a(a[4*i +: 4]),
                .b(b[4*i +: 4]),
                .cin(c[i]),
                .cout(c[i+1]),
                .sum(sum[4*i +: 4])
             );
            
        end
    endgenerate

endmodule
```

```verilog
module top_module ( 
    input clk, 
    input [7:0] d, 
    input [1:0] sel, 
    output [7:0] q 
);
    wire [23:0] inter_q;
    wire [23:0] inter_d;
    
    genvar i;
    generate
        for (i = 0; i < 3; i++) begin : GEN_CHAIN
            if (i == 0)
                assign inter_d[8*i +: 8] = d;
            else
                assign inter_d[8*i +: 8] = inter_q[8*(i-1) +: 8];
        end

        for (i = 0; i < 3; i++) begin : GEN_DFF
            my_dff8 m (
                .clk(clk),
                .d (inter_d[8*i +: 8]),
                .q (inter_q[8*i +: 8])
            );
        end
    endgenerate
    
    always_comb begin
        case (sel)
            2'd0: q = d;
            2'd1: q = inter_q[7:0];
            2'd2: q = inter_q[15:8];
            2'd3: q = inter_q[23:16];
        endcase
    end

endmodule

```
### Key Differences Summary

| Aspect         | Continuous          | Procedural                   |
| -------------- | ------------------- | ---------------------------- |
| **Location**   | Outside blocks      | Inside always/initial        |
| **Data Types** | `wire`, `tri`, nets | `reg`, `integer`, memory     |
| **Keyword**    | `assign`            | None (blocking/non-blocking) |
| **Execution**  | Always active       | Event-driven                 |
| **Synthesis**  | Combinational only  | Both comb. & sequential      |

### Important Rules
1. **Continuous**: Only for `wire` types, always use `assign`
2. **Sequential logic**: Always use `<=` (non-blocking)
3. **Combinational logic**: Always use `=` (blocking)
4. **Never mix** blocking and non-blocking in same always block
5. **One driver rule**: Each `wire` can only have one continuous assignment
6. **Multiple drivers**: `reg` can be driven by multiple procedural blocks (but avoid this)

### Common Mistakes to Avoid
```verilog
// WRONG: Continuous assignment to reg
reg [3:0] data;
assign data = a + b;  // ERROR!

// WRONG: Mixing blocking and non-blocking
always @(posedge clk) begin
    q1 <= d;      // Non-blocking
    q2 = q1;      // Blocking - DON'T MIX!
end

// WRONG: Using non-blocking for combinational
always @(*) begin
    result <= a + b;  // Should use blocking (=)
end
```

## Description Levels in Verilog

### Gate-Level Description
- Models design using **primitive logical gates** (AND, OR, NOT, NAND, NOR, XOR, XNOR)
- Most detailed level - closely mimics actual hardware components
- **Structural modeling** - defines the circuit structure explicitly
- Used for precise timing control and optimization
- **Synthesizable** but requires more code

```verilog
// Full Adder using gate-level description
module full_adder_gate(
    input a, b, cin,
    output sum, cout
);
    wire w1, w2, w3;
    
    // Gate instantiations
    xor g1(w1, a, b);           // a XOR b
    xor g2(sum, w1, cin);       // sum = a XOR b XOR cin
    
    and g3(w2, a, b);           // a AND b
    and g4(w3, w1, cin);        // (a XOR b) AND cin
    or  g5(cout, w2, w3);       // cout = (a AND b) OR ((a XOR b) AND cin)
endmodule

// 2:1 Multiplexer using gates
module mux2_gate(
    input a, b, sel,
    output y
);
    wire sel_n, w1, w2;
    
    not n1(sel_n, sel);         // Inverted select
    and a1(w1, a, sel_n);       // a AND ~sel
    and a2(w2, b, sel);         // b AND sel
    or  o1(y, w1, w2);          // Final output
endmodule
```

### Dataflow Description
- Uses **assign statements** to model data flow through circuits
- **Intermediate abstraction** level between behavioral and gate-level
- Primarily for **combinational circuits**
- Describes **what** the circuit does, not **how** it's built
- More concise than gate-level, more explicit than behavioral

```verilog
// Full Adder using dataflow description
module full_adder_dataflow(
    input a, b, cin,
    output sum, cout
);
    // Single assign statements
    assign sum = a ^ b ^ cin;           // XOR operations
    assign cout = (a & b) | (cin & (a ^ b));
endmodule
```

### Behavioural Description
- Describes **functionality** using high-level constructs
- Uses `always` blocks with `if-else`, `case`, `for` loops
- **Highest abstraction** level - focuses on behavior, not structure
- Ideal for **complex sequential circuits** and algorithms
- Most **flexible** and **readable** approach

```verilog
// Counter with behavioral description
module counter_behavioral(
    input clk, reset, enable,
    input [3:0] load_value,
    input load,
    output reg [3:0] count,
    output reg overflow
);
    always @(posedge clk or negedge reset) begin
        if (!reset) begin
            count <= 4'b0000;
            overflow <= 1'b0;
        end else if (load) begin
            count <= load_value;
            overflow <= 1'b0;
        end else if (enable) begin
            if (count == 4'b1111) begin
                count <= 4'b0000;
                overflow <= 1'b1;
            end else begin
                count <= count + 1;
                overflow <= 1'b0;
            end
        end
    end
endmodule
```

#### Casez
- Below is a priority encoder that's detect the first bit which is high in vector input. Casez works by treating every z character as any bit so it's easier instead of listing 256 case for 8 bit encoders
- works similar to case. **Remember that 8'bzzzzzzz1 will not work in case and it will treat it as value with high impedance and not matching anything**

```verilog
  // synthesis verilog_input_version verilog_2001
module top_module (
    input [7:0] in,
    output reg [2:0] pos );
    
    always @(*) begin
        casez (in)
            8'bzzzzzzz1: pos = 0;
            8'bzzzzzz10: pos = 1;
            8'bzzzzz100: pos = 2;
            8'bzzzz1000: pos = 3;
            8'bzzz10000: pos = 4;
            8'bzz100000: pos = 5;
            8'bz1000000: pos = 6;
            8'b10000000: pos = 7;
            default: pos = 0;
        endcase
    end

endmodule
```

### Comparison Summary

| Level          | **Abstraction** | **Best For**                  | **Readability** | **Design Time** | **Control** |
| -------------- | --------------- | ----------------------------- | --------------- | --------------- | ----------- |
| **Gate-Level** | Lowest          | Simple circuits, optimization | Low             | Long            | Maximum     |
| **Dataflow**   | Medium          | Combinational logic           | Medium          | Medium          | Medium      |
| **Behavioral** | Highest         | Complex systems, algorithms   | High            | Short           | Minimum     |

### When to Use Each Level

#### Gate-Level
- **Custom optimization** needed
- **Precise timing** requirements
- **Educational purposes** (understanding hardware)
- **Legacy design** conversion

#### Dataflow
- **Combinational circuits** (decoders, encoders, ALUs)
- **Mathematical operations**
- **Bus operations** and data routing
- **Medium complexity** designs

#### Behavioural
- **Sequential circuits** (counters, state machines)
- **Complex algorithms** (processors, controllers)
- **System-level** modeling
- **Rapid prototyping**

### Mixed-Level Design

Often, **real designs combine all three levels**:

```verilog
// CPU module using mixed levels
module simple_cpu(
    input clk, reset,
    input [7:0] instruction,
    output [7:0] result
);
    // Behavioral: Control unit
    always @(posedge clk) begin
        // State machine for instruction decode
    end
    
    // Dataflow: ALU
    assign alu_result = (opcode == ADD) ? a + b :
                       (opcode == SUB) ? a - b : 8'h00;
    
    // Gate-level: Critical path optimization
    and fast_gate(critical_signal, a[0], b[0]);
endmodule
```

## Sequential Circuit Design

### D Flip Flop

In DFF, we have a clock signal, a reset signal, a d signal, and a output register q

| clk  | reset | d   | q   |
| ---- | ----- | --- | --- |
| high | 0     | x   | 0   |
| high | 1     | 1   | 1   |
| high | 1     | 0   | 0   |

```
module DFF(input clk, input reset, input d, output reg q);
	always @(posedge clk) begin
		if (reset)
			q <= 0;
		else
			q <= d;
	end
endmodule
```

```verilog
module top_module(
	input clk,
	input [7:0] d,
	input areset,
	output reg [7:0] q);
	
	// The only difference in code compared to synchronous reset is in the sensitivity list.
	always @(posedge clk, posedge areset)
		if (areset)
			q <= 0;
		else
			q <= d;


	// In Verilog, the sensitivity list looks strange. The FF's reset is sensitive to the
	// *level* of areset, so why does using "posedge areset" work?
	// To see why it works, consider the truth table for all events that change the input 
	// signals, assuming clk and areset do not switch at precisely the same time:
	
	//  clk		areset		output
	//   x		 0->1		q <= 0; (because areset = 1)
	//   x		 1->0		no change (always block not triggered)
	//  0->1	   0		q <= d; (not resetting)
	//  0->1	   1		q <= 0; (still resetting, q was 0 before too)
	//  1->0	   x		no change (always block not triggered)
	
endmodule
```

## Circuit design
### Ringer
Suppose you are designing a circuit to control a cellphone's ringer and vibration motor. Whenever the phone needs to ring from an incoming call (input **ring**), your circuit must either turn on the ringer (output **ringer** = 1) or the motor (output **motor** = 1), but not both. If the phone is in vibrate mode (input **vibrate_mode** = 1), turn on the motor. Otherwise, turn on the ringer.

Try to use only `assign` statements, to see whether you can translate a problem description into a collection of logic gates.

**Design hint:** When designing circuits, one often has to think of the problem "backwards", starting from the outputs then working backwards towards the inputs. This is often the opposite of how one would think about a (sequential, imperative) programming problem, where one would look at the inputs first then decide on an action (or output). For sequential programs, one would often think "If (inputs are ___ ) then (output should be ___ )". On the other hand, hardware designers often think "The (output should be ___ ) when (inputs are ___ )".

```verilog
module top_module(
	input ring, 
	input vibrate_mode,
	output ringer,
	output motor
);
	
	// When should ringer be on? When (phone is ringing) and (phone is not in vibrate mode)
	assign ringer = ring & ~vibrate_mode;
	
	// When should motor be on? When (phone is ringing) and (phone is in vibrate mode)
	assign motor = ring & vibrate_mode;
	
endmodule
```

## Mux256to1v 
Create a 4-bit wide, 256-to-1 multiplexer. The 256 4-bit inputs are all packed into a single 1024-bit input vector. sel=0 should select bits in[3:0], sel=1 selects bits in[7:4], sel=2 selects bits in[11:8], etc. 

- Pretty interesting because case won't work here and System Verilog support this type of sellect
- Through this problem and the one before hand, there seems to be a connection between masking bit and this type of index value/concatnate;

```verilog
module top_module (
	input [1023:0] in,
	input [7:0] sel,
	output [3:0] out
);

	// We can't part-select multiple bits without an error, but we can select one bit at a time,
	// four times, then concatenate them together.
	assign out = {in[sel*4+3], in[sel*4+2], in[sel*4+1], in[sel*4+0]};

	// Alternatively, "indexed vector part select" works better, but has an unfamiliar syntax:
	// assign out = in[sel*4 +: 4];		// Select starting at index "sel*4", then select a total width of 4 bits with increasing (+:) index number.
	// assign out = in[sel*4+3 -: 4];	// Select starting at index "sel*4+3", then select a total width of 4 bits with decreasing (-:) index number.
	// Note: The width (4 in this case) must be constant.

endmodule
```

## FullAdder 3 bit carry 

```verilog
module top_module( 
    input [2:0] a, b,
    input cin,
    output [2:0] cout,
    output [2:0] sum );
    
    logic [3:0] c;   // internal carry chain: c[0]=cin, c[3]=final carry

    always_comb begin
        c[0] = cin;

        for (int i = 0; i < 3; i++) begin
            sum[i]  = a[i] ^ b[i] ^ c[i];
            c[i+1]  = (a[i] & b[i]) | (c[i] & (a[i] ^ b[i]));
            cout[i] = c[i+1];
        end
    end
    
endmodule
```

```verilog
module top_module (
    input [3:0] x,
    input [3:0] y, 
    output [4:0] sum);
    
    // asign sum = x + y;
    
    logic [4:0] cin;
    always_comb begin
        cin[0] = 0;
        for (int i = 0; i < $bits(x); i++) begin
            sum[i] = x[i] ^ y[i] ^ cin[i];
            cin[i+1] = (x[i] & y[i]) | ( (x[i] ^ y[i]) & cin[i]);
        end
        sum[4] = cin[4];
    end

endmodule
```