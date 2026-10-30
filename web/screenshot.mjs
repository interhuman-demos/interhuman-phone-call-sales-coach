/* Dev utility: drive the app headlessly and screenshot it (no keys needed). */
import { chromium } from "playwright";

// 0.1s of silent mp3 so the Player has something to "play"
const SILENT_MP3 =
  "//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA" + "A".repeat(200);

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, permissions: ["microphone"] });
const page = await ctx.newPage();

const turns = [
  {
    repText: "Hi Dana, thanks for taking the time. We help logistics teams automate dispatch coordination so your team stops living in spreadsheets.",
    buyerText: "Okay. So — I've got about ten minutes. What have you got?",
  },
  {
    repText: "So, um, the price is, uh, well it kind of depends, but, um, it's around three thousand a month, you know.",
    buyerText: "Hm. Three thousand. You don't sound totally sure — is that the real number?",
  },
];
let turnIdx = 0;

// headless shell has no MediaRecorder / real mic — stub them
await page.addInitScript(() => {
  // @ts-ignore
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [] });
  // @ts-ignore
  window.MediaRecorder = class {
    constructor() { this.state = "inactive"; }
    static isTypeSupported() { return true; }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)], { type: "audio/webm" }) });
      this.onstop?.();
    }
  };
});

await page.route("**/api/turn", async (route) => {
  const t = turns[Math.min(turnIdx++, turns.length - 1)];
  await route.fulfill({ json: { ...t, audio: SILENT_MP3 } });
});

await page.goto("http://localhost:4173/");
await page.screenshot({ path: "/tmp/shot-1-idle.png" });

await page.getByRole("button", { name: "Start call" }).click();
await page.waitForSelector("text=Hold to talk");
await page.screenshot({ path: "/tmp/shot-2-live.png" });

// two utterances: intro, then the hesitant pricing line
for (let i = 0; i < 2; i++) {
  const btn = page.locator("main button"); // label flips while held — use a stable selector
  await btn.dispatchEvent("pointerdown");
  await page.waitForTimeout(1200);
  await btn.dispatchEvent("pointerup");
  await page.waitForTimeout(3500); // let signals + nudges fire
}
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/shot-3-signals.png" });

await browser.close();
console.log("done");
