# AI-Powered Wildlife Detection for Harvester Safety

> **Protecting wildlife. Enabling safe harvesting.**  
> A real-time, edge-deployable animal detection system built for Indian agriculture using thermal imaging and deep learning.

---

## The Problem

Every year, hundreds of thousands of animals are killed by farm machinery during harvesting — animals hiding inside dense crops are invisible to operators until it's too late.

| Region | Scale of Impact |
|--------|----------------|
| Germany | ~500,000 animals killed per year by farm mowers |
| Central Europe | Tens to hundreds of thousands of fawns per season |
| Spain | 2.6 million birds killed per winter by olive-harvest tractors |
| India | 110+ leopard cubs rescued from sugarcane fields in a single NGO report |

**Existing solutions fail because:**
- Standard cameras are **blind inside dense Indian crops** (sugarcane, wheat)
- Most AI models detect only **one species** — useless in diverse Indian fields
- Professional thermal systems cost **too much** for small farmers

---

## What We Built

**Fasal Rakshak** is a full-stack AI safety system that mounts on harvesters and detects hidden wildlife in real time using thermal imagery, triggering instant operator alerts before collisions occur.

```
Thermal Camera → Live Video Feed → YOLOv8 Detection → Operator Dashboard → Alert
```

---


**Three live sections in the operator UI:**
- **Live Camera** — real-time IR camera feeds
- **Thermal Detection** — image upload & YOLO inference with bounding boxes
- **Notifications** — isolated alert log with acknowledge/resolve workflow

---

## Key Results

| Metric | Value |
|--------|-------|
| **mAP@50** | **0.976** |
| **mAP@50-95** | **0.794** |
| **Precision** | **0.958** |
| **Recall** | **0.962** |
| **Inference Speed** | **1.9 ms / image** (RTX 5050 GPU) |
| **Dataset Size** | **5,000 synthetic thermal frames** |

- Nilgai & Cow detected at **0.87–0.94 confidence**
- Boar (harder, smaller target) detected at **0.31–0.86 confidence**
- Empty frames correctly return **zero detections**

---

## Technical Highlights

### Custom Synthetic Thermal Dataset
No public dataset exists for partially-occluded wildlife inside Indian crops. We built one from scratch:

- **5,000 frames** generated in Blender — White Hot, Ironbow RGB, and Ironbow HSV palettes
- **3 animal classes**: Nilgai, Wild Boar, Cow + 500 background-only frames
- Physically-grounded temperature modelling:
  - Air temperature drawn from 25–30°C, with per-frame random offsets per body region
  - Fur vs. bare skin differentiation (head warmer than coat)
  - Sensor noise simulation (NETD 0.05K), AGC windowing (0.5–99.5 percentile)
  - Crop occlusion handled by Blender geometry — boxes cover only visible animal pixels
  - Distance simulation at 13–18m from camera
- Every frame has a **fixed random seed** — fully reproducible

### Model Training
- Architecture: **YOLOv8n** (nano, edge-deployable)
- Exported to **ONNX** for runtime-portable inference
- Training split: 4,000 train / 500 val / 500 test (class-balanced)
- Guidance followed: Ultralytics best-practice tips (≥1,500 images/class ✓, 10% background ✓)

### IR Sensing Research
- Studied LWIR (8–14µm) vs. NIR (850nm) physics — thermal imaging detects **emitted heat**, not reflected light
- Modelled FLIR camera pipeline: emission → optics → detection → digitise → NUC → radiometry → AGC → palette
- Addressed why ground-level detection is harder than aerial: **vegetative occlusion collapses detection probability**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **ML Model** | YOLOv8n (Ultralytics), exported ONNX |
| **Backend** | Python · FastAPI · OpenCV · NumPy |
| **Frontend** | React Native · Expo Router · TypeScript |
| **Dataset Generation** | Blender (Cycles) · Python scripting |
| **Inference Runtime** | ONNX Runtime · cv2.dnn |
| **API** | REST (CRUD cameras, alerts) + SSE (real-time push) + MJPEG stream |
| **Camera Hardware** | CP-E25A (850nm NIR) + LWIR thermal |



## Research Contributions

This project addresses **five documented research gaps** in the literature:

1. **No harvester-mounted, in-crop system** — we operate at ground level, inside standing crop at harvest time
2. **Limited dense-vegetation testing** — our Blender dataset explicitly simulates heavy occlusion
3. **Single-species-only models** — ours handles nilgai, boar, and cow simultaneously
4. **No Indian-crop thermal datasets** — we created the first synthetic set for Gujarat-relevant animals
5. **High hardware cost barrier** — edge ONNX model runs on consumer-grade hardware

**Expected final contributions:**
- Edge-deployable, occlusion-aware detection system
- Density-based operational envelope characterisation
- Synthetic thermal dataset with fully documented assumptions

---
