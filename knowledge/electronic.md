---
tags:
  - electronics
  - karnaugh-map
  - verilog
created: 2026-08-23
---
Diode
Shocky diodes 
Zener 

## Karnaugh Map to circuit

- Essentially a way to get either the SOP(Sum of Product) and POS(Product of Sum to arrive at a minimal variable that's represent the truth table)
![[karnaugh-map-sop-pos.png]]
- Grouping rule for either SOP or POS,
	- We can group any square that's are adjacent and

- Using SOP, we get. Try to group columns that has 1
  ```verilog
      assign out = ( a & ~b ) | ( a & b )  | (~a & ~b & c);
  ```

- Using POS, we get. Try to group columns that has 0 ( in this case the first column where a = 0, b = 1, and the column where a = 0, b = 0)
  ```verilog
      assign out = (a | ~b) & ( a | b | c);

  ```

- The below is pretty interesting because you can not minimize the canonical form of the SOP or POS. The problem is every 1 or 0 is getting isolated, so we can not get a group to reduce it
  ![[karnaugh-map-unminimizable.png]]

```verilog
assign out =
(~a & ~b & ~c &  d) |
(~a & ~b &  c & ~d) |
(~a &  b & ~c & ~d) |
(~a &  b &  c &  d) |
( a & ~b & ~c & ~d) |
( a & ~b &  c &  d) |
( a &  b & ~c &  d) |
( a &  b &  c & ~d);
```

- However, if we allowed XOR, we can do
  ```verilog
  assign out = a ^ b ^ c ^ d;
  ```

- The key rule to recognize parity (memorize this)
### 🔥 Parity Rule

> **If flipping ANY single input bit always flips the output,  
> the function is XOR (parity).**

```verilog
/*
	ab
        00   01   11   10
cd
00      0    0    d    d
01      0    0    0    d
11      d    1    1    d
10      1    0    0    0

This one kinda tricky so just wanna save it
*/
module top_module (
    input a,
    input b,
    input c,
    input d,
    output out_sop,
    output out_pos
); 
    
    assign out_sop = (~a & ~b & c) | (b & c & d) | (a & c & d);
    assign out_pos = c & (d | ~a) & (d | ~b);
endmodule

```

- Read more about grouping: https://www.allaboutcircuits.com/technical-articles/karnaugh-map-boolean-algebraic-simplification-technique/
- For now: Look for **triangle, full row, full column, or square**
## Relationship between Kmap and mux

![[karnaugh-map-mux.png]]

- Take from: https://hdlbits.01xz.net/wiki/Exams/ece241_2014_q3
