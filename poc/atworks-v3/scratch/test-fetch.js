const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS || "127.0.0.1:45334"; // A guess, or we can just fetch from env if it exists
console.log("ANTIGRAVITY_LS_ADDRESS:", process.env.ANTIGRAVITY_LS_ADDRESS);

async function test() {
  if (!process.env.ANTIGRAVITY_LS_ADDRESS) {
    console.log("No env var. It might be set by agy CLI when running Next.js");
  }
}
test();
