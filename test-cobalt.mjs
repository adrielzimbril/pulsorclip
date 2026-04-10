const urls = ["https://x.com/elonmusk/status/1886161499577749712"];

async function run() {
  for (const url of urls) {
    try {
      console.log("Testing:", url);
      const req = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        body: JSON.stringify({ url })
      });
      const data = await req.json();
      console.log(data);
    } catch (e) {
      console.log("Error:", e);
    }
  }
}
run();
