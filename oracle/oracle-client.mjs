import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

/** Resident JSON-Lines client for the Lean oracle binary. */
export class Oracle {
  constructor(binPath) {
    this.proc = spawn(binPath, [], { stdio: ["pipe", "pipe", "inherit"] });
    this.rl = createInterface({ input: this.proc.stdout });
    this.waiters = [];
    this.rl.on("line", (line) => {
      const w = this.waiters.shift();
      if (w) w(JSON.parse(line));
    });
  }
  query(payload) {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.proc.stdin.write(JSON.stringify(payload) + "\n");
    });
  }
  close() {
    this.proc.stdin.end();
    this.proc.kill();
  }
}
