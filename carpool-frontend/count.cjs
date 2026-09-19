const fs = require("fs");
const lines = fs
  .readFileSync("src/pages/StudentDashboard.jsx", "utf8")
  .split("\n");
let count = 0;
lines.forEach((line, i) => {
  const matches = (line.match(/`/g) || []).length;
  count += matches;
  if (matches > 0) {
    console.log(
      `Line ${i + 1}: ${matches} backtick(s) - Total so far: ${count}`,
    );
  }
});
