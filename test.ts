import { Client } from "genius-lyrics";

async function test() {
  try {
    const geniusClient = new Client("I0fHA-hiK_0aRVDXxggqvo5eQd0NuENz94pN_AFckTE3F4xS_61dIJmjDkmbxTUD");
    const searches = await geniusClient.songs.search("MONTAGE PARTY LeoTHM");
    if (searches.length > 0) {
      const url = searches[0].url;
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const text = await response.text();
      console.log("Response text:", text.substring(0, 100));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
