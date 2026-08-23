---
tags:
  - fpga
  - hdl
  - toolchain
created: 2026-08-23
---
## Introduction

FPGA is make up a bunch of logic cells that we can use to build digital logic

You can configure the individual cells to build a circuit like using **Lego brick** to build a toys card

Cell are group into logic blocks and this reconfigurable block is often refer as fabric

## What Can it Be Used For?

- Use FPGA as quick ways to prototype chips: Application-specific integrated circuit
- Create custom reconfigurable digital logic circuit
	- Make your own processor - softcore processor. Can also implement multiple processor
- Digital signal processing task: computing Fourier transform

## How to Create Design for FPGA?

Design Flow:

-  We use [[hardware-description-language-hdl]] to program FPGA
- Simulation of your device: gtkwave, etc. Also need to write test to test your original design
- Synthesis: yosys
- Place and Route (PNR): nextpnr
- Package: icepack
- Upload: iceprog

We can use tool like [APIO](https://github.com/FPGAwars/apio) to call all of the above low level tools for us

Usually FPGA has an external SPI chip so it can flash to individual cells for configuration. Each time we boot it up, it has to read from the flash chip

## Phase-Locked Loop

A way to increase the clock output of the FPGA

## Metastability

[Experimenting with Metastability and Multiple Clocks on FPGAs](https://colinoflynn.com/2020/12/experimenting-with-metastability-and-multiple-clocks-on-fpgas/)

A Metastability condition is when you try to sample a signal A from one clock domain to another with in the set up and hold up time of a signal. The signal within the hold up + set up time is undefined

## Clock Domain Crossing

Clock domain is all of the logic that is clocked from a clock signal or divided version of the clock.

Clock domain crossing is a chance of metastability happening when 2 clock domain interact. The solution is usually to create a synchronize circuit

## FIFO

FIFO as a queue can be a good ways to send message across asynchronized signal. Here is some tips on how to design a good FIFO: [FIFO's paper](https://www.youtube.com/redirect?event=video_description&redir_token=QUFFLUhqa2s2akpVOHVsWEFtYzVYUnZfbmhLWjdJLWc0Z3xBQ3Jtc0trVEZYV0NaSWxqQlRlQmxBbHlkR2Ewc0hfSDlSZWZNOVYwSU9qUHVBYTdIbzF0MHlTNjRldmx2SmgxcHFHMkVSVlBPQTNuSEkyMHFHQWtmWVd5WGhtYmdwY1N3cFRHMVhfeTlvQmVJZHNjWmJUUTRlVQ&q=http%3A%2F%2Fwww.sunburst-design.com%2Fpapers%2FCummingsSNUG2002SJ_FIFO1.pdf&v=dXU1py-Od1g)

## Resources

[[resources#Field-Programmable Gate Arrays (FPGAs) - Resources]]
