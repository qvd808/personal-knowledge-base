---
tags:
  - computer-architecture
  - nand2tetris
created: 2026-08-23
---
## Program Counter
- Get this one through Nand2Tettris project and seems interesting
```
  CHIP PC {

    IN in[16], reset, load, inc;

    OUT out[16];

    PARTS:

    //// Replace this comment with your code.

    Inc16(in=r2 , out=plusOne );

    Or(a=inc, b=load, out=inOrLoad);

    Or(a=inOrLoad, b=reset, out=inOrLoadOrReset);

    Mux16(a=plusOne , b=in , sel=load , out=isInc);

    Mux16(a=isInc , b=false , sel=reset , out=isReset );

    Register(in=isReset , load=inOrLoadOrReset , out=r2 );


    Or16(a=r2 , b=false , out=out );

}
  ```

Took a while to get this, but basically the idea on how's to get here is that's we need an internal register to store the previous states, then, we basically do a bunch of pipeline to get to the state and save it.

Register always one cycle off the previous one, so we always get the value of the register, then we compute the values for the next state is and save it to the register. 

```
|time |   in   |reset|load | inc |  out   |
| 0+  |      0 |  0  |  0  |  0  |      0 |
| 1   |      0 |  0  |  0  |  0  |      0 |
| 1+  |      0 |  0  |  0  |  1  |      0 |
| 2   |      0 |  0  |  0  |  1  |      1 |
| 2+  | -32123 |  0  |  0  |  1  |      1 |
| 3   | -32123 |  0  |  0  |  1  |      2 |
| 3+  | -32123 |  0  |  1  |  1  |      2 |
| 4   | -32123 |  0  |  1  |  1  | -32123 |
| 4+  | -32123 |  0  |  0  |  1  | -32123 |
| 5   | -32123 |  0  |  0  |  1  | -32122 |
| 5+  | -32123 |  0  |  0  |  1  | -32122 |
| 6   | -32123 |  0  |  0  |  1  | -32121 |
| 6+  |  12345 |  0  |  1  |  0  | -32121 |
| 7   |  12345 |  0  |  1  |  0  |  12345 |
| 7+  |  12345 |  1  |  1  |  0  |  12345 |
| 8   |  12345 |  1  |  1  |  0  |      0 |
| 8+  |  12345 |  0  |  1  |  1  |      0 |
| 9   |  12345 |  0  |  1  |  1  |  12345 |
| 9+  |  12345 |  1  |  1  |  1  |  12345 |
| 10  |  12345 |  1  |  1  |  1  |      0 |
| 10+ |  12345 |  0  |  0  |  1  |      0 |
| 11  |  12345 |  0  |  0  |  1  |      1 |
| 11+ |  12345 |  1  |  0  |  1  |      1 |
| 12  |  12345 |  1  |  0  |  1  |      0 |
| 12+ |      0 |  0  |  1  |  1  |      0 |
| 13  |      0 |  0  |  1  |  1  |      0 |
| 13+ |      0 |  0  |  0  |  1  |      0 |
| 14  |      0 |  0  |  0  |  1  |      1 |
| 14+ |  22222 |  1  |  0  |  0  |      1 |
| 15  |  22222 |  1  |  0  |  0  |      0 |
```

- Notice how on 2, we have inc = 1, but until t = 3, that's the register is update. The code execute at 2+, posedge of the clock, then save the data when it's finished the cycle.

![[program-counter-timing.png]]
