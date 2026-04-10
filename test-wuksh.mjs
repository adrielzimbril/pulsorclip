const url = "https://x.com/elonmusk/status/1886161499577749712";

async function run() {
  try {
    const req = await fetch("https://co.wuk.sh/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify({ url })
    });
    console.log(await req.text());
  } catch (e) {
    console.log(e);
  }
}
run();
