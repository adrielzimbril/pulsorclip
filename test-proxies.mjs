async function run() {
  const turl = "https://vxtwitter.com/elonmusk/status/1886161499577749712";
  const req = await fetch(turl, { headers: { "User-Agent": "TelegramBot" } });
  const html = await req.text();
  console.log("VXTwitter MP4 matches:", html.match(/content="(https:\/\/video\.twimg\.com\/ext_tw_video\/[^"]+)"/g));

  const threadsUrl = "https://vxthreads.net/t/C6bC22_rPXY";
  const req2 = await fetch(threadsUrl, { headers: { "User-Agent": "TelegramBot" } });
  const html2 = await req2.text();
  console.log("VXThreads MP4 matches:", html2.match(/content="(https:\/\/[^"]+\.mp4[^"]*)"/g));
}
run();
