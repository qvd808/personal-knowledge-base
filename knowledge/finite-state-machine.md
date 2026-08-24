---
tags:
  - fsm
  - verilog
  - hdl
created: 2026-08-23
---
## Definition

- A state machine contains one or more discrete states that the code or hardware move through
- Allow sequential execution of actions based on input

## Moore State Machine

![[simple-state-machine.png]]

## Mealy State Machine

## State machine question
![[fsm-question-1.png]]

![[fsm-question-2.png]]

```verilog
module top_module (
	input clk,
	input reset,
	input [3:1] s,
	output reg fr3,
	output reg fr2,
	output reg fr1,
	output reg dfr
);


	// Give state names and assignments. I'm lazy, so I like to use decimal numbers.
	// It doesn't really matter what assignment is used, as long as they're unique.
	// We have 6 states here.
	parameter A2=0, B1=1, B2=2, C1=3, C2=4, D1=5;
	reg [2:0] state, next;		// Make sure these are big enough to hold the state encodings.
	


    // Edge-triggered always block (DFFs) for state flip-flops. Synchronous reset.	
	always @(posedge clk) begin
		if (reset) state <= A2;
		else state <= next;
	end



    // Combinational always block for state transition logic. Given the current state and inputs,
    // what should be next state be?
    // Combinational always block: Use blocking assignments.    
	always@(*) begin
		case (state)
			A2: next = s[1] ? B1 : A2;
			B1: next = s[2] ? C1 : (s[1] ? B1 : A2);
			B2: next = s[2] ? C1 : (s[1] ? B2 : A2);
			C1: next = s[3] ? D1 : (s[2] ? C1 : B2);
			C2: next = s[3] ? D1 : (s[2] ? C2 : B2);
			D1: next = s[3] ? D1 : C2;
			default: next = 'x;
		endcase
	end
	
	

	// Combinational output logic. In this problem, a procedural block (combinational always block) 
	// is more convenient. Be careful not to create a latch.
	always@(*) begin
		case (state)
			A2: {fr3, fr2, fr1, dfr} = 4'b1111;
			B1: {fr3, fr2, fr1, dfr} = 4'b0110;
			B2: {fr3, fr2, fr1, dfr} = 4'b0111;
			C1: {fr3, fr2, fr1, dfr} = 4'b0010;
			C2: {fr3, fr2, fr1, dfr} = 4'b0011;
			D1: {fr3, fr2, fr1, dfr} = 4'b0000;
			default: {fr3, fr2, fr1, dfr} = 'x;
		endcase
	end
	
endmodule
```

## State machine and clock cycle
- From problems: https://hdlbits.01xz.net/wiki/Lemmings4. Need to investigate why it's 18 here and not either 19 or 21 would make more sense since it's closer to 20
```verilog
module top_module(
    input clk,
    input areset,    // Freshly brainwashed Lemmings walk left.
    input bump_left,
    input bump_right,
    input ground,
    input dig,
    output walk_left,
    output walk_right,
    output aaah,
    output digging ); 
    
    parameter WL = 0, WR = 1, FL = 2, FR = 3, DL = 4, DR = 5, DEAD = 6;
    reg [2:0] state, next_state;
    reg [4:0] cnt;
    reg will_dead;
    
    always @(*) begin
        case (state)
            WL: begin
                if (~ground) next_state = FL;
                else if (dig) next_state = DL;
                else next_state = bump_left ? WR : WL;
            end
            WR: begin
                if (~ground) next_state = FR;
                else if (dig) next_state = DR;
                else next_state = bump_right ? WL : WR;
            end
            FL: next_state = ground ? (will_dead ? DEAD : WL) : FL;
            FR: next_state = ground ? (will_dead ? DEAD : WR) : FR;
            DL: next_state = ~ground ? FL : DL;
            DR: next_state = ~ground ? FR : DR;
            DEAD: next_state = DEAD;
            default: next_state = WL;
        endcase
    end
    
    always @(posedge clk or posedge areset) begin
        if (areset) begin
            state <= WL;
            cnt <= 5'b0;
            will_dead <= 1'b0;
        end else begin
            state <= next_state;
            
            if (cnt > 18) will_dead <= 1'b1;
            if (state == FL || state == FR) begin
                cnt <= cnt + 1;
            end
            else begin
                cnt <= 0;
            end
        end
    end
    
    assign walk_left  = (state == WL);
    assign walk_right = (state == WR);
    assign aaah       = (state == FL || state == FR);
    assign digging    = (state == DL || state == DR);

endmodule
```

- The logic in the code means that's 
	- Before cycle 1 (before we in Falling state, we at 0)
	- After cycle 1 (meaning we have fallen for at 1 cycle, the cnt will be 1)
	- Applied the logic meaning that After 20th cycle (which mean we have fallen for at least 20 cycles) -> switch will_dead to 1

| Fall Cycle | `cnt` (at start of posedge) | `will_dead` (check `cnt > 18`) | `cnt` after increment | Comment |
|------------|-----------------------------|--------------------------------|---------------------|---------|
| 1          | 0                           | 0                              | 1                   | First falling cycle |
| 2          | 1                           | 0                              | 2                   |  |
| 3          | 2                           | 0                              | 3                   |  |
| …          | …                           | …                              | …                   |  |
| 18         | 17                          | 0                              | 18                  |  |
| 19         | 18                          | 0                              | 19                  | Still safe |
| 20         | 19                          | **1**                          | 20                  | `will_dead` becomes 1 now |
| 21         | 20                          | 1                              | 21                  | Death triggered if hits ground |
- It survive on the 20th cycle but not after the 20th cycle
- On the 19th cycle, will dead will get assign and we will have to wait 1 cycle
