async function run() {
  try {
    const turl = "https://api.vxtwitter.com/elonmusk/status/1886161499577749712";
    const req = await fetch(turl);
    console.log("VXTwitter:", (await req.json()).mediaURLs);

    const tkurl = "https://api.vxtiktok.com/@tiktok/video/7331527017600109855";
    const req2 = await fetch(tkurl);
    console.log("VXTikTok:", (await req2.json()).mediaURLs);

    const yturl = "https://pipedapi.kavin.rocks/streams/dQw4w9WgXcQ";
    const req3 = await fetch(yturl);
    console.log("Piped YT Video Streams length:", (await req3.json()).videoStreams?.length);
  } catch (e) { console.log(e.message); }
}
run();
