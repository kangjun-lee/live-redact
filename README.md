<div align="center">
  <img src="public/logo.svg" alt="Live Redact" height="48" />

  <h3 align="center">Live Redact</h3>

  <p align="center">
    Mosaic faces, screens, or anything you name on your webcam. Runs in your browser with your own API key.
    <br />
    <a href="https://live-redact.kangjun.dev"><strong>Live Demo</strong></a>
  </p>
</div>

## Overview

> [!NOTE]
> This is a demo project for studying.

Live Redact mosaics whatever you describe in plain text, on a live webcam feed.
Each detection call sends one webcam frame to a multimodal model, and the model returns bounding boxes for the target. The app draws the camera feed on a canvas every display frame and mosaics the most recent boxes.
You can choose between TypeSafe Jev and Gemini models.

## Getting Started

You need [mise](https://mise.jdx.dev), or Node 24.21+ and pnpm 12.15+.

```bash
git clone https://github.com/kangjun-lee/live-redact.git
cd live-redact

mise trust
mise install

pnpm install
pnpm run dev
```

---

## What I Learned

- Image input became available in jev-1.14.0. This makes Jev an option for projects where I previously couldn't use it because it lacked multimodal support.
- Detecting multiple objects in a single API request was difficult. Each question in Jev is independent.
  - Naming questions hand_first and hand_second did not reliably identify different hands.
    - Inspired by [this X post](https://x.com/lillyguisnet/status/2111081489521615244), I tried splitting images into tiles, detecting objects in each tile, and merging the results.
    - Jev struggled with objects cut off at tile boundaries.
    - Sending multiple requests per frame did not fit the scope of this project.
  - So, with Jev, the current implementation effectively detects only one face, even when max faces is set higher.
- I tested lower image resolutions to reduce input token usage, assuming objects would still be recognizable.
  - On webcam captures and a small image set, detection still worked at 512px.
  - Compared with 768px, this reduced input token usage by about 35% in my tests.
- Jev is relatively cheap and fast, but for a fixed target such as faces, a dedicated lightweight model seems better suited to the task.

## Future Improvements

### For This Project

- Compare detection accuracy, latency, and token usage across resolutions and prompts using the same camera input or images.
- Experiment with concurrent API requests to update results more frequently, with a limit on in-flight requests and stale responses discarded.
- Explore a Chrome extension and ways to use the processed output as a virtual camera in Google Meet and similar services.

### Other Ideas

- Apply mosaics to sensitive information in recorded videos.
  - Compare dedicated object detection models with general-purpose multimodal models such as Jev and Gemini.
- Build a tool to quickly hide sensitive information in images before uploading them to social media.
